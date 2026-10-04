#pragma once
#include "ApiResponse.h"
#include "services/BlockService.h"
#include "services/TransactionService.h"
#include "services/NetworkService.h"

namespace ryo_explorer {
class ApiV2 {
    BlockService& blocks_;
    TransactionService& transactions_;
    NetworkService& network_;
    bool enabled_;
    std::string network_name_;
    xmreg::json specification_;
    xmreg::json meta(uint64_t height) const;
public:
    ApiV2(BlockService& blocks, TransactionService& transactions, NetworkService& network,
          bool enabled, std::string network_name, xmreg::json specification)
        : blocks_(blocks), transactions_(transactions), network_(network), enabled_(enabled),
          network_name_(std::move(network_name)), specification_(std::move(specification)) {}
    bool enabled() const { return enabled_; }
    ApiResponse get(const std::string& target);
    static ApiResponse error(unsigned status, const std::string& message);
};
}
