#pragma once
#include "QueryContext.h"
#include "TransactionMetadata.h"

namespace ryo_explorer {
struct BlockResult {
    cryptonote::block block;
    crypto::hash hash{};
    uint64_t height = 0, chain_height = 0, size = 0;
    std::vector<cryptonote::transaction> transactions;
    std::vector<TransactionMetadata> metadata;
};
class BlockService {
    QueryContext& context_;
public:
    explicit BlockService(QueryContext& context) : context_(context) {}
    BlockResult get(const std::string& height_or_hash);
};
}
