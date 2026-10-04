// Legacy fields extracted from official explorer 2e334724, page.h JSON methods.
// Source attribution and licenses are retained in THIRD_PARTY_NOTICES.md.
#include "LegacyJson.h"

namespace ryo_explorer {
using xmreg::json;
static json summary(const cryptonote::transaction& tx, const TransactionMetadata& metadata) {
    return json{
        {"tx_hash", epee::string_tools::pod_to_hex(metadata.hash)}, {"tx_fee", metadata.fee},
        {"mixin", metadata.ring_size}, {"tx_size", metadata.size},
        {"xmr_outputs", metadata.output_atoms}, {"xmr_inputs", metadata.input_atoms},
        {"tx_version", static_cast<uint64_t>(tx.version)}, {"rct_type", tx.rct_signatures.type},
        {"coinbase", metadata.coinbase}, {"extra", epee::string_tools::buff_to_hex_nodelimer(
            std::string(tx.extra.begin(), tx.extra.end()))},
        {"payment_id", metadata.payment_id == crypto::null_hash ? "" : epee::string_tools::pod_to_hex(metadata.payment_id)},
        {"payment_id8", metadata.payment_id8 == crypto::null_hash8 ? "" : epee::string_tools::pod_to_hex(metadata.payment_id8)}
    };
}
static ApiResponse success(json data) { return {200, json{{"status", "success"}, {"data", std::move(data)}}}; }
ApiResponse LegacyJson::get(const std::string& target) {
    try {
        if (target == "/health") {
            const auto block = blocks_.get("0");
            return {200, json{{"status", "ok"}, {"height", block.chain_height},
                {"network", network_}, {"version", "0.2.0"}}};
        }
        if (!enabled_) return {404, json{{"status", "fail"}, {"data", {{"title", "Route not enabled."}}}}};
        if (target == "/api/version") {
            const auto block = blocks_.get("0");
            return success(json{{"last_git_commit_hash", RYO_EXPLORER_COMMIT},
                {"last_git_commit_date", RYO_EXPLORER_COMMIT_DATE}, {"git_branch_name", RYO_EXPLORER_BRANCH},
                {"monero_version_full", RYO_VERSION_FULL}, {"api", 65537}, {"blockchain_height", block.chain_height}});
        }
        const std::string block_prefix = "/api/block/", raw_block_prefix = "/api/rawblock/";
        const std::string tx_prefix = "/api/transaction/", raw_tx_prefix = "/api/rawtransaction/";
        if (target.compare(0, block_prefix.size(), block_prefix) == 0 ||
            target.compare(0, raw_block_prefix.size(), raw_block_prefix) == 0) {
            const bool raw = target.compare(0, raw_block_prefix.size(), raw_block_prefix) == 0;
            auto result = blocks_.get(target.substr(raw ? raw_block_prefix.size() : block_prefix.size()));
            if (raw) return success(json::parse(cryptonote::obj_to_json_str(result.block)));
            json txs;
            for (size_t i = 0; i < result.transactions.size(); ++i)
                txs.push_back(summary(result.transactions[i], result.metadata[i]));
            return success(json{{"block_height", result.height}, {"hash", epee::string_tools::pod_to_hex(result.hash)},
                {"timestamp", result.block.timestamp}, {"timestamp_utc", xmreg::timestamp_to_str_gm(result.block.timestamp)},
                {"size", result.size}, {"txs", txs}, {"current_height", result.chain_height}});
        }
        if (target.compare(0, tx_prefix.size(), tx_prefix) == 0 ||
            target.compare(0, raw_tx_prefix.size(), raw_tx_prefix) == 0) {
            const bool raw = target.compare(0, raw_tx_prefix.size(), raw_tx_prefix) == 0;
            auto result = transactions_.get(target.substr(raw ? raw_tx_prefix.size() : tx_prefix.size()), !raw);
            if (raw) return success(json::parse(cryptonote::obj_to_json_str(result.transaction)));
            auto data = summary(result.transaction, result.metadata);
            json outputs, inputs;
            for (const auto& output : result.metadata.outputs)
                outputs.push_back(json{{"public_key", epee::string_tools::pod_to_hex(output.first.key)}, {"amount", output.second}});
            for (size_t i = 0; i < result.metadata.inputs.size(); ++i) {
                if (result.ring_members[i].empty()) continue;
                json mixins;
                for (const auto& member : result.ring_members[i]) mixins.push_back(json{
                    {"public_key", epee::string_tools::pod_to_hex(member.pubkey)}, {"block_no", member.height}});
                const auto& input = result.metadata.inputs[i];
                inputs.push_back(json{{"key_image", epee::string_tools::pod_to_hex(input.k_image)},
                    {"amount", input.amount}, {"mixins", mixins}});
            }
            data["timestamp"] = result.timestamp;
            data["timestamp_utc"] = xmreg::timestamp_to_str_gm(result.timestamp);
            data["block_height"] = result.block_height;
            data["confirmations"] = result.confirmations;
            data["current_height"] = result.chain_height;
            data["outputs"] = outputs; data["inputs"] = inputs;
            return success(std::move(data));
        }
        return {404, json{{"status", "fail"}, {"data", {{"title", "Route not implemented."}}}}};
    } catch (const QueryFailure& failure) {
        if (target == "/health")
            return {503, json{{"status", "error"}, {"message", failure.what()}}};
        if (failure.code == QueryError::invalid || failure.code == QueryError::missing)
            return {200, json{{"status", "fail"}, {"data", {{"title", failure.what()}}}}};
        return {503, json{{"status", "error"}, {"message", failure.what()}, {"data", nullptr}}};
    } catch (const std::exception&) {
        return {503, json{{"status", "error"}, {"message", "Response serialization failed."}, {"data", nullptr}}};
    }
}
}
