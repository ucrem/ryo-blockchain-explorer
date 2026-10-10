#include "ReceiveVerifier.h"
#include <cstdlib>
#include <cstring>
#include "memwipe.h"

extern "C" char* ryo_receive_request(const char* request) {
    const auto length = strnlen(request, 8 * 1024 * 1024 + 4097);
    std::string input(request, length);
    struct Wipe { std::string& text; ~Wipe() { if (!text.empty()) memwipe(&text[0], text.size()); } };
    Wipe wipe_input{input};
    auto result = receive_verifier_request(input);
    Wipe wipe_result{result};
    auto* out = static_cast<char*>(std::malloc(result.size() + 1));
    if (!out) return nullptr;
    std::memcpy(out, result.c_str(), result.size() + 1);
    return out;
}
extern "C" void ryo_wipe(void* buffer, unsigned size) { memwipe(buffer, size); }
