#pragma once
#include <memory>
#include <string>

namespace ryo_explorer {
class LegacyJson;
class HttpServer {
    class Implementation;
    std::unique_ptr<Implementation> implementation_;
public:
    HttpServer(LegacyJson& api, const std::string& address, unsigned short port);
    ~HttpServer();
    void run();
};
}
