#pragma once
#include "QueryContext.h"

namespace ryo_explorer {
struct BlockSummary {
    crypto::hash hash{}, previous_hash{}, coinbase_hash{};
    uint64_t height = 0, timestamp = 0, size = 0;
    uint32_t nonce = 0;
    uint8_t major_version = 0, minor_version = 0;
    size_t transaction_count = 0;
};
inline BlockSummary block_summary(const cryptonote::block& block, const crypto::hash& hash,
                                  uint64_t height, uint64_t size) {
    if (cryptonote::get_block_hash(block) != hash)
        throw QueryFailure(QueryError::chain_changed, "Block snapshot is inconsistent.");
    BlockSummary result;
    result.hash = hash; result.previous_hash = block.prev_id;
    result.coinbase_hash = cryptonote::get_transaction_hash(block.miner_tx);
    result.height = height; result.timestamp = block.timestamp; result.size = size;
    result.nonce = block.nonce; result.major_version = block.major_version;
    result.minor_version = block.minor_version;
    result.transaction_count = block.tx_hashes.size() + 1;
    return result;
}
inline BlockSummary read_block_summary(cryptonote::BlockchainDB& db, uint64_t height) {
    return block_summary(db.get_block_from_height(height), db.get_block_hash_from_height(height),
                         height, db.get_block_size(height));
}
inline uint64_t parse_uint64(const std::string& text) {
    if (text.empty() || text.size() > 20 || (text.size() > 1 && text[0] == '0'))
        throw QueryFailure(QueryError::invalid, "Invalid canonical unsigned integer.");
    uint64_t value = 0;
    for (char c : text) {
        if (c < '0' || c > '9' || value > (UINT64_MAX - (c - '0')) / 10)
            throw QueryFailure(QueryError::invalid, "Invalid canonical unsigned integer.");
        value = value * 10 + (c - '0');
    }
    return value;
}
}
