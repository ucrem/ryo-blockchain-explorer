#include "ApiRouter.h"
#include "OpenApiDocument.h"
#include "HttpServer.h"
#include <boost/program_options.hpp>
#include <boost/filesystem.hpp>

int main(int argc, char** argv) {
    namespace options = boost::program_options;
    try {
        std::string path, address; unsigned port;
        options::options_description description("Ryo Explorer v0.3.0 read-only server");
        description.add_options()
            ("help,h", "Show supported options")
            ("bc-path", options::value<std::string>(&path)->required(), "Existing Ryo LMDB directory")
            ("bind-ip", options::value<std::string>(&address)->default_value("127.0.0.1"), "Numeric HTTP bind address")
            ("port,p", options::value<unsigned>(&port)->default_value(8081), "HTTP listen port")
            ("testnet", options::bool_switch(), "Select testnet database")
            ("stagenet", options::bool_switch(), "Select stagenet database")
            ("enable-json-api", options::bool_switch(), "Enable the implemented legacy JSON subset")
            ("enable-api-v2", options::bool_switch(), "Enable API v2 and bundled OpenAPI");
        options::variables_map values;
        options::store(options::parse_command_line(argc, argv, description), values);
        if (values.count("help")) { std::cout << description << '\n'; return 0; }
        options::notify(values);
        const bool testnet = values["testnet"].as<bool>(), stagenet = values["stagenet"].as<bool>();
        if (testnet && stagenet) throw std::runtime_error("Select only one network.");
        if (port == 0 || port > 65535) throw std::runtime_error("Port must be between 1 and 65535.");
        if (!boost::filesystem::is_regular_file(boost::filesystem::path(path) / "data.mdb"))
            throw std::runtime_error("--bc-path must contain an existing Ryo data.mdb.");
        xmreg::MicroCore core;
        const auto network = testnet ? cryptonote::TESTNET : stagenet ? cryptonote::STAGENET : cryptonote::MAINNET;
        if (!core.init(path, network, true)) throw std::runtime_error("Cannot initialize the selected native database.");
        ryo_explorer::QueryContext context(core);
        ryo_explorer::BlockService blocks(context);
        ryo_explorer::TransactionService transactions(context);
        ryo_explorer::LegacyJson api(blocks, transactions, values["enable-json-api"].as<bool>(),
            testnet ? "testnet" : stagenet ? "stagenet" : "mainnet");
        ryo_explorer::NetworkService network_service(context);
        ryo_explorer::ApiV2 v2(blocks, transactions, network_service, values["enable-api-v2"].as<bool>(),
            testnet ? "testnet" : stagenet ? "stagenet" : "mainnet",
            xmreg::json::parse(ryo_explorer::openapi_document));
        ryo_explorer::ApiRouter router(api, v2);
        ryo_explorer::HttpServer server(router, address, static_cast<unsigned short>(port));
        std::cout << "Ryo read-only HTTP server listening on " << address << ':' << port << std::endl;
        server.run();
    } catch (const std::exception& error) {
        std::cerr << "Ryo Explorer startup/runtime failed: " << error.what() << '\n'; return 1;
    }
}
