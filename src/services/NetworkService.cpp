#include "NetworkService.h"

namespace ryo_explorer {
namespace {
void add_checked(uint64_t& total, uint64_t value) {
    if (value > UINT64_MAX - total) throw QueryFailure(QueryError::limit, "Native quantity exceeds uint64.");
    total += value;
}
template<cryptonote::network_type Network>
uint64_t dev_issued(uint64_t height, const std::function<bool(uint64_t)>& active) {
    using config = cryptonote::config<Network>;
    uint64_t total = 0;
    // At most the native configured payout periods; no full-chain scan or emission cache.
    for (uint64_t period = 0; period < config::DEV_FUND_LENGTH; ++period) {
        const uint64_t payout_height = config::DEV_FUND_START + period * config::DEV_FUND_PERIOD;
        if (payout_height > height) break;
        uint64_t amount = 0;
        if (active(payout_height) && cryptonote::get_dev_fund_amount<Network>(payout_height, amount))
            add_checked(total, amount);
    }
    return total;
}
}
uint64_t native_dev_fund_issued(cryptonote::network_type network, uint64_t height,
    const std::function<bool(uint64_t)>& active) {
    switch (network) {
        case cryptonote::MAINNET: return dev_issued<cryptonote::MAINNET>(height, active);
        case cryptonote::TESTNET: return dev_issued<cryptonote::TESTNET>(height, active);
        case cryptonote::STAGENET: return dev_issued<cryptonote::STAGENET>(height, active);
        default: throw QueryFailure(QueryError::invalid, "Unsupported native network.");
    }
}
NetworkSnapshot NetworkService::get() {
    try {
        QueryContext::Read read(context_);
        auto& db = read.db();
        NetworkSnapshot result;
        result.chain_height = db.height();
        if (result.chain_height == 0)
            throw QueryFailure(QueryError::database, "Native chain is empty.");
        const auto height = result.chain_height - 1;
        const auto tip_block = db.get_block_from_height(height);
        result.tip = block_summary(tip_block, db.get_block_hash_from_height(height), height, db.get_block_size(height));
        for (const auto& output : tip_block.miner_tx.vout) add_checked(result.tip_coinbase_atomic, output.amount);
        result.issued_atomic = db.get_block_already_generated_coins(height);
        result.issued_complete = result.issued_atomic < MONEY_SUPPLY;
        if (result.issued_complete) add_checked(result.issued_atomic, native_dev_fund_issued(context_.network(), height,
            [&](uint64_t payout) { return db.get_hard_fork_version(payout) >=
                cryptonote::get_fork_v(context_.network(), cryptonote::FORK_DEV_FUND); }));
        result.median_sample_blocks = static_cast<unsigned>(std::min<uint64_t>(100, result.chain_height));
        std::vector<uint64_t> sizes;
        for (uint64_t i = result.chain_height - result.median_sample_blocks; i < result.chain_height; ++i)
            sizes.push_back(db.get_block_size(i));
        result.median_size = epee::misc_utils::median(sizes);
        const auto tx_count = db.get_tx_count();
        if (tx_count < result.chain_height) throw QueryFailure(QueryError::database, "Native transaction count is inconsistent.");
        result.confirmed_transactions = tx_count - result.chain_height;
        result.pool_complete = db.get_txpool_tx_count(true) <= 10000;
        if (result.pool_complete) {
            result.pool_transactions = db.get_txpool_tx_count(false);
            uint64_t seen = 0;
            const bool complete = db.for_all_txpool_txes([&](const crypto::hash&, const cryptonote::txpool_tx_meta_t& meta,
                const cryptonote::blobdata*) {
                if (++seen > 10000) return false;
                add_checked(result.pool_size, meta.blob_size);
                return true;
            }, false, false);
            result.pool_complete = complete && seen == result.pool_transactions;
        }
        result.tip_difficulty = db.get_block_difficulty(result.chain_height - 1);
        return result;
    } catch (const QueryFailure&) { throw; }
      catch (const std::exception&) { throw QueryFailure(QueryError::database, "Native database read failed."); }
}
}
