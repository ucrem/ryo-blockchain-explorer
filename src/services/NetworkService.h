#pragma once
#include "BlockSummary.h"

namespace ryo_explorer {
uint64_t native_dev_fund_issued(cryptonote::network_type network, uint64_t height,
    const std::function<bool(uint64_t)>& active);
struct NetworkSnapshot {
    uint64_t chain_height = 0, tip_difficulty = 0;
    BlockSummary tip;
    uint64_t issued_atomic = 0, tip_coinbase_atomic = 0, median_size = 0;
    uint64_t confirmed_transactions = 0, pool_transactions = 0, pool_size = 0;
    unsigned median_sample_blocks = 0;
    bool issued_complete = true, pool_complete = true;
};
class NetworkService {
    QueryContext& context_;
public:
    explicit NetworkService(QueryContext& context) : context_(context) {}
    NetworkSnapshot get();
};
}
