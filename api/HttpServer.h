#pragma once
#include <memory>
#include <string>

namespace ryo_explorer {
class ApiRouter;
class HttpServer {
    class Implementation;
    std::unique_ptr<Implementation> implementation_;
public:
    HttpServer(ApiRouter& api, const std::string& address, unsigned short port);
    ~HttpServer();
    void run();
};
}
