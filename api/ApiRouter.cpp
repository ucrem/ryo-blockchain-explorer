#include "ApiRouter.h"

namespace ryo_explorer {
bool ApiRouter::is_v2(const std::string& target) {
    return target == "/api/v2" || target.compare(0, 8, "/api/v2/") == 0;
}
bool ApiRouter::valid_target(const std::string& target) const {
    if (target.empty() || target[0] != '/' || target.size() > 1024 ||
        target.find_first_of("%#") != std::string::npos) return false;
    const auto question = target.find('?');
    if (is_v2(target)) {
        for (unsigned char c : target) if (c < 33 || c > 126) return false;
        if (question != std::string::npos)
            return v2_.enabled() && (target.substr(0, question) == "/api/v2/blocks" ||
                                    target.substr(0, question) == "/api/v2/block-intervals" ||
                                    target.substr(0, question) == "/api/v2/mempool");
    } else if (question != std::string::npos) return false;
    return true;
}
ApiResponse ApiRouter::failure(const std::string& target, unsigned status, const std::string& message) {
    if (is_v2(target)) return ApiV2::error(status, message);
    if (status == 400 || status == 405)
        return {status, {{"status", "fail"}, {"data", {{"title", message}}}}};
    return {status, {{"status", "error"}, {"message", message}}};
}
ApiResponse ApiRouter::get(const std::string& target) {
    if (!valid_target(target)) return failure(target, 400, "Invalid request target.");
    return is_v2(target) ? v2_.get(target) : legacy_.get(target);
}
}
