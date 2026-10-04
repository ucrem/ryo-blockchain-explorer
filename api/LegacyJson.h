#pragma once
#include "services/BlockService.h"
#include "services/TransactionService.h"
#include "ApiResponse.h"

namespace ryo_explorer {
class LegacyJson {
    BlockService& blocks_;
    TransactionService& transactions_;
    bool enabled_;
    std::string network_;
public:
    LegacyJson(BlockService& blocks, TransactionService& transactions, bool enabled,
               std::string network) : blocks_(blocks), transactions_(transactions),
               enabled_(enabled), network_(std::move(network)) {}
    ApiResponse get(const std::string& target);
};
}
