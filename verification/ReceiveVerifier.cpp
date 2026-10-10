#include "ReceiveVerifier.h"
#include <boost/mpl/vector.hpp>
#include "cryptonote_basic/cryptonote_basic_impl.h"
#include "cryptonote_basic/cryptonote_format_utils.h"
#include "ringct/rctOps.h"
#include "serialization/binary_utils.h"
#include "string_tools.h"
#include "memwipe.h"
#include "../third_party/json/json.hpp"
#include <algorithm>
#include <cstring>
#include <limits>
#include <stdexcept>

// Internal pinned SDK helper; declaration is absent from its public header.
namespace cryptonote { bool expand_transaction_1(transaction&, bool); }

namespace {
using Json = nlohmann::json;
template<class T> struct Sensitive {
    T value{};
    ~Sensitive() { memwipe(&value, sizeof(value)); }
};
struct WipeString {
    std::string& value;
    ~WipeString() { if (!value.empty()) memwipe(&value[0], value.size()); }
};
struct WipeDerivations {
    std::vector<crypto::key_derivation>& value;
    ~WipeDerivations() { for (auto& item : value) memwipe(&item, sizeof(item)); }
};
struct Failure { const char* code; const char* message; };
void require(bool condition, const char* code, const char* message) {
    if (!condition) throw Failure{code, message};
}
std::string field(const Json& input, const char* name, size_t maximum) {
    require(input.count(name) != 0 && input[name].is_string(), "invalid_input", "A required input is missing.");
    auto value = input[name].get<std::string>();
    require(!value.empty() && value.size() <= maximum, "invalid_input", "An input exceeds the supported bounds.");
    return value;
}
bool hexadecimal(const std::string& text) {
    return std::all_of(text.begin(), text.end(), [](unsigned char c) {
        return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
    });
}
template<typename T> T pod(const std::string& text, const char* code) {
    T value{};
    require(text.size() == sizeof(T) * 2 && hexadecimal(text) &&
        epee::string_tools::hex_to_pod(text, value), code, "Enter the requested 64-character hexadecimal value.");
    return value;
}
template<typename T> std::string hex(const T& value) { return epee::string_tools::pod_to_hex(value); }
struct Address {
    cryptonote::address_parse_info parsed;
    std::string network;
    std::string kind;
    bool allowed;
};
Address address(const std::string& text) {
    require(text.size() <= 200, "invalid_address", "Enter a supported public Ryo address.");
    const cryptonote::network_type networks[] = {cryptonote::MAINNET, cryptonote::TESTNET, cryptonote::STAGENET};
    const char* names[] = {"mainnet", "testnet", "stagenet"};
    for (size_t n = 0; n < 3; ++n) {
        cryptonote::address_parse_info parsed{};
        if (!cryptonote::get_account_address_from_str(networks[n], parsed, text)) continue;
        const bool same = parsed.address.m_view_public_key == parsed.address.m_spend_public_key;
        const bool allowed = !parsed.is_kurz && (parsed.is_subaddress || !same);
        return {parsed, names[n], parsed.is_kurz ? "kurz" : parsed.is_subaddress ? "subaddress" :
            parsed.has_payment_id ? "integrated" : "standard", allowed};
    }
    throw Failure{"invalid_address", "The address failed native Ryo validation. Check its spelling and checksum."};
}
Json inspect(const Address& a) {
    return {{"network", a.network}, {"kind", a.kind}, {"private_key_allowed", a.allowed},
        {"view_public_key", hex(a.parsed.address.m_view_public_key)},
        {"spend_public_key", hex(a.parsed.address.m_spend_public_key)}};
}
void check_view(const Address& a, const crypto::secret_key& secret) {
    const auto* bytes = reinterpret_cast<const unsigned char*>(&secret);
    require(std::any_of(bytes, bytes + 32, [](unsigned char c) { return c != 0; }),
        "invalid_view_key", "The private view key must be a nonzero canonical scalar.");
    crypto::public_key actual;
    require(crypto::secret_key_to_public_key(secret, actual), "invalid_view_key", "The private view key is not a canonical scalar.");
    if (a.parsed.is_subaddress) {
        actual = rct::rct2pk(rct::scalarmultKey(rct::pk2rct(a.parsed.address.m_spend_public_key), rct::sk2rct(secret)));
    }
    require(actual == a.parsed.address.m_view_public_key, "view_key_mismatch",
        "The private view key does not match this address. Use the wallet's private view key, not its public view key.");
}
crypto::secret_key view_key(const Json& input, const Address& a) {
    require(a.allowed, "unsafe_address", "Kurz/shared view-and-spend-key addresses are not supported. Never enter a private spend key.");
    auto text = field(input, "view_key", 64);
    WipeString wipe{text};
    auto secret = pod<crypto::secret_key>(text, "invalid_view_key");
    check_view(a, secret);
    return secret;
}
uint64_t amount(const cryptonote::transaction& tx, size_t index, const crypto::key_derivation& derivation) {
    if (tx.version == 1 || cryptonote::is_coinbase(tx)) return tx.vout[index].amount;
    const auto& signatures = tx.rct_signatures;
    require(signatures.type == rct::RCTTypeFull || signatures.type == rct::RCTTypeSimple ||
        signatures.type == rct::RCTTypeBulletproof, "unsupported_ringct", "This RingCT type is not supported.");
    require(signatures.ecdhInfo.size() == tx.vout.size() && signatures.outPk.size() == tx.vout.size(),
        "invalid_transaction", "The confidential-output data has inconsistent sizes.");
    crypto::secret_key shared;
    crypto::derivation_to_scalar(derivation, index, shared);
    Sensitive<rct::ecdhTuple> sensitive;
    auto& decoded = sensitive.value;
    decoded = signatures.ecdhInfo[index];
    // Same native CPU operations/checks as decodeRct/decodeRctSimple. Avoid
    // hardware-wallet dispatch and retain the mandatory commitment comparison.
    rct::ecdhDecode(decoded, rct::sk2rct(shared));
    require(sc_check(decoded.mask.bytes) == 0 && sc_check(decoded.amount.bytes) == 0,
        "invalid_commitment", "A recognized output failed native confidential-amount validation.");
    require(std::all_of(decoded.amount.bytes + 8, decoded.amount.bytes + 32, [](unsigned char c) { return c == 0; }),
        "invalid_commitment", "The decoded amount exceeds the native uint64 range.");
    rct::key commitment;
    rct::addKeys2(commitment, decoded.mask, decoded.amount, rct::H);
    require(rct::equalKeys(commitment, signatures.outPk[index].mask), "invalid_commitment",
        "A recognized output failed its native commitment check. No amounts are shown.");
    const auto value = rct::h2d(decoded.amount);
    return value;
}
Json verify(const Json& input, const Address& a) {
    auto secret = view_key(input, a);
    const auto network = field(input, "network", 8);
    require(network == a.network, "network_mismatch", "The address belongs to a different network from this transaction reader.");
    const auto expected = pod<crypto::hash>(field(input, "hash", 64), "invalid_transaction_hash");
    const auto blob_hex = field(input, "blob_hex", 8 * 1024 * 1024);
    std::string blob;
    require(blob_hex.size() % 2 == 0 && hexadecimal(blob_hex) &&
        epee::string_tools::parse_hexstr_to_binbuff(blob_hex, blob), "invalid_transaction", "The transaction bytes are malformed.");
    cryptonote::transaction tx;
    require(::serialization::parse_binary(blob, tx), "invalid_transaction", "The native Ryo transaction parser rejected these bytes.");
    require(tx.version >= 1 && tx.version <= 3, "unsupported_version", "This transaction version is not supported.");
    require(tx.vout.size() <= 2048 && tx.vin.size() <= 1024 && tx.extra.size() <= 65536,
        "resource_limit", "This transaction exceeds the local verification bounds.");
    std::string canonical;
    require(::serialization::dump_binary(tx, canonical) && canonical == blob, "invalid_transaction",
        "Transaction bytes are truncated, noncanonical or contain trailing data.");
    if (tx.version >= 2 && !cryptonote::is_coinbase(tx)) {
        require(tx.rct_signatures.type >= rct::RCTTypeFull && tx.rct_signatures.type <= rct::RCTTypeBulletproof,
            "unsupported_ringct", "This RingCT type is not supported.");
        if (tx.rct_signatures.type == rct::RCTTypeBulletproof) {
            require(tx.rct_signatures.p.bulletproofs.size() == 1 &&
                tx.rct_signatures.p.bulletproofs[0].L.size() >= 6 &&
                tx.rct_signatures.p.bulletproofs[0].L.size() <= 16,
                "invalid_transaction", "The Bulletproof container has unsupported dimensions.");
        }
        require(cryptonote::expand_transaction_1(tx, false), "invalid_transaction", "The native confidential transaction structure is invalid.");
    }
    crypto::hash actual;
    require(cryptonote::get_transaction_hash(tx, actual) && actual == expected,
        "transaction_hash_mismatch", "The transaction bytes do not match the requested hash.");
    std::vector<cryptonote::tx_extra_field> extra;
    require(cryptonote::parse_tx_extra(tx.extra, extra), "unsupported_extra", "The transaction extra could not be interpreted by native Ryo.");
    std::vector<crypto::key_derivation> derivations;
    WipeDerivations wipe_derivations{derivations};
    for (const auto& entry : extra) {
        const auto* key = boost::get<cryptonote::tx_extra_pub_key>(&entry);
        if (!key) continue;
        require(derivations.size() < 32, "resource_limit", "Too many transaction public keys.");
        Sensitive<crypto::key_derivation> sensitive;
        auto& derived = sensitive.value;
        require(crypto::generate_key_derivation(key->pub_key, secret, derived), "invalid_transaction", "A transaction public key is invalid.");
        derivations.push_back(derived);
    }
    require(!derivations.empty(), "unsupported_extra", "No supported transaction public key was found.");
    const auto additional = cryptonote::get_additional_tx_pub_keys_from_extra(tx.extra);
    require(additional.empty() || additional.size() == tx.vout.size(), "invalid_transaction", "Additional transaction key count does not match outputs.");
    Json recognized = Json::array();
    uint64_t total = 0;
    for (size_t index = 0; index < tx.vout.size(); ++index) {
        const auto* output = boost::get<cryptonote::txout_to_key>(&tx.vout[index].target);
        require(output != nullptr && crypto::check_key(output->key), "unsupported_output", "An output is not a supported native public-key output.");
        auto candidates = derivations;
        WipeDerivations wipe_candidates{candidates};
        if (!additional.empty()) {
            Sensitive<crypto::key_derivation> sensitive;
        auto& derived = sensitive.value;
            require(crypto::generate_key_derivation(additional[index], secret, derived), "invalid_transaction", "An additional transaction public key is invalid.");
            candidates.push_back(derived);
        }
        for (const auto& derivation : candidates) {
            crypto::public_key derived;
            require(crypto::derive_public_key(derivation, index, a.parsed.address.m_spend_public_key, derived),
                "invalid_transaction", "Native output derivation failed.");
            if (derived != output->key) continue;
            const auto value = amount(tx, index, derivation);
            require(value <= std::numeric_limits<uint64_t>::max() - total, "resource_limit", "Recognized amounts exceed the supported total range.");
            total += value;
            recognized.push_back({{"index", index}, {"amount_atomic", std::to_string(value)}});
            break;
        }
    }
    return {{"hash", hex(actual)}, {"network", a.network}, {"version", tx.version},
        {"ringct_type", tx.rct_signatures.type}, {"output_count", tx.vout.size()},
        {"outputs", recognized}, {"total_atomic", std::to_string(total)}};
}
}

