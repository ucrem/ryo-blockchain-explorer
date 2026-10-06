#include "common/util.h"
#include "cryptonote_basic/cryptonote_basic_impl.h"
#include "misc_language.h"
#include "net/net_utils_base.h"
#include "string_tools.h"
#include "../third_party/json/json.hpp"
#include <boost/filesystem.hpp>
#include <zmq.hpp>
#include <chrono>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <thread>
#include <type_traits>

static void check(bool value, const char* message) {
    if (!value) throw std::runtime_error(message);
}

static void check_hashes(const boost::filesystem::path& scratch) {
    struct Vector { std::string input; const char* digest; };
    const Vector vectors[] = {
        {"", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},
        {"abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"},
        {std::string(4096, 'a'), "c93eee2d0db02f10acc7460d9576e122dcf8cd53c4bf8dfcae1b3e74ebcfff5a"},
        {std::string(4097, 'a'), "4e369b5618643c3abddd027b650bfa54810be3b418028a7c9d82299a59d008e8"},
        {std::string(8193, 'a'), "9c10c48d1f1d6618db88fde2c25409181c9201ed34ec6815d62bcf57c10d177b"},
    };
    const auto path = scratch / "compatibility-sha256.bin";
    const auto copy = scratch / "compatibility-sha256-copy.bin";
    for (const auto& vector : vectors) {
        crypto::hash digest;
        check(tools::sha256sum(reinterpret_cast<const uint8_t*>(vector.input.data()), vector.input.size(), digest),
              "Native SHA-256 memory operation failed.");
        check(epee::string_tools::pod_to_hex(digest) == vector.digest, "Native SHA-256 memory digest changed.");
        { std::ofstream file(path.string(), std::ios::binary | std::ios::trunc);
          file.write(vector.input.data(), vector.input.size());
          check(file.good(), "Could not write disposable hash input."); }
        check(tools::sha256sum(path.string(), digest) && epee::string_tools::pod_to_hex(digest) == vector.digest,
              "Native SHA-256 chunked-file digest changed.");
        { std::ofstream previous(copy.string()); previous << "previous content"; }
        check(boost::filesystem::copy_file(path, copy, boost::filesystem::copy_options::overwrite_existing),
              "Native Boost overwrite operation failed.");
        check(tools::sha256sum(copy.string(), digest) && epee::string_tools::pod_to_hex(digest) == vector.digest,
              "Native Boost overwrite content changed.");
    }
    crypto::hash digest;
    check(tools::sha256sum(nullptr, 0, digest) && epee::string_tools::pod_to_hex(digest) == vectors[0].digest,
          "Native empty null-buffer SHA-256 changed.");
    check(!tools::sha256sum((scratch / "missing-sha256-input").string(), digest),
          "Missing SHA-256 file was accepted.");
}

static void check_copies() {
    using Context = epee::net_utils::connection_context_base;
    // Synthetic loopback identity/counters, never a node observation fixture.
    const boost::uuids::uuid id{};
    Context source(id, epee::net_utils::ipv4_network_address{0x0100007f, 12345}, true, 11, 12, 13, 14);
    source.m_current_speed_down = 1.5; source.m_current_speed_up = 2.5;
    const Context copied(source);
    check(copied.m_connection_id == source.m_connection_id && copied.m_remote_address == source.m_remote_address &&
          copied.m_is_income == source.m_is_income && copied.m_started == source.m_started &&
          copied.m_last_recv == 11 && copied.m_last_send == 12 && copied.m_recv_cnt == 13 && copied.m_send_cnt == 14 &&
          copied.m_current_speed_down == 1.5 && copied.m_current_speed_up == 2.5,
          "Native context copy no longer preserves all fields.");
    Context assigned;
    assigned = source;
    check(assigned.m_connection_id == id && assigned.m_remote_address == source.m_remote_address && assigned.m_is_income &&
          assigned.m_last_recv == 0 && assigned.m_last_send == 0 && assigned.m_recv_cnt == 0 && assigned.m_send_cnt == 0 &&
          assigned.m_current_speed_down == 0 && assigned.m_current_speed_up == 0,
          "Native context assignment reset semantics changed.");
    static_assert(std::is_same<epee::misc_utils::less_as_pod<crypto::hash>::first_argument_type, crypto::hash>::value,
                  "Native comparator argument alias changed.");
    static_assert(std::is_same<epee::misc_utils::less_as_pod<crypto::hash>::result_type, bool>::value,
                  "Native comparator result alias changed.");
    static_assert(std::is_same<cryptonote::array_hasher<crypto::hash>::argument_type, crypto::hash&>::value,
                  "Native hash argument alias changed.");
}

static void check_zmq(const std::string& endpoint) {
    zmq::context_t context(1);
    zmq::socket_t socket(context, zmq::socket_type::req);
    socket.set(zmq::sockopt::linger, 0);
    socket.set(zmq::sockopt::rcvtimeo, 3000);
    socket.set(zmq::sockopt::sndtimeo, 3000);
    socket.connect(endpoint);
    for (int id : {1, 2}) {
        const auto request = nlohmann::json{{"jsonrpc", "2.0"}, {"id", id}, {"method", "get_height"},
                                          {"params", nlohmann::json::object()}}.dump();
        check(bool(socket.send(zmq::buffer(request), zmq::send_flags::none)), "Native ZMQ request timed out.");
        zmq::message_t reply;
        check(bool(socket.recv(reply, zmq::recv_flags::none)), "Native ZMQ reply timed out.");
        const auto body = nlohmann::json::parse(std::string(static_cast<const char*>(reply.data()), reply.size()));
        check(body.at("id") == id && body.at("result").at("height") == 1,
              "Native ZMQ genesis response/identity changed.");
        if (id == 1) std::this_thread::sleep_for(std::chrono::milliseconds(1200));
    }
}

int main(int argc, char** argv) {
    try {
        check(argc == 4, "Expected disposable LMDB, HTTP and ZMQ arguments.");
        const auto scratch = boost::filesystem::path(argv[1]).parent_path().parent_path();
        check_hashes(scratch);
        check_copies();
        check_zmq(argv[3]);
        std::cout << "Native hash/copy/ZMQ compatibility checks passed.\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
