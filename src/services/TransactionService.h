#pragma once
#include "QueryContext.h"
#include "TransactionMetadata.h"

namespace ryo_explorer {
struct TransactionResult {
    cryptonote::transaction transaction;
    TransactionMetadata metadata;
    uint64_t chain_height = 0, block_height = 0, confirmations = 0, timestamp = 0;
    bool in_pool = false;
    // Each input's native ring candidates; never identifies the real spend.
    std::vector<std::vector<cryptonote::output_data_t>> ring_members;
    // Public originating block times, sampled inside the same native read scope.
    std::vector<std::vector<uint64_t>> ring_timestamps;
};
struct PoolPage {
    std::vector<cryptonote::transaction> transactions;
    std::vector<TransactionMetadata> metadata;
    // Owner-authorized local pool observation, separate from chain inclusion time.
    std::vector<uint64_t> receive_times;
    uint64_t chain_height = 0, count = 0, size = 0, fees = 0;
    std::string snapshot, next_cursor;
};
struct KeyImageStatus {
    crypto::key_image image{};
    uint64_t chain_height = 0;
    bool spent = false;
};
struct AddressStatus {
    std::string address;
    cryptonote::address_parse_info parsed{};
    cryptonote::network_type network = cryptonote::UNDEFINED;
    uint64_t chain_height = 0;
    bool valid = false, matches_reader = false;
};
class TransactionService {
    QueryContext& context_;
public:
    explicit TransactionService(QueryContext& context) : context_(context) {}
    PoolPage pool(unsigned limit = 50, const std::string& cursor = "");
    KeyImageStatus key_image(const std::string& image);
    AddressStatus address(const std::string& address);
    TransactionResult get(const std::string& hash, bool include_ring_members = true);
};
}
