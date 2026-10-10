// Disclosed synthetic keys and transaction containers, never real wallets.
// Containers exercise serialization/derivation/ECDH; signatures and range
// proofs are placeholders, so these are NOT consensus-valid transactions.
#include "../verification/ReceiveVerifier.h"
#include "../third_party/json/json.hpp"
#include "cryptonote_basic/cryptonote_basic_impl.h"
#include "cryptonote_basic/cryptonote_format_utils.h"
#include "device/device.hpp"
#include "common/base58.h"
#include "ringct/rctSigs.h"
#include "serialization/binary_utils.h"
#include "string_tools.h"
#include <fstream>
#include <iostream>

using Json = nlohmann::json;
void checked(bool ok, int line) { if (!ok) throw std::runtime_error("Synthetic receive fixture check failed at line " + std::to_string(line)); }
#define check(condition) checked((condition), __LINE__)
crypto::secret_key scalar(unsigned n) {
    crypto::secret_key value{};
    reinterpret_cast<unsigned char*>(&value)[0] = n;
    return value;
}
crypto::public_key pub(const crypto::secret_key& key) {
    crypto::public_key value;
    check(crypto::secret_key_to_public_key(key, value));
    return value;
}
template<class T> std::string hex(const T& value) { return epee::string_tools::pod_to_hex(value); }

