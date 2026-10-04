#pragma once
#include "MicroCore.h"

namespace ryo_explorer {
struct TransactionMetadata {
    crypto::hash hash{};
    crypto::public_key public_key{};
    std::vector<crypto::public_key> additional_keys;
    crypto::hash payment_id{};
    crypto::hash8 payment_id8{};
    std::vector<std::pair<cryptonote::txout_to_key, uint64_t>> outputs;
    std::vector<cryptonote::txin_to_key> inputs;
    uint64_t fee = 0, size = 0, input_atoms = 0, output_atoms = 0;
    uint64_t ring_size = 0, non_ringct_inputs = 0;
    bool coinbase = false, input_amounts_visible = false, output_amounts_visible = false;
};
TransactionMetadata transaction_metadata(const cryptonote::transaction& tx);
}
