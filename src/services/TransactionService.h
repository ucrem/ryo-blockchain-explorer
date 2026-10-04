#pragma once
#include "QueryContext.h"
#include "TransactionMetadata.h"

namespace ryo_explorer {
struct TransactionResult {
    cryptonote::transaction transaction;
    TransactionMetadata metadata;
    uint64_t chain_height = 0, block_height = 0, confirmations = 0, timestamp = 0;
    bool in_pool = false;
    // Each input's native ring candidates; never identifies the real spend.
    std::vector<std::vector<cryptonote::output_data_t>> ring_members;
    // Public originating block times, sampled inside the same native read scope.
    std::vector<std::vector<uint64_t>> ring_timestamps;
};
class TransactionService {
    QueryContext& context_;
public:
    explicit TransactionService(QueryContext& context) : context_(context) {}
    TransactionResult get(const std::string& hash, bool include_ring_members = true);
};
}
