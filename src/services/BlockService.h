#pragma once
#include "QueryContext.h"
#include "TransactionMetadata.h"
#include "BlockSummary.h"

namespace ryo_explorer {
struct BlockResult {
    cryptonote::block block;
    crypto::hash hash{};
    uint64_t height = 0, chain_height = 0, size = 0;
    std::vector<cryptonote::transaction> transactions;
    std::vector<TransactionMetadata> metadata;
};
struct BlockPage {
    std::vector<BlockSummary> items;
    uint64_t chain_height = 0, anchor_height = 0;
    crypto::hash anchor_hash{};
    std::string next_cursor;
};
struct BlockInterval {
    uint64_t height = 0, timestamp = 0, previous_timestamp = 0;
    std::string seconds;
};
struct BlockIntervalWindow {
    uint64_t chain_height = 0, anchor_height = 0, anchor_timestamp = 0;
    uint64_t start_timestamp = 0, scanned_from_height = 0, oldest_timestamp = 0;
    crypto::hash anchor_hash{};
    unsigned window_seconds = 0, scanned_count = 0;
    bool history_limited = false;
    std::vector<BlockInterval> points;
};
class BlockService {
    QueryContext& context_;
public:
    explicit BlockService(QueryContext& context) : context_(context) {}
    BlockResult get(const std::string& height_or_hash);
    BlockPage list(unsigned limit = 10, const std::string& cursor = "");
    BlockIntervalWindow intervals(unsigned window_seconds, const std::string& anchor_hash = "",
                                  unsigned scan_limit = 50000);
};
}
