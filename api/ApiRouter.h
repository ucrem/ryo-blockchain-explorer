#pragma once
#include "LegacyJson.h"
#include "ApiV2.h"

namespace ryo_explorer {
class ApiRouter {
    LegacyJson& legacy_;
    ApiV2& v2_;
public:
    ApiRouter(LegacyJson& legacy, ApiV2& v2) : legacy_(legacy), v2_(v2) {}
    static bool is_v2(const std::string& target);
    bool valid_target(const std::string& target) const;
    static ApiResponse failure(const std::string& target, unsigned status, const std::string& message);
    ApiResponse get(const std::string& target);
};
}
