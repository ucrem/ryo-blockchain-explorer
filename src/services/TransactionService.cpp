#include "TransactionService.h"
#include "BlockSummary.h"

namespace ryo_explorer {
TransactionResult TransactionService::get(const std::string& id, bool include_ring_members) {
    const auto hash = parse_hash(id);
    try {
        QueryContext::Read read(context_);
        auto& db = read.db();
        TransactionResult result;
        result.chain_height = db.height();
        if (db.tx_exists(hash)) {
            result.transaction = db.get_tx(hash);
            result.block_height = db.get_tx_block_height(hash);
            if (result.block_height >= result.chain_height)
                throw QueryFailure(QueryError::chain_changed, "Transaction snapshot is inconsistent.");
            result.timestamp = db.get_block_timestamp(result.block_height);
            result.confirmations = result.chain_height - result.block_height;
        } else {
            cryptonote::blobdata blob;
            if (!db.get_txpool_tx_blob(hash, blob))
                throw QueryFailure(QueryError::missing, "Transaction not found.");
            if (!cryptonote::parse_and_validate_tx_from_blob(blob, result.transaction))
                throw QueryFailure(QueryError::database, "Native pool transaction cannot be parsed.");
            result.in_pool = true;
            // Local receive/relay times are intentionally not exposed.
        }
        result.metadata = transaction_metadata(result.transaction);
        if (result.metadata.hash != hash)
            throw QueryFailure(QueryError::chain_changed, "Transaction hash does not match the lookup.");
        if (include_ring_members) {
            for (const auto& input : result.metadata.inputs) {
                const auto offsets = cryptonote::relative_output_offsets_to_absolute(input.key_offsets);
                std::vector<cryptonote::output_data_t> members;
                if (!offsets.empty() && offsets.back() < db.get_num_outputs(input.amount))
                    db.get_output_key(input.amount, offsets, members);
                std::vector<uint64_t> timestamps;
                for (const auto& member : members) timestamps.push_back(db.get_block_timestamp(member.height));
                result.ring_members.push_back(std::move(members));
                result.ring_timestamps.push_back(std::move(timestamps));
            }
        }
        return result;
    } catch (const QueryFailure&) { throw; }
      catch (const std::exception&) { throw QueryFailure(QueryError::database, "Native database read failed."); }
}
PoolPage TransactionService::pool(unsigned limit, const std::string& cursor) {
    if (!limit || limit > 100) throw QueryFailure(QueryError::invalid, "Invalid pool limit.");
    uint64_t offset = 0;
    std::string requested_snapshot;
    if (!cursor.empty()) {
        if (cursor.size() > 70 || cursor.size() < 66 || cursor[64] != '.')
            throw QueryFailure(QueryError::invalid, "Invalid pool cursor.");
        requested_snapshot = cursor.substr(0, 64);
        parse_hash(requested_snapshot);
        offset = parse_uint64(cursor.substr(65));
        if (!offset || offset > 10000) throw QueryFailure(QueryError::invalid, "Invalid pool cursor offset.");
    }
    try {
        QueryContext::Read read(context_);
        auto& db = read.db();
        PoolPage result;
        result.chain_height = db.height();
        if (db.get_txpool_tx_count(true) > 10000)
            throw QueryFailure(QueryError::limit, "Pool exceeds the public listing bound.");
        struct Entry { std::string id; cryptonote::txpool_tx_meta_t meta; };
        std::vector<Entry> entries;
        const auto add = [](uint64_t& total, uint64_t value) {
            if (value > UINT64_MAX - total) throw QueryFailure(QueryError::limit, "Pool aggregate exceeds uint64.");
            total += value;
        };
        const bool complete = db.for_all_txpool_txes([&](const crypto::hash& hash,
            const cryptonote::txpool_tx_meta_t& meta, const cryptonote::blobdata*) {
            if (entries.size() >= 10000) return false;
            entries.push_back({epee::string_tools::pod_to_hex(hash), meta});
            add(result.size, meta.blob_size); add(result.fees, meta.fee);
            return true;
        }, false, false);
        if (!complete || entries.size() != db.get_txpool_tx_count(false))
            throw QueryFailure(QueryError::database, "Pool snapshot is incomplete.");
        std::sort(entries.begin(), entries.end(), [](const Entry& a, const Entry& b) { return a.id < b.id; });
        std::string membership;
        membership.reserve(entries.size() * 64);
        for (const auto& entry : entries) membership += entry.id;
        result.snapshot = epee::string_tools::pod_to_hex(crypto::cn_fast_hash(membership.data(), membership.size()));
        result.count = entries.size();
        if (!requested_snapshot.empty() && requested_snapshot != result.snapshot)
            throw QueryFailure(QueryError::chain_changed, "Pool changed; restart from its first page.");
        if (offset > entries.size() || (offset && offset == entries.size()))
            throw QueryFailure(QueryError::invalid, "Pool cursor is past its last page.");
        const auto end = std::min<uint64_t>(entries.size(), offset + limit);
        for (auto i = offset; i < end; ++i) {
            cryptonote::blobdata blob;
            if (!db.get_txpool_tx_blob(parse_hash(entries[i].id), blob) || blob.size() > 4 * 1024 * 1024)
                throw QueryFailure(QueryError::limit, "Pool transaction is unavailable or oversized.");
            cryptonote::transaction tx;
            if (!cryptonote::parse_and_validate_tx_from_blob(blob, tx))
                throw QueryFailure(QueryError::database, "Native pool transaction cannot be parsed.");
            auto metadata = transaction_metadata(tx);
            if (epee::string_tools::pod_to_hex(metadata.hash) != entries[i].id || metadata.coinbase ||
                metadata.size != entries[i].meta.blob_size || metadata.fee != entries[i].meta.fee)
                throw QueryFailure(QueryError::database, "Pool metadata does not match native bytes.");
            result.transactions.push_back(std::move(tx)); result.metadata.push_back(std::move(metadata));
        }
        if (end < entries.size()) result.next_cursor = result.snapshot + "." + std::to_string(end);
        return result;
    } catch (const QueryFailure&) { throw; }
      catch (const std::exception&) { throw QueryFailure(QueryError::database, "Native pool read failed."); }
}
KeyImageStatus TransactionService::key_image(const std::string& text) {
    parse_hash(text);
    KeyImageStatus result;
    if (!epee::string_tools::hex_to_pod(text, result.image))
        throw QueryFailure(QueryError::invalid, "Invalid key image.");
    try {
        QueryContext::Read read(context_);
        result.chain_height = read.db().height();
        result.spent = read.db().has_key_image(result.image);
        return result;
    } catch (const QueryFailure&) { throw; }
      catch (const std::exception&) { throw QueryFailure(QueryError::database, "Native key image read failed."); }
}
AddressStatus TransactionService::address(const std::string& text) {
    const std::string alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    if (text.size() < 40 || text.size() > 200 || text.find_first_not_of(alphabet) != std::string::npos)
        throw QueryFailure(QueryError::invalid, "Invalid public address format.");
    AddressStatus result; result.address = text;
    try {
        QueryContext::Read read(context_);
        result.chain_height = read.db().height();
        const auto selected = context_.network();
        const cryptonote::network_type networks[] = {selected, cryptonote::MAINNET, cryptonote::TESTNET, cryptonote::STAGENET};
        for (auto network : networks) {
            if (cryptonote::get_account_address_from_str(network, result.parsed, text)) {
                result.network = network; result.valid = true; result.matches_reader = network == selected; break;
            }
        }
        return result;
    } catch (const QueryFailure&) { throw; }
      catch (const std::exception&) { throw QueryFailure(QueryError::database, "Native address read failed."); }
}

}
