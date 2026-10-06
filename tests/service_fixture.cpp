#include "services/BlockService.h"
#include "services/TransactionService.h"
#include "ApiRouter.h"
#include <boost/filesystem.hpp>
#include <fstream>
#include <thread>
#include <atomic>

using namespace ryo_explorer;
static void check(bool value, const char* message) {
    if (!value) throw std::runtime_error(message);
}
static cryptonote::blobdata fixture_blob(const char* name) {
    std::ifstream input(std::string(RYO_FIXTURE_DIR) + "/" + name);
    std::string hex, blob;
    input >> hex;
    check(!hex.empty() && epee::string_tools::parse_hexstr_to_binbuff(hex, blob), "Fixture hex failed.");
    return blob;
}
static void expect_failure(std::function<void()> operation, QueryError expected) {
    try { operation(); } catch (const QueryFailure& failure) {
        check(failure.code == expected, "Wrong native query failure."); return;
    }
    throw std::runtime_error("Expected a query failure.");
}
int main(int argc, char** argv) {
    try {
        check(argc == 3, "Expected offline LMDB and RPC arguments.");
        cryptonote::transaction ordinary;
        const auto ordinary_blob = fixture_blob("ringct-v3-transaction.hex");
        check(cryptonote::parse_and_validate_tx_from_blob(ordinary_blob, ordinary), "Native RingCT parse failed.");
        const auto ordinary_metadata = transaction_metadata(ordinary);
        const std::string ordinary_hash = "a432b907878c1915e4a4ee0bd15ae54ce9fdb540addb7f8e4591d05ee3ad78c9";
        check(epee::string_tools::pod_to_hex(ordinary_metadata.hash) == ordinary_hash, "Native RingCT hash mismatch.");
        check(cryptonote::tx_to_blob(ordinary) == ordinary_blob, "Native RingCT roundtrip failed.");
        check(ordinary.version == 3 && ordinary.rct_signatures.type == 3, "Wrong native RingCT version/type.");
        check(!ordinary_metadata.coinbase && !ordinary_metadata.output_amounts_visible &&
              !ordinary_metadata.input_amounts_visible && ordinary_metadata.output_atoms == 0,
              "Hidden amounts were presented as known.");
        std::ifstream reference(std::string(RYO_FIXTURE_DIR) + "/ringct-v3-transaction.json");
        xmreg::json reference_json; reference >> reference_json;
        check(ordinary_metadata.fee == reference_json["data"]["tx_fee"].get<uint64_t>() &&
              ordinary_metadata.size == reference_json["data"]["tx_size"].get<uint64_t>() &&
              ordinary_metadata.ring_size == reference_json["data"]["mixin"].get<uint64_t>(),
              "Native RingCT metadata disagrees with public capture.");

        xmreg::MicroCore source;
        check(source.init(argv[1], cryptonote::MAINNET, true), "Offline registered reader failed.");
        check(source.get_core().get_db().is_read_only(), "Reader database was opened writable.");
        QueryContext source_context(source);
        BlockService source_blocks(source_context);
        TransactionService source_transactions(source_context);
        NetworkService source_network(source_context);
        LegacyJson source_legacy(source_blocks, source_transactions, true, "mainnet");
        ApiV2 source_v2(source_blocks, source_transactions, source_network, true, "mainnet", xmreg::json::object());
        ApiRouter source_api(source_legacy, source_v2);
        xmreg::json api_cases = xmreg::json::array();
        auto record = [&](ApiRouter& api, const std::string& route, const std::string& schema) {
            const auto response = api.get(route);
            if (response.status != 200)
                throw std::runtime_error("V2 fixture query failed: " + route + " " + response.body.dump());
            api_cases.push_back({{"schema", schema}, {"body", response.body}});
            return response.body;
        };
        auto genesis = source_blocks.get("0");
        check(source_blocks.get(epee::string_tools::pod_to_hex(genesis.hash)).hash == genesis.hash,
              "Height/hash block lookup differs.");
        auto genesis_tx = source_transactions.get(epee::string_tools::pod_to_hex(genesis.metadata[0].hash));
        check(genesis.chain_height == 1 && genesis_tx.confirmations == 1 && genesis_tx.metadata.coinbase &&
              genesis_tx.metadata.output_atoms == 8800000000000000ULL &&
              genesis_tx.metadata.output_amounts_visible, "Genesis metadata failed.");
        check(source_network.get().chain_height == 1 && source_network.get().tip.height == 0 &&
              source_network.get().tip_difficulty == 1, "Native network snapshot failed.");
        record(source_api, "/api/v2/network", "NetworkResponse");
        record(source_api, "/api/v2/block-intervals?window=30d", "BlockIntervalsResponse");
        check(source_blocks.intervals(3600).points.empty(), "Genesis acquired an interval.");
        expect_failure([&] { source_blocks.intervals(1); }, QueryError::invalid);
        expect_failure([&] { source_blocks.intervals(3600, "", 50001); }, QueryError::invalid);
        record(source_api, "/api/v2/blocks?limit=1", "BlockPageResponse");
        record(source_api, "/api/v2/blocks/0", "BlockResponse");
        const auto v2_genesis = record(source_api, "/api/v2/transactions/" +
            epee::string_tools::pod_to_hex(genesis_tx.metadata.hash), "TransactionResponse");
        check(v2_genesis["data"]["outputs"][0]["amount_atomic"] == "8800000000000000" &&
              v2_genesis["data"]["inputs"].is_array() && v2_genesis["data"]["inputs"].empty(),
              "V2 genesis precision or empty-array contract failed.");
        const auto raw_genesis = record(source_api, "/api/v2/raw/block/0", "RawResponse");
        cryptonote::blobdata raw_block_blob;
        cryptonote::block decoded_raw_block;
        check(epee::string_tools::parse_hexstr_to_binbuff(
                  raw_genesis["data"]["blob_hex"].get<std::string>(), raw_block_blob) &&
              cryptonote::parse_and_validate_block_from_blob(raw_block_blob, decoded_raw_block) &&
              cryptonote::get_block_hash(decoded_raw_block) == genesis.hash,
              "V2 raw block bytes failed native hash roundtrip.");
        record(source_api, "/api/v2/raw/transaction/" +
            epee::string_tools::pod_to_hex(genesis_tx.metadata.hash), "RawResponse");
        expect_failure([&] { source_blocks.list(0); }, QueryError::invalid);
        expect_failure([&] { source_blocks.list(21); }, QueryError::invalid);
        for (const std::string cursor : std::vector<std::string>{"x", "0." + std::string(64, '0') + ".0",
             "18446744073709551616." + std::string(64, '0') + ".0", "1." + std::string(64, '0') + ".00"})
            expect_failure([&] { source_blocks.list(1, cursor); }, QueryError::invalid);
        expect_failure([&] { source_blocks.get("1"); }, QueryError::missing);
        expect_failure([&] { source_blocks.get("18446744073709551616"); }, QueryError::invalid);
        expect_failure([&] { source_blocks.get("-1"); }, QueryError::invalid);
        expect_failure([&] { source_transactions.get("invalid"); }, QueryError::invalid);
        expect_failure([&] { source_transactions.get(std::string(64, '0')); }, QueryError::missing);
        xmreg::MicroCore wrong_network;
        check(!wrong_network.init(argv[1], cryptonote::TESTNET, true), "Wrong-network database accepted.");

        // Native storage transitions in a separate disposable DB: no PoW/consensus claim.
        const auto path = boost::filesystem::path(argv[1]).parent_path() / "service-storage";
        boost::filesystem::create_directory(path);
        cryptonote::BlockchainLMDB writer;
        writer.open(path.string(), 0);
        cryptonote::HardFork hard_fork(writer, 1, 0);
        hard_fork.init();
        writer.set_hard_fork(&hard_fork);
        writer.add_block(genesis.block, genesis.size, 1, genesis_tx.metadata.output_atoms,
                         std::vector<cryptonote::transaction>{});
        xmreg::MicroCore reader;
        check(reader.init(path.string(), cryptonote::MAINNET, true), "Storage reader initialization failed.");
        QueryContext context(reader);
        BlockService blocks(context);
        TransactionService transactions(context);
        NetworkService network(context);
        LegacyJson legacy(blocks, transactions, true, "mainnet");
        ApiV2 v2(blocks, transactions, network, true, "mainnet", xmreg::json::object());
        ApiRouter api(legacy, v2);
        cryptonote::txpool_tx_meta_t meta{};
        meta.receive_time = 123456789; meta.last_relayed_time = 987654321;
        writer.block_txn_start(false); writer.add_txpool_tx(ordinary, meta); writer.block_txn_stop();
        auto pooled = transactions.get(ordinary_hash, false);
        check(pooled.in_pool && pooled.confirmations == 0 && pooled.timestamp == 0,
              "Pool provenance or local timestamp policy failed.");
        const auto pooled_json = record(api, "/api/v2/transactions/" + ordinary_hash, "TransactionResponse");
        check(pooled_json["data"]["inclusion"]["timestamp_unix"].is_null() &&
              pooled_json["data"]["inclusion"]["block_height"].is_null() &&
              pooled_json["data"]["fee_atomic"] == "30000000" &&
              pooled_json["data"]["outputs"][0]["amount_atomic"].is_null(),
              "V2 pool privacy, fee or hidden-output contract failed.");
        const auto raw_pool = record(api, "/api/v2/raw/transaction/" + ordinary_hash, "RawResponse");
        check(raw_pool["data"]["blob_hex"] == epee::string_tools::buff_to_hex_nodelimer(ordinary_blob),
              "V2 raw RingCT bytes changed.");
        writer.block_txn_start(false); writer.remove_txpool_tx(ordinary_metadata.hash); writer.block_txn_stop();
        expect_failure([&] { transactions.get(ordinary_hash); }, QueryError::missing);

        cryptonote::block historical;
        check(cryptonote::parse_and_validate_block_from_blob(fixture_blob("mainnet-block-1.hex"), historical),
              "Historical block parse failed.");
        check(epee::string_tools::pod_to_hex(cryptonote::get_block_hash(historical)) ==
              "82e8f378ea29d152146b6317903249751b809e97c0b6655f86e120b9de95c38a", "Historical hash mismatch.");
        writer.add_block(historical, cryptonote::get_object_blobsize(historical), 2, 8800000000000001ULL,
                         std::vector<cryptonote::transaction>{});
        auto old_result = blocks.get("1");
        check(old_result.block.miner_tx.version == 2 && old_result.chain_height == 2,
              "Historical version-2 coinbase failed.");
        const auto anchored = blocks.list(1);
        check(anchored.items.size() == 1 && anchored.items[0].hash == old_result.hash &&
              !anchored.next_cursor.empty(), "Native first page failed.");
        check(blocks.list(1, anchored.next_cursor).items[0].height == 0 &&
              blocks.list(1, anchored.next_cursor).next_cursor.empty(), "Native final page failed.");
        record(api, "/api/v2/blocks?limit=1", "BlockPageResponse");
        record(api, "/api/v2/blocks?cursor=" + anchored.next_cursor, "BlockPageResponse");
        auto appended = historical;
        appended.prev_id = old_result.hash; appended.nonce += 10;
        appended.timestamp = historical.timestamp - 30;
        boost::get<cryptonote::txin_gen>(appended.miner_tx.vin[0]).height = 2;
        appended.miner_tx.invalidate_hashes(); appended.invalidate_hashes();
        writer.add_block(appended, cryptonote::get_object_blobsize(appended), 3, 8800000000000002ULL,
                         std::vector<cryptonote::transaction>{});
        const auto interval_anchor = epee::string_tools::pod_to_hex(cryptonote::get_block_hash(appended));
        const auto window = blocks.intervals(3600, interval_anchor);
        check(window.points.size() == 1 && window.points[0].height == 2 &&
              window.points[0].seconds == "-30" && window.points[0].previous_timestamp == historical.timestamp,
              "Native negative timestamp difference was changed or hidden.");
        const auto limited_intervals = blocks.intervals(2592000, interval_anchor, 1);
        check(limited_intervals.scanned_count == 1 && limited_intervals.scanned_from_height == 2 && limited_intervals.history_limited,
              "Native interval history bound failed.");
        check(blocks.intervals(86400, epee::string_tools::pod_to_hex(old_result.hash)).points.empty(),
              "Append changed an older interval anchor.");
        record(api, "/api/v2/block-intervals?window=1h&anchor=" + interval_anchor, "BlockIntervalsResponse");
        const auto preserved_page = blocks.list(1, anchored.next_cursor);
        check(preserved_page.anchor_height == 1 && preserved_page.chain_height == 3 &&
              preserved_page.items[0].height == 0, "Append moved the anchored page.");
        cryptonote::block popped; std::vector<cryptonote::transaction> popped_txs;
        writer.pop_block(popped, popped_txs); // Remove synthetic appended block.
        expect_failure([&] { blocks.intervals(3600, interval_anchor); }, QueryError::chain_changed);
        check(api.get("/api/v2/block-intervals?anchor=" + interval_anchor).status == 409,
              "Removed interval anchor did not return 409.");
        writer.pop_block(popped, popped_txs);
        expect_failure([&] { blocks.list(1, anchored.next_cursor); }, QueryError::chain_changed);
        check(api.get("/api/v2/blocks?cursor=" + anchored.next_cursor).status == 409,
              "V2 removed anchor did not return 409.");
        expect_failure([&] { blocks.get("1"); }, QueryError::missing);
        check(old_result.hash == cryptonote::get_block_hash(historical), "Owned result changed after reorg.");
        auto synthetic = historical;
        synthetic.nonce += 1;
        synthetic.tx_hashes.push_back(ordinary_metadata.hash);
        synthetic.invalidate_hashes();
        writer.add_block(synthetic, cryptonote::get_object_blobsize(synthetic) + ordinary_blob.size(), 2,
                         8800000000000001ULL, {ordinary});
        check(!transactions.get(ordinary_hash, false).in_pool &&
              transactions.get(ordinary_hash, false).confirmations == 1, "Confirmed provenance failed.");
        check(blocks.get("1").transactions.size() == 2, "Block transaction snapshot failed.");
        expect_failure([&] { blocks.list(1, anchored.next_cursor); }, QueryError::chain_changed);
        record(api, "/api/v2/network", "NetworkResponse");
        record(api, "/api/v2/blocks/1", "BlockResponse");
        record(api, "/api/v2/transactions/" + ordinary_hash, "TransactionResponse");
        record(api, "/api/v2/raw/block/1", "RawResponse");
        // Synthetic public ring references exercise native output and originating-time reads.
        auto ring_tx = ordinary;
        auto& ring_input = boost::get<cryptonote::txin_to_key>(ring_tx.vin[0]);
        ring_input.amount = 0;
        // Keep native RingCT signature dimensions intact. Repeated public offsets
        // exercise lookups only; this container is not consensus/signature valid.
        ring_input.key_offsets.assign(ring_input.key_offsets.size(), 0);
        ring_tx.invalidate_hashes();
        writer.block_txn_start(false); writer.add_txpool_tx(ring_tx, meta); writer.block_txn_stop();
        const auto ring_id = epee::string_tools::pod_to_hex(cryptonote::get_transaction_hash(ring_tx));
        check(ring_id != std::string(64, '0'), "Synthetic native ring fixture serialization failed.");
        const auto ring_json = record(api, "/api/v2/transactions/" + ring_id, "TransactionResponse");
        check(ring_json["data"]["inputs"][0]["ring_candidates"][0]["block_height"] == "0" &&
              ring_json["data"]["inputs"][0]["ring_candidates"][0]["timestamp_unix"] == "0" &&
              ring_json["data"]["inputs"][0]["ring_candidates"][0]["public_key"] ==
                epee::string_tools::pod_to_hex(genesis_tx.metadata.outputs[0].first.key),
              "Native public ring reference metadata failed.");
        writer.block_txn_start(false); writer.remove_txpool_tx(cryptonote::get_transaction_hash(ring_tx));
        writer.block_txn_stop();
        // Native extra helpers preserve a present all-zero ID, distinct from absence.
        for (bool short_id : {false, true}) {
            auto payment_tx = ordinary; payment_tx.extra.clear();
            std::string nonce;
            if (short_id) cryptonote::set_encrypted_payment_id_to_tx_extra_nonce(nonce, crypto::hash8{});
            else cryptonote::set_payment_id_to_tx_extra_nonce(nonce, crypto::hash{});
            check(cryptonote::add_extra_nonce_to_tx_extra(payment_tx.extra, nonce), "Native extra construction failed.");
            check(cryptonote::add_additional_tx_pub_keys_to_extra(payment_tx.extra,
                  {genesis_tx.metadata.public_key}), "Native additional-key construction failed.");
            payment_tx.invalidate_hashes();
            writer.block_txn_start(false); writer.add_txpool_tx(payment_tx, meta); writer.block_txn_stop();
            const auto id = epee::string_tools::pod_to_hex(cryptonote::get_transaction_hash(payment_tx));
            const auto value = record(api, "/api/v2/transactions/" + id, "TransactionResponse");
            check(value["data"][short_id ? "payment_id8" : "payment_id"] ==
                  std::string(short_id ? 16 : 64, '0'), "Present zero-valued payment ID was lost.");
            check(value["data"]["additional_public_keys"][0] ==
                  epee::string_tools::pod_to_hex(genesis_tx.metadata.public_key), "Native additional key was lost.");
            writer.block_txn_start(false); writer.remove_txpool_tx(cryptonote::get_transaction_hash(payment_tx));
            writer.block_txn_stop();
        }
        // An intentionally oversized native container tests resource rejection,
        // without claiming this pool/storage fixture is consensus-valid.
        auto oversized = ordinary;
        check(cryptonote::add_additional_tx_pub_keys_to_extra(oversized.extra,
              std::vector<crypto::public_key>(131072, genesis_tx.metadata.public_key)),
              "Oversized native extra fixture construction failed.");
        oversized.invalidate_hashes();
        const auto oversized_hash = cryptonote::get_transaction_hash(oversized);
        writer.block_txn_start(false); writer.add_txpool_tx(oversized, meta); writer.block_txn_stop();
        check(transactions.get(epee::string_tools::pod_to_hex(oversized_hash), false).metadata.size > 4 * 1024 * 1024,
              "Oversized native fixture was not readable before API resource rejection.");
        const auto limited = api.get("/api/v2/raw/transaction/" + epee::string_tools::pod_to_hex(oversized_hash));
        check(limited.status == 503 && limited.body["error"]["code"] == "unavailable",
              "Oversized native raw object was not rejected.");
        api_cases.push_back({{"schema", "ErrorResponse"}, {"body", limited.body}});
        writer.block_txn_start(false); writer.remove_txpool_tx(oversized_hash); writer.block_txn_stop();
        std::atomic<bool> success{true};
        auto concurrent = [&] {
            try { for (int i = 0; i < 20; ++i) check(blocks.get("1").chain_height == 2, "Concurrent read failed."); }
            catch (...) { success = false; }
        };
        std::thread first(concurrent), second(concurrent); first.join(); second.join();
        check(success.load(), "Native concurrent queries failed.");
        reader.get_core().get_db().close();
        expect_failure([&] { blocks.get("0"); }, QueryError::database);
        expect_failure([&] { network.get(); }, QueryError::database);
        expect_failure([&] { blocks.list(); }, QueryError::database);
        const auto unavailable = api.get("/api/v2/network");
        check(unavailable.status == 503, "V2 native failure did not return 503.");
        api_cases.push_back({{"schema", "ErrorResponse"}, {"body", unavailable.body}});
        std::ofstream cases((path.parent_path() / "v2-native-responses.json").string());
        cases << api_cases.dump(); cases.close();
        writer.close();
        std::cout << "Native metadata, pool/confirmation, historical storage reorg, ownership, concurrency, and errors passed.\n";
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n'; return 1;
    }
}
