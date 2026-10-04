#include "HttpServer.h"
#include "ApiRouter.h"
#include <boost/asio.hpp>
#include <boost/beast.hpp>
#include <set>
#include <csignal>

namespace ryo_explorer {
namespace asio = boost::asio;
namespace beast = boost::beast;
namespace http = beast::http;
using tcp = asio::ip::tcp;

class HttpServer::Implementation {
    asio::io_context io_;
    tcp::acceptor acceptor_;
    asio::signal_set signals_;
    asio::thread_pool queries_{2};
    ApiRouter& api_;
    class Session;
    std::set<std::shared_ptr<Session>> sessions_;
    bool stopping_ = false;
    size_t pending_queries_ = 0;

    class Session : public std::enable_shared_from_this<Session> {
        Implementation& owner_;
        beast::tcp_stream stream_;
        beast::flat_buffer buffer_{8192};
        http::request_parser<http::string_body> parser_;
        http::response<http::string_body> response_;
        asio::steady_timer deadline_;
        bool closed_ = false;
    public:
        Session(Implementation& owner, tcp::socket socket) : owner_(owner), stream_(std::move(socket)),
            deadline_(owner.io_) {
            parser_.header_limit(4096); parser_.body_limit(0);
        }
        void close() {
            if (closed_) return;
            closed_ = true;
            deadline_.cancel();
            beast::error_code ignored;
            stream_.socket().cancel(ignored);
            stream_.socket().shutdown(tcp::socket::shutdown_both, ignored);
            stream_.socket().close(ignored);
            owner_.sessions_.erase(shared_from_this());
        }
        void start() {
            deadline_.expires_after(std::chrono::seconds(10));
            deadline_.async_wait([self = shared_from_this()](beast::error_code ec) { if (!ec) self->close(); });
            stream_.expires_after(std::chrono::seconds(5));
            http::async_read(stream_, buffer_, parser_, [self = shared_from_this()](beast::error_code ec, size_t) {
                if (ec) {
                    if (ec == http::error::header_limit || ec == http::error::body_limit || ec == http::error::bad_method)
                        self->fail(400, "Invalid or oversized request.");
                    else self->close();
                    return;
                }
                const auto& request = self->parser_.get();
                if (request.method() != http::verb::get) {
                    self->fail(405, "GET required."); return;
                }
                std::string target(request.target());
                if (!self->owner_.api_.valid_target(target)) {
                    self->fail(400, "Invalid request target."); return;
                }
                if (self->owner_.pending_queries_ >= 64) {
                    self->fail(503, "Query capacity reached."); return;
                }
                ++self->owner_.pending_queries_;
                asio::post(self->owner_.queries_, [self, target] {
                    unsigned status = 503;
                    std::string body;
                    try {
                        const auto response = self->owner_.api_.get(target);
                        status = response.status; body = response.body.dump();
                    } catch (const std::exception&) {
                        body = ApiRouter::failure(target, 503, "Query failed.").body.dump();
                    }
                    asio::post(self->owner_.io_, [self, status, body = std::move(body)] {
                        --self->owner_.pending_queries_;
                        if (self->closed_) return;
                        if (body.size() > 8 * 1024 * 1024)
                            self->fail(503, "Response resource limit.");
                        else self->send(status, body);
                    });
                });
            });
        }
        void fail(unsigned status, const std::string& message) {
            const auto target = parser_.get().target();
            send(status, ApiRouter::failure(std::string(target), status, message).body.dump());
        }
        void send(unsigned status, const std::string& body) {
            if (closed_) return;
            response_.result(static_cast<http::status>(status)); response_.version(11);
            response_.set(http::field::content_type, "application/json");
            response_.set(http::field::cache_control, "no-store");
            response_.set("X-Content-Type-Options", "nosniff");
            if (status == 405) response_.set(http::field::allow, "GET");
            response_.keep_alive(false); response_.body() = body; response_.prepare_payload();
            stream_.expires_after(std::chrono::seconds(5));
            http::async_write(stream_, response_, [self = shared_from_this()](beast::error_code, size_t) { self->close(); });
        }
    };
    void accept() {
        acceptor_.async_accept([this](beast::error_code ec, tcp::socket socket) {
            if (stopping_) return;
            if (!ec && sessions_.size() < 64) {
                auto session = std::make_shared<Session>(*this, std::move(socket));
                sessions_.insert(session); session->start();
            }
            if (!stopping_) accept();
        });
    }
public:
    Implementation(ApiRouter& api, const std::string& address, unsigned short port)
        : acceptor_(io_), signals_(io_, SIGINT, SIGTERM), api_(api) {
        const tcp::endpoint endpoint(asio::ip::make_address(address), port);
        acceptor_.open(endpoint.protocol()); acceptor_.set_option(tcp::acceptor::reuse_address(true));
        acceptor_.bind(endpoint); acceptor_.listen(64);
    }
    ~Implementation() { queries_.stop(); queries_.join(); }
    void run() {
        signals_.async_wait([this](beast::error_code, int) {
            stopping_ = true; beast::error_code ignored; acceptor_.close(ignored);
            auto sessions = sessions_;
            for (const auto& session : sessions) session->close();
            queries_.stop(); io_.stop();
        });
        accept(); io_.run(); queries_.stop(); queries_.join();
    }
};
HttpServer::HttpServer(ApiRouter& api, const std::string& address, unsigned short port)
    : implementation_(new Implementation(api, address, port)) {}
HttpServer::~HttpServer() = default;
void HttpServer::run() { implementation_->run(); }
}
