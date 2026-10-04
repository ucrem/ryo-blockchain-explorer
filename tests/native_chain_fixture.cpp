#include "MicroCore.h"
#include "MempoolStatus.h"
#include "CurrentBlockchainStatus.h"

#include <iostream>

int main(int argc, char** argv)
{
    if (argc != 3)
    {
        std::cerr << "Expected a disposable mainnet LMDB path and loopback RPC URL.\n";
        return 2;
    }
    xmreg::MicroCore core;
    if (!core.init(argv[1], cryptonote::MAINNET)) return 1;
    if (!core.get_core().get_db().is_read_only()) return 1;
    if (core.get_core().get_current_blockchain_height() != 1) return 1;

    cryptonote::block block;
    if (!core.get_block_by_height(0, block)) return 1;
    if (epee::string_tools::pod_to_hex(cryptonote::get_block_hash(block)) !=
        "6eb04b6b8c68049a76206fe2805ede5f7465c03b7112850d3262a067b9914dac") return 1;
    cryptonote::transaction tx;
    if (!core.get_tx("ef9edde12f78ce1776ce1886b3e448d8f3575bc25111231370989baeae4a2d88", tx)) return 1;
    if (!cryptonote::is_coinbase(tx) || tx.vout.size() != 1) return 1;
    const auto& output_key = boost::get<cryptonote::txout_to_key>(tx.vout[0].target).key;
    cryptonote::tx_out output;
    size_t index = 99;
    if (!core.find_output_in_tx(tx, output_key, output, index) || index != 0) return 1;
    crypto::hash found_hash;
    cryptonote::transaction found_tx;
    if (!core.get_tx_hash_from_output_pubkey(output_key, 0, found_hash, found_tx)) return 1;
    if (epee::string_tools::pod_to_hex(found_hash) !=
        "ef9edde12f78ce1776ce1886b3e448d8f3575bc25111231370989baeae4a2d88") return 1;
    if (core.get_tx("invalid", found_tx)) return 1;

    xmreg::MempoolStatus::set_blockchain_variables(&core, &core.get_core());
    xmreg::MempoolStatus::deamon_url = argv[2];
    if (!xmreg::MempoolStatus::read_mempool()) return 1;
    if (!xmreg::MempoolStatus::get_mempool_txs().empty()) return 1;
    if (!xmreg::MempoolStatus::read_network_info()) return 1;
    const auto network = xmreg::MempoolStatus::current_network_info.load();
    if (network.height != 1 || !network.current || network.nettype != cryptonote::MAINNET) return 1;

    xmreg::CurrentBlockchainStatus::set_blockchain_variables(&core, &core.get_core());
    const auto emission = xmreg::CurrentBlockchainStatus::calculate_emission_in_blocks(0, 1);
    if (emission.coinbase != 99948553572999ULL || emission.fee != 0 || emission.blk_no != 1) return 1;
    std::cout << "Native LMDB block/transaction/output lookup, empty pool, RPC, and genesis emission passed.\n";
    return 0;
}
