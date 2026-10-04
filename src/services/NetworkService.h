#pragma once
#include "BlockSummary.h"

namespace ryo_explorer {
struct NetworkSnapshot {
    uint64_t chain_height = 0, tip_difficulty = 0;
    BlockSummary tip;
};
class NetworkService {
    QueryContext& context_;
public:
    explicit NetworkService(QueryContext& context) : context_(context) {}
    NetworkSnapshot get();
};
}
