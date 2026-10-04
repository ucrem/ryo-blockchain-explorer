#include "BlockService.h"
#include <limits>

namespace ryo_explorer {
BlockResult BlockService::get(const std::string& id) {
    bool by_hash = id.size() == 64;
    uint64_t height = 0;
    crypto::hash hash{};
    if (by_hash) hash = parse_hash(id);
    else {
        if (id.empty() || id.size() > 20)
            throw QueryFailure(QueryError::invalid, "Invalid block height or hash.");
        for (const char c : id) {
            if (c < '0' || c > '9' || height > (std::numeric_limits<uint64_t>::max() - (c-'0')) / 10)
                throw QueryFailure(QueryError::invalid, "Invalid block height.");
            height = height * 10 + (c-'0');
        }
    }
    try {
        QueryContext::Read read(context_);
        auto& db = read.db();
        BlockResult result;
        result.chain_height = db.height();
        if (by_hash && !db.block_exists(hash, &height))
            throw QueryFailure(QueryError::missing, "Block not found.");
        if (height >= result.chain_height)
            throw QueryFailure(QueryError::missing, "Block height is outside the chain.");
        result.height = height;
        result.hash = db.get_block_hash_from_height(height);
        result.size = db.get_block_size(height);
        if (result.size > 8 * 1024 * 1024)
            throw QueryFailure(QueryError::limit, "Block exceeds the response resource limit.");
        result.block = db.get_block_from_height(height);
        if (cryptonote::get_block_hash(result.block) != result.hash)
            throw QueryFailure(QueryError::chain_changed, "Block snapshot is inconsistent.");
        result.transactions.push_back(result.block.miner_tx);
        for (const auto& tx_hash : result.block.tx_hashes) result.transactions.push_back(db.get_tx(tx_hash));
        for (const auto& tx : result.transactions) result.metadata.push_back(transaction_metadata(tx));
        return result;
    } catch (const QueryFailure&) { throw; }
      catch (const std::exception&) { throw QueryFailure(QueryError::database, "Native database read failed."); }
}
}
