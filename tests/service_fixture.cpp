#include "services/BlockService.h"
#include "services/TransactionService.h"
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
        auto genesis = source_blocks.get("0");
        check(source_blocks.get(epee::string_tools::pod_to_hex(genesis.hash)).hash == genesis.hash,
              "Height/hash block lookup differs.");
        auto genesis_tx = source_transactions.get(epee::string_tools::pod_to_hex(genesis.metadata[0].hash));
        check(genesis.chain_height == 1 && genesis_tx.confirmations == 1 && genesis_tx.metadata.coinbase &&
              genesis_tx.metadata.output_atoms == 8800000000000000ULL &&
              genesis_tx.metadata.output_amounts_visible, "Genesis metadata failed.");
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
        cryptonote::txpool_tx_meta_t meta{};
        meta.receive_time = 123456789; meta.last_relayed_time = 987654321;
        writer.block_txn_start(false); writer.add_txpool_tx(ordinary, meta); writer.block_txn_stop();
        auto pooled = transactions.get(ordinary_hash, false);
        check(pooled.in_pool && pooled.confirmations == 0 && pooled.timestamp == 0,
              "Pool provenance or local timestamp policy failed.");
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
        cryptonote::block popped; std::vector<cryptonote::transaction> popped_txs;
        writer.pop_block(popped, popped_txs);
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
        std::atomic<bool> success{true};
        auto concurrent = [&] {
            try { for (int i = 0; i < 20; ++i) check(blocks.get("1").chain_height == 2, "Concurrent read failed."); }
            catch (...) { success = false; }
        };
        std::thread first(concurrent), second(concurrent); first.join(); second.join();
        check(success.load(), "Native concurrent queries failed.");
        reader.get_core().get_db().close();
        expect_failure([&] { blocks.get("0"); }, QueryError::database);
        writer.close();
        std::cout << "Native metadata, pool/confirmation, historical storage reorg, ownership, concurrency, and errors passed.\n";
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n'; return 1;
    }
}