std::string receive_verifier_request(const std::string& request) {
    try {
        require(request.size() <= 8 * 1024 * 1024 + 4096, "resource_limit", "Local verification input is too large.");
        auto input = Json::parse(request);
        // JSON owns a separate copy; wipe it on every exit, including failures.
        std::string empty;
        auto& view = input.is_object() && input.count("view_key") != 0 && input["view_key"].is_string()
            ? input["view_key"].get_ref<std::string&>() : empty;
        WipeString wipe_json_key{view};
        require(input.is_object(), "invalid_input", "Invalid local verification request.");
        const auto action = field(input, "action", 16);
        const auto a = address(field(input, "address", 200));
        if (action == "check") { auto secret = view_key(input, a); (void)secret; }
        const auto data = action == "inspect" || action == "check" ? inspect(a) : action == "verify" ? verify(input, a) :
            throw Failure{"invalid_input", "Unknown local verification action."};
        return Json{{"ok", true}, {"data", data}}.dump();
    } catch (const Failure& failure) {
        return Json{{"ok", false}, {"error", {{"code", failure.code}, {"message", failure.message}}}}.dump();
    } catch (const std::bad_alloc&) {
        return "{\"ok\":false,\"error\":{\"code\":\"resource_limit\",\"message\":\"Local verification memory limit reached.\"}}";
    } catch (...) {
        return "{\"ok\":false,\"error\":{\"code\":\"invalid_transaction\",\"message\":\"Native Ryo rejected the supplied data.\"}}";
    }
}
