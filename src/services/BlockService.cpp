#include "BlockService.h"
#include <limits>
#include <algorithm>

namespace ryo_explorer {
BlockIntervalWindow BlockService::intervals(unsigned seconds, const std::string& anchor,
                                           unsigned scan_limit) {
    if ((seconds != 3600 && seconds != 86400 && seconds != 604800 && seconds != 2592000) ||
        scan_limit == 0 || scan_limit > 50000)
        throw QueryFailure(QueryError::invalid, "Invalid interval window.");
    crypto::hash requested{};
    if (!anchor.empty()) requested = parse_hash(anchor);
    try {
        QueryContext::Read read(context_);
        auto& db = read.db();
        BlockIntervalWindow result;
        result.chain_height = db.height();
        if (!result.chain_height) throw QueryFailure(QueryError::database, "Native chain is empty.");
        result.anchor_height = result.chain_height - 1;
        if (!anchor.empty() && !db.block_exists(requested, &result.anchor_height))
            throw QueryFailure(QueryError::chain_changed, "Interval anchor changed.");
        result.anchor_hash = db.get_block_hash_from_height(result.anchor_height);
        result.anchor_timestamp = db.get_block_timestamp(result.anchor_height);
        result.window_seconds = seconds;
        result.start_timestamp = result.anchor_timestamp > seconds ? result.anchor_timestamp - seconds : 0;
        result.scanned_from_height = result.anchor_height > scan_limit ? result.anchor_height - scan_limit + 1 : 1;
        if (!result.anchor_height) result.scanned_from_height = 0;
        // Timestamps need not be monotonic. Scan the bounded height range in full,
        // filtering by the newer block's time, without a timestamp binary search.
        uint64_t previous = db.get_block_timestamp(result.scanned_from_height ? result.scanned_from_height - 1 : 0);
        for (uint64_t height = result.scanned_from_height; height <= result.anchor_height && height != 0; ++height) {
            const auto current = db.get_block_timestamp(height);
            ++result.scanned_count;
            if (current && (!result.oldest_timestamp || current < result.oldest_timestamp))
                result.oldest_timestamp = current;
            if (current && previous && current >= result.start_timestamp && current <= result.anchor_timestamp) {
                const auto delta = current >= previous ? std::to_string(current - previous) :
                    "-" + std::to_string(previous - current);
                result.points.push_back({height, current, previous, delta});
            }
            previous = current;
        }
        result.history_limited = result.scanned_from_height > 1 &&
            result.oldest_timestamp >= result.start_timestamp;
        return result;
    } catch (const QueryFailure&) { throw; }
      catch (const std::exception&) { throw QueryFailure(QueryError::database, "Native timestamp read failed."); }
}
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
