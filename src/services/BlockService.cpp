#include "BlockService.h"
#include <limits>

namespace ryo_explorer {
BlockPage BlockService::list(unsigned limit, const std::string& cursor) {
    if (limit == 0 || limit > 20)
        throw QueryFailure(QueryError::invalid, "Limit must be between 1 and 20.");
    uint64_t anchor = 0, next = 0;
    crypto::hash hash{};
    if (!cursor.empty()) {
        const auto first = cursor.find('.'), last = cursor.rfind('.');
        if (cursor.size() > 106 || first == std::string::npos || first == last ||
            cursor.find('.', first + 1) != last)
            throw QueryFailure(QueryError::invalid, "Invalid block cursor.");
        anchor = parse_uint64(cursor.substr(0, first));
        hash = parse_hash(cursor.substr(first + 1, last - first - 1));
        // Server-generated cursors use lowercase and descend strictly below the anchor.
        if (epee::string_tools::pod_to_hex(hash) != cursor.substr(first + 1, last - first - 1))
            throw QueryFailure(QueryError::invalid, "Invalid block cursor hash.");
        next = parse_uint64(cursor.substr(last + 1));
        if (next >= anchor) throw QueryFailure(QueryError::invalid, "Invalid cursor position.");
    }
    try {
        QueryContext::Read read(context_);
        auto& db = read.db();
        BlockPage result;
        result.chain_height = db.height();
        if (result.chain_height == 0)
            throw QueryFailure(QueryError::database, "Native chain is empty.");
        if (cursor.empty()) {
            anchor = next = result.chain_height - 1;
            hash = db.get_block_hash_from_height(anchor);
        } else if (anchor >= result.chain_height || db.get_block_hash_from_height(anchor) != hash) {
            throw QueryFailure(QueryError::chain_changed, "Pagination anchor changed.");
        }
        result.anchor_height = anchor; result.anchor_hash = hash;
        for (unsigned i = 0; i < limit; ++i) {
            result.items.push_back(read_block_summary(db, next));
            if (next == 0) return result;
            --next;
        }
        result.next_cursor = std::to_string(anchor) + "." + epee::string_tools::pod_to_hex(hash) + "." +
            std::to_string(next);
        return result;
    } catch (const QueryFailure&) { throw; }
      catch (const std::exception&) { throw QueryFailure(QueryError::database, "Native database read failed."); }
}
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
