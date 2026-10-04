#include "TransactionService.h"

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
                result.ring_members.push_back(std::move(members));
            }
        }
        return result;
    } catch (const QueryFailure&) { throw; }
      catch (const std::exception&) { throw QueryFailure(QueryError::database, "Native database read failed."); }
}
}