int main(int argc, char** argv) {
  try {
    check(argc == 3 || argc == 4);
    Json cases = Json::array();
    auto& device = hw::get_device("default");
    cryptonote::account_keys wallet{};
    wallet.m_view_secret_key = scalar(7);
    wallet.m_spend_secret_key = scalar(11);
    wallet.m_account_address = {pub(wallet.m_spend_secret_key), pub(wallet.m_view_secret_key)};
    auto append = [&](const char* name, Json request, const char* failure = nullptr) {
        auto expected = Json::parse(receive_verifier_request(request.dump()));
        check(failure ? !expected["ok"].get<bool>() && expected["error"]["code"] == failure : expected["ok"].get<bool>());
        cases.push_back({{"name", name}, {"request", request}, {"expected", expected}});
    };
    auto standard = cryptonote::get_public_address_as_str(cryptonote::MAINNET, false, wallet.m_account_address);
    for (unsigned version : {1u, 2u, 3u}) {
      for (unsigned kind = 0; kind < 4; ++kind) {
        auto receiver = kind >= 2 ? device.get_subaddress(wallet, {0, 1}) : wallet.m_account_address;
        const bool additional = kind == 3;
        crypto::hash8 payment{};
        payment.data[0] = 42;
        auto encoded = kind == 1 ? cryptonote::get_account_integrated_address_as_str(cryptonote::MAINNET, receiver, payment)
            : cryptonote::get_public_address_as_str(cryptonote::MAINNET, kind >= 2, receiver);
        cryptonote::transaction tx;
        tx.version = version;
        cryptonote::txin_to_key in{};
        in.key_offsets = {1, 2};
        tx.vin.push_back(in);
        const auto tx_secret = scalar(13);
        auto main_key = kind >= 2 && !additional
            ? rct::rct2pk(rct::scalarmultKey(rct::pk2rct(receiver.m_spend_public_key), rct::sk2rct(tx_secret))) : pub(tx_secret);
        // Historical extra can contain more than one main TX public key.
        if (kind == 0) check(cryptonote::add_tx_pub_key_to_extra(tx, pub(scalar(47))));
        check(cryptonote::add_tx_pub_key_to_extra(tx, main_key));
        const uint64_t values[] = {9007199254740993ULL, 12345678901ULL, 0ULL};
        rct::keyV shared;
        std::vector<crypto::public_key> extra_keys;
        for (size_t index = 0; index < 3; ++index) {
            const auto secret = additional ? scalar(17 + index) : tx_secret;
            auto recipient = receiver;
            if (index == 1) recipient = {pub(scalar(19)), pub(scalar(23))};
            crypto::key_derivation derivation;
            check(crypto::generate_key_derivation(recipient.m_view_public_key, secret, derivation));
            crypto::public_key output;
            check(crypto::derive_public_key(derivation, index, recipient.m_spend_public_key, output));
            tx.vout.push_back({version == 1 ? values[index] : 0, cryptonote::txout_to_key{output}});
            crypto::secret_key amount_key;
            crypto::derivation_to_scalar(derivation, index, amount_key);
            shared.push_back(rct::sk2rct(amount_key));
            extra_keys.push_back(kind >= 2 && index != 1
                ? rct::rct2pk(rct::scalarmultKey(rct::pk2rct(receiver.m_spend_public_key), rct::sk2rct(secret))) : pub(secret));
        }
        if (additional) check(cryptonote::add_additional_tx_pub_keys_to_extra(tx.extra, extra_keys));
        if (version == 1) tx.signatures.resize(1, std::vector<crypto::signature>(2));
        else {
            auto& rv = tx.rct_signatures;
            rv.type = version == 2 ? (kind % 2 ? rct::RCTTypeSimple : rct::RCTTypeFull) : rct::RCTTypeBulletproof;
            rv.txnFee = 1;
            rv.ecdhInfo.resize(3);
            rv.outPk.resize(3);
            for (size_t i = 0; i < 3; ++i) {
                rv.ecdhInfo[i].mask = rct::sk2rct(scalar(31 + i));
                rv.ecdhInfo[i].amount = rct::d2h(values[i]);
                rct::addKeys2(rv.outPk[i].mask, rv.ecdhInfo[i].mask, rv.ecdhInfo[i].amount, rct::H);
                rct::ecdhEncode(rv.ecdhInfo[i], shared[i]);
                const auto decoded = rv.type == rct::RCTTypeFull ? rct::decodeRct(rv, shared[i], i, device)
                    : rct::decodeRctSimple(rv, shared[i], i, device);
                check(decoded == values[i]); // Independent native decoder oracle.
            }
            if (rv.type == rct::RCTTypeSimple) rv.pseudoOuts.resize(1);
            if (rv.type == rct::RCTTypeBulletproof) {
                rv.p.pseudoOuts.resize(1);
                rv.p.bulletproofs.resize(1);
                auto& proof = rv.p.bulletproofs[0];
                for (auto* value : {&proof.A, &proof.S, &proof.T1, &proof.T2, &proof.taux, &proof.mu, &proof.a, &proof.b, &proof.t}) *value = rct::zero();
                rv.p.bulletproofs[0].L.resize(8);
                rv.p.bulletproofs[0].R.resize(8);
            } else rv.p.rangeSigs.resize(3);
            rv.p.MGs.resize(1);
            rv.p.MGs[0].ss.resize(2, rct::keyV(2));
        }
        std::string blob;
        check(serialization::dump_binary(tx, blob));
        Json request = {{"action", "verify"}, {"address", encoded}, {"view_key", hex(wallet.m_view_secret_key)},
            {"network", "mainnet"}, {"hash", hex(cryptonote::get_transaction_hash(tx))},
            {"blob_hex", epee::string_tools::buff_to_hex_nodelimer(blob)}};
        const auto name = "v" + std::to_string(version) + "-kind" + std::to_string(kind);
        append(name.c_str(), request);
        check(cases.back()["expected"]["data"]["outputs"].size() == 2);
        check(cases.back()["expected"]["data"]["total_atomic"] == "9007199254740993");
        if (version == 1 && kind == 0) {
            auto coinbase = tx;
            coinbase.version = 2;
            coinbase.vin = {cryptonote::txin_gen{1}};
            coinbase.signatures.clear();
            coinbase.invalidate_hashes();
            check(serialization::dump_binary(coinbase, blob));
            auto received = request;
            received["hash"] = hex(cryptonote::get_transaction_hash(coinbase));
            received["blob_hex"] = epee::string_tools::buff_to_hex_nodelimer(blob);
            append("coinbase-clear-amounts", received);
            check(cases.back()["expected"]["data"]["outputs"].size() == 2);
            check(cases.back()["expected"]["data"]["total_atomic"] == "9007199254740993");
        }
        if (version == 3 && kind == 0) {
            for (auto network : {cryptonote::TESTNET, cryptonote::STAGENET}) {
                auto received = request;
                received["network"] = network == cryptonote::TESTNET ? "testnet" : "stagenet";
                received["address"] = cryptonote::get_public_address_as_str(network, false, receiver);
                append(network == cryptonote::TESTNET ? "testnet-outputs" : "stagenet-outputs", received);
                check(cases.back()["expected"]["data"]["outputs"].size() == 2);
            }
            auto bad = request;
            bad["view_key"] = hex(scalar(8)); append("wrong-view-key", bad, "view_key_mismatch");
            bad["view_key"] = std::string(64, '0'); append("zero-view-key", bad, "invalid_view_key");
            bad["view_key"] = std::string(64, 'f'); append("noncanonical-key", bad, "invalid_view_key");
            bad = request; bad["network"] = "testnet"; append("wrong-network", bad, "network_mismatch");
            bad = request; bad["hash"] = std::string(64, 'a'); append("wrong-hash", bad, "transaction_hash_mismatch");
            bad = request; bad["blob_hex"] = request["blob_hex"].get<std::string>() + "00"; append("trailing-data", bad, "invalid_transaction");
            bad = request; bad["blob_hex"] = "01"; append("truncated-data", bad, "invalid_transaction");
            auto damaged = tx;
            damaged.rct_signatures.outPk[0].mask = rct::identity();
            damaged.invalidate_hashes();
            check(serialization::dump_binary(damaged, blob));
            bad = request; bad["hash"] = hex(cryptonote::get_transaction_hash(damaged));
            bad["blob_hex"] = epee::string_tools::buff_to_hex_nodelimer(blob);
            append("damaged-commitment", bad, "invalid_commitment");
            damaged = tx;
            damaged.rct_signatures.ecdhInfo[0].amount = rct::identity();
            damaged.invalidate_hashes();
            check(serialization::dump_binary(damaged, blob));
            bad = request; bad["hash"] = hex(cryptonote::get_transaction_hash(damaged));
            bad["blob_hex"] = epee::string_tools::buff_to_hex_nodelimer(blob);
            append("damaged-ecdh", bad, "invalid_commitment");
            bad = request;
            cryptonote::account_public_address other{pub(scalar(29)), pub(wallet.m_view_secret_key)};
            bad["address"] = cryptonote::get_public_address_as_str(cryptonote::MAINNET, false, other);
            append("valid-key-no-recognized-outputs", bad);
            check(cases.back()["expected"]["data"]["outputs"].empty());
        }
      }
    }
    auto kurz = wallet.m_account_address;
    kurz.m_view_public_key = kurz.m_spend_public_key;
    const auto unsafe = cryptonote::get_public_address_as_str(cryptonote::MAINNET, false, kurz);
    append("kurz-address", {{"action", "inspect"}, {"address", unsafe}});
    check(!cases.back()["expected"]["data"]["private_key_allowed"].get<bool>());
    append("kurz-refuses-secret", {{"action", "verify"}, {"address", unsafe}}, "unsafe_address");
    const auto shared = tools::base58::encode_addr(cryptonote::config<cryptonote::MAINNET>::RYO_LONG_ADDRESS_BASE58_PREFIX,
        cryptonote::t_serializable_object_to_blob(kurz));
    append("long-shared-keys-refuses-secret", {{"action", "verify"}, {"address", shared}}, "unsafe_address");
    // Subaddress with a=1 legitimately has C=D; it must remain usable.
    auto unit_wallet = wallet;
    unit_wallet.m_view_secret_key = scalar(1);
    unit_wallet.m_account_address.m_view_public_key = pub(scalar(1));
    auto sub = device.get_subaddress(unit_wallet, {0, 2});
    append("unit-scalar-subaddress", {{"action", "inspect"}, {"address",
        tools::base58::encode_addr(cryptonote::config<cryptonote::MAINNET>::RYO_LONG_SUBADDRESS_BASE58_PREFIX,
            cryptonote::t_serializable_object_to_blob(sub))}});
    check(cases.back()["expected"]["data"]["private_key_allowed"].get<bool>());
    // Real public historical bytes are parse/hash/no-match references only.
    for (const char* file : {"genesis-transaction.hex", "ringct-v3-transaction.hex"}) {
        std::ifstream in(std::string(argv[2]) + "/" + file);
        std::string encoded; in >> encoded; check(!encoded.empty());
        std::string blob; check(epee::string_tools::parse_hexstr_to_binbuff(encoded, blob));
        cryptonote::transaction tx; check(serialization::parse_binary(blob, tx));
        append(file, {{"action", "verify"}, {"address", standard}, {"view_key", hex(wallet.m_view_secret_key)},
            {"network", "mainnet"}, {"hash", hex(cryptonote::get_transaction_hash(tx))}, {"blob_hex", encoded}});
        check(cases.back()["expected"]["data"]["outputs"].empty());
    }
    if (argc == 4) {
        std::ifstream reference(argv[3]); check(reference.good());
        Json committed; reference >> committed; check(committed == cases);
    }
    std::ofstream out(argv[1]); check(out.good()); out << cases.dump(2) << '\n';
    std::cout << cases.size() << " native receive-verification cases passed.\n";
    return 0;
  } catch (const std::exception& e) { std::cerr << e.what() << "\n"; return 1; }
}
