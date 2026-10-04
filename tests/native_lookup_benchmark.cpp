// Read-only diagnostics for the imported implementations, using an offline genesis DB.
#include "MicroCore.h"
#include "MempoolStatus.h"
#include "CurrentBlockchainStatus.h"
#include "LegacyJson.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <iostream>
#include <stdexcept>
#include <vector>

namespace
{
constexpr size_t samples = 100;
constexpr size_t warmup = 10;

template <typename Operation>
xmreg::json measure(Operation operation)
{
    for (size_t i = 0; i < warmup; ++i)
        if (!operation()) throw std::runtime_error("Warmup operation failed.");
    std::vector<double> timings;
    timings.reserve(samples);
    for (size_t i = 0; i < samples; ++i)
    {
        const auto begin = std::chrono::steady_clock::now();
        const bool success = operation();
        const auto end = std::chrono::steady_clock::now();
        if (!success) throw std::runtime_error("Measured operation failed.");
        timings.push_back(std::chrono::duration<double, std::micro>(end - begin).count());
    }
    std::sort(timings.begin(), timings.end());
    auto percentile = [&](double fraction) {
        return timings.at(static_cast<size_t>(std::ceil(fraction * timings.size())) - 1);
    };
    return xmreg::json {
        {"samples", samples}, {"warmup", warmup},
        {"latency_us", {{"p50", percentile(0.50)}, {"p95", percentile(0.95)},
                        {"p99", percentile(0.99)}, {"min", timings.front()},
                        {"max", timings.back()}}}
    };
}
}

int main(int argc, char** argv)
{
    if (argc != 3)
    {
        std::cerr << "Expected a disposable mainnet genesis LMDB path and loopback RPC URL.\n";
        return 2;
    }
    try
    {
        xmreg::MicroCore core;
        if (!core.init(argv[1], cryptonote::MAINNET)) return 1;
        if (core.get_core().get_current_blockchain_height() != 1) return 1;
        cryptonote::block block;
        if (!core.get_block_by_height(0, block)) return 1;
        const auto block_hash = cryptonote::get_block_hash(block);
        if (epee::string_tools::pod_to_hex(block_hash) !=
            "6eb04b6b8c68049a76206fe2805ede5f7465c03b7112850d3262a067b9914dac") return 1;
        crypto::hash tx_hash;
        if (!xmreg::parse_str_secret_key(
            "ef9edde12f78ce1776ce1886b3e448d8f3575bc25111231370989baeae4a2d88", tx_hash)) return 1;
        cryptonote::transaction tx;
        if (!core.get_tx(tx_hash, tx)) return 1;
        const auto output_key = boost::get<cryptonote::txout_to_key>(tx.vout.at(0).target).key;
        xmreg::MempoolStatus::set_blockchain_variables(&core, &core.get_core());
        xmreg::MempoolStatus::deamon_url = argv[2];
        xmreg::CurrentBlockchainStatus::set_blockchain_variables(&core, &core.get_core());

        xmreg::json queries;
        queries["block.by_height"] = measure([&] { return core.get_block_by_height(0, block); });
        queries["block.by_hash"] = measure([&] {
            return core.get_core().get_block_by_hash(block_hash, block);
        });
        queries["transaction.by_hash"] = measure([&] { return core.get_tx(tx_hash, tx); });
        queries["output.in_known_block"] = measure([&] {
            crypto::hash found;
            return core.get_tx_hash_from_output_pubkey(output_key, 0, found, tx) && found == tx_hash;
        });
        queries["latest.single_block"] = measure([&] {
            const auto height = core.get_core().get_current_blockchain_height();
            return height > 0 && core.get_block_by_height(height - 1, block);
        });
        queries["mempool.empty_refresh"] = measure([&] {
            return xmreg::MempoolStatus::read_mempool() &&
                   xmreg::MempoolStatus::get_mempool_txs().empty();
        });
        queries["emission.genesis_range"] = measure([&] {
            const auto emission = xmreg::CurrentBlockchainStatus::calculate_emission_in_blocks(0, 1);
            return emission.coinbase == 99948553572999ULL && emission.fee == 0 && emission.blk_no == 1;
        });
        queries["network.rpc_refresh"] = measure([&] {
            return xmreg::MempoolStatus::read_network_info() &&
                   xmreg::MempoolStatus::current_network_info.load().height == 1;
        });
        queries["network.cached_snapshot"] = measure([&] {
            const auto info = xmreg::MempoolStatus::current_network_info.load();
            return info.current && info.height == 1;
        });
        ryo_explorer::QueryContext context(core);
        ryo_explorer::BlockService blocks(context);
        ryo_explorer::TransactionService transactions(context);
        ryo_explorer::LegacyJson legacy(blocks, transactions, true, "mainnet");
        const std::string genesis_tx_hash = epee::string_tools::pod_to_hex(tx_hash);
        queries["service.block_snapshot"] = measure([&] {
            return blocks.get("0").chain_height == 1;
        });
        queries["service.transaction_snapshot"] = measure([&] {
            return transactions.get(genesis_tx_hash).confirmations == 1;
        });
        queries["legacy.block_query_and_serialization"] = measure([&] {
            const auto response = legacy.get("/api/block/0");
            return response.status == 200 && response.body["status"] == "success" && !response.body.dump().empty();
        });
        const xmreg::json report {
            {"network", "mainnet"}, {"chain_height", 1},
            {"tip_hash", epee::string_tools::pod_to_hex(block_hash)},
            {"threads", 1}, {"cache", "warm; 10 warmups per operation"},
            {"percentiles", "nearest rank"}, {"queries", queries},
            {"not_measured", {
                {"key_image.lookup", "Genesis has no spent key-image inputs."},
                {"search.dispatch", "The native foundation has no search service."},
                {"mempool.nonempty", "The offline genesis pool is empty."},
                {"full_chain_or_cold_cache", "Requires a representative database and controlled environment."}
            }},
            {"scope", "Genesis diagnostics; not representative mainnet capacity or index justification."}
        };
        std::cout << report.dump(2) << '\n';
    }
    catch (const std::exception& error)
    {
        std::cerr << "Native query diagnostic failed: " << error.what() << '\n';
        return 1;
    }
    return 0;
}
