#include "cryptonote_basic/cryptonote_format_utils.h"
#include "cryptonote_core/cryptonote_tx_utils.h"
#include "string_tools.h"

#include <fstream>
#include <iostream>
#include <string>

int main(int argc, char** argv)
{
    if (argc != 2)
    {
        std::cerr << "Expected a public genesis transaction hex fixture.\n";
        return 1;
    }
    std::ifstream input(argv[1]);
    std::string hex;
    if (!(input >> hex)) return 1;
    cryptonote::blobdata blob;
    if (!epee::string_tools::parse_hexstr_to_binbuff(hex, blob)) return 1;

    cryptonote::transaction tx;
    crypto::hash hash, prefix_hash;
    if (!cryptonote::parse_and_validate_tx_from_blob(blob, tx, hash, prefix_hash)) return 1;
    if (epee::string_tools::pod_to_hex(hash) !=
        "ef9edde12f78ce1776ce1886b3e448d8f3575bc25111231370989baeae4a2d88") return 1;
    if (!cryptonote::is_coinbase(tx) || tx.version != 2 || tx.unlock_time != 60) return 1;
    if (tx.vin.size() != 1 || tx.vout.size() != 1 || tx.rct_signatures.type != 0) return 1;
    if (tx.vout.front().amount != 8800000000000000ULL) return 1;
    const auto& output = boost::get<cryptonote::txout_to_key>(tx.vout.front().target);
    if (epee::string_tools::pod_to_hex(output.key) !=
        "8be379aa57a70fa19c0ee5765fdc3d2aae0b1034158f4963e157d9042c24fbec") return 1;
    if (cryptonote::tx_to_blob(tx) != blob) return 1;

    cryptonote::block genesis;
    if (!cryptonote::generate_genesis_block(cryptonote::MAINNET, genesis, hex, 10000)) return 1;
    if (epee::string_tools::pod_to_hex(cryptonote::get_block_hash(genesis)) !=
        "6eb04b6b8c68049a76206fe2805ede5f7465c03b7112850d3262a067b9914dac") return 1;

    cryptonote::transaction invalid;
    if (cryptonote::parse_and_validate_tx_from_blob(blob.substr(0, blob.size() / 2), invalid)) return 1;
    std::cout << "Ryo mainnet genesis hash, metadata, round trip, and truncated-blob checks passed.\n";
    return 0;
}
