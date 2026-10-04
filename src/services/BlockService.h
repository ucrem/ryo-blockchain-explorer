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
class BlockService {
    QueryContext& context_;
public:
    explicit BlockService(QueryContext& context) : context_(context) {}
    BlockResult get(const std::string& height_or_hash);
    BlockPage list(unsigned limit = 10, const std::string& cursor = "");
};
}
