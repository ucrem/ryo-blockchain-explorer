#include "ApiV2.h"

namespace ryo_explorer {
namespace {
using xmreg::json;
std::string hex(const crypto::hash& value) { return epee::string_tools::pod_to_hex(value); }
template<typename T> json optional_key(const T& value) {
    const T zero{};
    return value == zero ? json(nullptr) : json(epee::string_tools::pod_to_hex(value));
}
json summary(const BlockSummary& block) {
    return {{"height", std::to_string(block.height)}, {"hash", hex(block.hash)},
        {"previous_hash", hex(block.previous_hash)}, {"timestamp_unix", std::to_string(block.timestamp)},
        {"size_bytes", std::to_string(block.size)}, {"major_version", block.major_version},
        {"minor_version", block.minor_version}, {"nonce", block.nonce},
        {"transaction_count", block.transaction_count}, {"coinbase_hash", hex(block.coinbase_hash)}};
}
json summary(const cryptonote::transaction& tx, const TransactionMetadata& metadata) {
    return {{"hash", hex(metadata.hash)}, {"version", tx.version}, {"ringct_type", tx.rct_signatures.type},
        {"coinbase", metadata.coinbase}, {"size_bytes", std::to_string(metadata.size)},
        {"fee_atomic", std::to_string(metadata.fee)}, {"input_count", metadata.inputs.size()},
        {"output_count", tx.vout.size()}, {"inspection", [&]() {
            json minimum = nullptr, maximum = nullptr, types = json::array();
            for (const auto& input : metadata.inputs) {
                const uint64_t count = input.key_offsets.size();
                if (minimum.is_null() || count < minimum.get<uint64_t>()) minimum = count;
                if (maximum.is_null() || count > maximum.get<uint64_t>()) maximum = count;
            }
            if (metadata.payment_id_present) types.push_back("legacy");
            if (metadata.payment_id8_present) types.push_back("encrypted");
            if (metadata.uniform_payment_id_present) types.push_back("uniform");
            return json{{"ring_size_min", minimum.is_null() ? minimum : json(std::to_string(minimum.get<uint64_t>()))},
                {"ring_size_max", maximum.is_null() ? maximum : json(std::to_string(maximum.get<uint64_t>()))},
                {"payment_id_types", types}};
        }()}};
}
void validate_block_id(const std::string& id) {
    if (id.size() == 64) parse_hash(id);
    else parse_uint64(id);
}
template<typename T> json raw(const crypto::hash& hash, T& object, const cryptonote::blobdata& blob) {
    // Bound native bytes before hex expansion. The transport also bounds the full JSON body.
    if (blob.empty() || blob.size() > 4 * 1024 * 1024)
        throw QueryFailure(QueryError::limit, "Native object exceeds the raw resource limit.");
    return {{"hash", hex(hash)}, {"native_json", json::parse(cryptonote::obj_to_json_str(object))},
        {"blob_hex", epee::string_tools::buff_to_hex_nodelimer(blob)}};
}
}
xmreg::json ApiV2::meta(uint64_t height) const {
    return {{"network", network_name_}, {"chain_height", std::to_string(height)}};
}
ApiResponse ApiV2::error(unsigned status, const std::string& message) {
    const auto code = status == 400 ? "invalid_request" : status == 404 ? "not_found" :
        status == 405 ? "method_not_allowed" : status == 409 ? "chain_changed" : "unavailable";
    return {status, {{"error", {{"code", code}, {"message", message}}}}};
}
ApiResponse ApiV2::get(const std::string& target) {
    if (!enabled_) return error(404, "API v2 is disabled.");
    try {
        const auto question = target.find('?');
        const auto path = target.substr(0, question);
        if (path == "/api/v2/openapi.json") return {200, specification_};
        if (path == "/api/v2/block-intervals") {
            unsigned seconds = 3600;
            std::string anchor;
            bool has_window = false, has_anchor = false;
            if (question != std::string::npos) {
                const auto query = target.substr(question + 1);
                if (query.empty()) throw QueryFailure(QueryError::invalid, "Empty query.");
                size_t start = 0;
                while (start <= query.size()) {
                    const auto end = query.find('&', start);
                    const auto part = query.substr(start, end == std::string::npos ? end : end - start);
                    const auto equals = part.find('=');
                    if (equals == std::string::npos || equals == 0 || equals + 1 == part.size() ||
                        part.find('=', equals + 1) != std::string::npos)
                        throw QueryFailure(QueryError::invalid, "Invalid window query.");
                    const auto key = part.substr(0, equals), value = part.substr(equals + 1);
                    if (key == "window" && !has_window) {
                        if (value == "1h") seconds = 3600;
                        else if (value == "24h") seconds = 86400;
                        else if (value == "7d") seconds = 604800;
                        else if (value == "30d") seconds = 2592000;
                        else throw QueryFailure(QueryError::invalid, "Invalid window.");
                        has_window = true;
                    } else if (key == "anchor" && !has_anchor) {
                        parse_hash(value); anchor = value; has_anchor = true;
                    } else throw QueryFailure(QueryError::invalid, "Unknown or duplicate window parameter.");
                    if (end == std::string::npos) break;
                    start = end + 1;
                }
            }
            const auto window = blocks_.intervals(seconds, anchor);
            json points = json::array();
            for (const auto& point : window.points)
                points.push_back({{"height", std::to_string(point.height)},
                    {"timestamp_unix", std::to_string(point.timestamp)},
                    {"previous_timestamp_unix", std::to_string(point.previous_timestamp)},
                    {"interval_seconds", point.seconds}});
            json data{{"anchor_height", std::to_string(window.anchor_height)},
                {"anchor_hash", hex(window.anchor_hash)}, {"anchor_timestamp_unix", std::to_string(window.anchor_timestamp)},
                {"window_seconds", window.window_seconds}, {"start_timestamp_unix", std::to_string(window.start_timestamp)},
                {"scanned_from_height", std::to_string(window.scanned_from_height)},
                {"scanned_count", window.scanned_count}, {"oldest_timestamp_unix", std::to_string(window.oldest_timestamp)},
                {"history_limited", window.history_limited}, {"points", points}};
            return {200, {{"data", data}, {"meta", meta(window.chain_height)}}};
        }
        if (path == "/api/v2/mempool") {
            unsigned limit = 50; std::string cursor;
            bool has_limit = false, has_cursor = false;
            if (question != std::string::npos) {
                const auto query = target.substr(question + 1);
                if (query.empty()) throw QueryFailure(QueryError::invalid, "Empty pool query.");
                size_t start = 0;
                while (start <= query.size()) {
                    const auto end = query.find('&', start);
                    const auto part = query.substr(start, end == std::string::npos ? end : end - start);
                    const auto equals = part.find('=');
                    if (equals == std::string::npos || equals == 0 || equals + 1 == part.size() ||
                        part.find('=', equals + 1) != std::string::npos)
                        throw QueryFailure(QueryError::invalid, "Invalid pool query.");
                    const auto key = part.substr(0, equals), value = part.substr(equals + 1);
                    if (key == "limit" && !has_limit) {
                        const auto parsed = parse_uint64(value);
                        if (!parsed || parsed > 100) throw QueryFailure(QueryError::invalid, "Invalid pool limit.");
                        limit = static_cast<unsigned>(parsed); has_limit = true;
                    } else if (key == "cursor" && !has_cursor) { cursor = value; has_cursor = true; }
                    else throw QueryFailure(QueryError::invalid, "Unknown or duplicate pool parameter.");
                    if (end == std::string::npos) break;
                    start = end + 1;
                }
            }
            auto pool = transactions_.pool(limit, cursor);
            json items = json::array();
            for (size_t i = 0; i < pool.transactions.size(); ++i) items.push_back(summary(pool.transactions[i], pool.metadata[i]));
            return {200, {{"data", {{"items", items}, {"transaction_count", std::to_string(pool.count)},
                {"size_bytes", std::to_string(pool.size)}, {"fee_atomic", std::to_string(pool.fees)},
                {"snapshot", pool.snapshot}, {"next_cursor", pool.next_cursor.empty() ? json(nullptr) : json(pool.next_cursor)}}},
                {"meta", meta(pool.chain_height)}}};
        }
        const std::string image_prefix = "/api/v2/tools/key-images/", output_prefix = "/api/v2/tools/outputs/",
            address_prefix = "/api/v2/tools/addresses/";
        if (path.compare(0, image_prefix.size(), image_prefix) == 0) {
            const auto result = transactions_.key_image(path.substr(image_prefix.size()));
            return {200, {{"data", {{"key_image", epee::string_tools::pod_to_hex(result.image)},
                {"spent", result.spent}, {"scope", "confirmed_chain"}}}, {"meta", meta(result.chain_height)}}};
        }
        if (path.compare(0, output_prefix.size(), output_prefix) == 0) {
            const auto ids = path.substr(output_prefix.size());
            if (ids.size() != 129 || ids[64] != '/') throw QueryFailure(QueryError::invalid, "Invalid output identifiers.");
            crypto::public_key key{};
            if (!epee::string_tools::hex_to_pod(ids.substr(65), key)) throw QueryFailure(QueryError::invalid, "Invalid output public key.");
            const auto result = transactions_.get(ids.substr(0, 64), false);
            json indices = json::array();
            for (size_t i = 0; i < result.metadata.outputs.size(); ++i)
                if (result.metadata.outputs[i].first.key == key) indices.push_back(i);
            return {200, {{"data", {{"transaction_hash", hex(result.metadata.hash)},
                {"public_key", epee::string_tools::pod_to_hex(key)}, {"curve_valid", crypto::check_key(key)},
                {"output_indices", indices}, {"state", result.in_pool ? "mempool" : "confirmed"}}},
                {"meta", meta(result.chain_height)}}};
        }
        if (path.compare(0, address_prefix.size(), address_prefix) == 0) {
            const auto result = transactions_.address(path.substr(address_prefix.size()));
            const auto& parsed = result.parsed;
            const auto name = result.network == cryptonote::MAINNET ? "mainnet" : result.network == cryptonote::TESTNET ? "testnet" : "stagenet";
            return {200, {{"data", {{"address", result.address}, {"valid", result.valid},
                {"network", result.valid ? json(name) : json(nullptr)}, {"matches_reader", result.matches_reader},
                {"kind", result.valid ? json(parsed.is_kurz ? "kurz" : parsed.has_payment_id ? "integrated" : parsed.is_subaddress ? "subaddress" : "standard") : json(nullptr)},
                {"spend_public_key", result.valid ? optional_key(parsed.address.m_spend_public_key) : json(nullptr)},
                {"view_public_key", result.valid ? optional_key(parsed.address.m_view_public_key) : json(nullptr)},
                {"payment_id8", result.valid && parsed.has_payment_id ? json(epee::string_tools::pod_to_hex(parsed.payment_id)) : json(nullptr)}}},
                {"meta", meta(result.chain_height)}}};
        }
        if (path == "/api/v2/network") {
            const auto snapshot = network_.get();
            // Units and target come from the pinned native configuration, not a new formula.
            static_assert(CRYPTONOTE_DISPLAY_DECIMAL_POINT == 9, "Review Ryo unit contract after a core change.");
            json data{{"source", "native_lmdb"}, {"tip", summary(snapshot.tip)},
                {"tip_difficulty", std::to_string(snapshot.tip_difficulty)},
                {"target_block_time_seconds", cryptonote::common_config::DIFFICULTY_TARGET},
                {"overview", {
                    {"issued_atomic", snapshot.issued_complete ? json(std::to_string(snapshot.issued_atomic)) : json(nullptr)},
                    {"tip_coinbase_atomic", std::to_string(snapshot.tip_coinbase_atomic)},
                    {"median_block_size_bytes", std::to_string(snapshot.median_size)},
                    {"median_sample_blocks", snapshot.median_sample_blocks},
                    {"confirmed_transactions", std::to_string(snapshot.confirmed_transactions)},
                    {"pool_transactions", snapshot.pool_complete ? json(std::to_string(snapshot.pool_transactions)) : json(nullptr)},
                    {"pool_size_bytes", snapshot.pool_complete ? json(std::to_string(snapshot.pool_size)) : json(nullptr)} }},
                {"units", {{"symbol", "RYO"}, {"atomic_decimals", CRYPTONOTE_DISPLAY_DECIMAL_POINT},
                    {"atomic_units_per_coin", std::to_string(cryptonote::MK_COINS(1))}}},
                {"explorer_version", "0.4.0"}, {"native_core_version", RYO_VERSION_FULL}, {"api_version", "2"}};
            return {200, {{"data", data}, {"meta", meta(snapshot.chain_height)}}};
        }
        if (path == "/api/v2/blocks") {
            unsigned limit = 10; std::string cursor;
            bool has_limit = false, has_cursor = false;
            if (question != std::string::npos) {
                auto query = target.substr(question + 1);
                if (query.empty()) throw QueryFailure(QueryError::invalid, "Empty query.");
                size_t start = 0;
                while (start <= query.size()) {
                    const auto end = query.find('&', start);
                    const auto part = query.substr(start, end == std::string::npos ? end : end - start);
                    const auto equals = part.find('=');
                    if (equals == std::string::npos || equals == 0 || equals + 1 == part.size() ||
                        part.find('=', equals + 1) != std::string::npos)
                        throw QueryFailure(QueryError::invalid, "Invalid query parameters.");
                    const auto key = part.substr(0, equals), value = part.substr(equals + 1);
                    if (key == "limit" && !has_limit) {
                        const auto parsed = parse_uint64(value);
                        if (parsed == 0 || parsed > 20) throw QueryFailure(QueryError::invalid, "Invalid page limit.");
                        limit = static_cast<unsigned>(parsed); has_limit = true;
                    } else if (key == "cursor" && !has_cursor) {
                        cursor = value; has_cursor = true;
                    } else throw QueryFailure(QueryError::invalid, "Unknown or duplicate parameter.");
                    if (end == std::string::npos) break;
                    start = end + 1;
                }
            }
            const auto page = blocks_.list(limit, cursor);
            json items = json::array();
            for (const auto& item : page.items) items.push_back(summary(item));
            json data{{"items", items}, {"anchor_height", std::to_string(page.anchor_height)},
                {"anchor_hash", hex(page.anchor_hash)},
                {"next_cursor", page.next_cursor.empty() ? json(nullptr) : json(page.next_cursor)}};
            return {200, {{"data", data}, {"meta", meta(page.chain_height)}}};
        }
        const std::string block_prefix = "/api/v2/blocks/", tx_prefix = "/api/v2/transactions/",
            raw_block_prefix = "/api/v2/raw/block/", raw_tx_prefix = "/api/v2/raw/transaction/";
        const bool block_raw = path.compare(0, raw_block_prefix.size(), raw_block_prefix) == 0;
        if (block_raw || path.compare(0, block_prefix.size(), block_prefix) == 0) {
            const auto id = path.substr(block_raw ? raw_block_prefix.size() : block_prefix.size());
            if (id.find('/') != std::string::npos) return error(404, "Route not found.");
            validate_block_id(id);
            auto block = blocks_.get(id);
            json data;
            if (block_raw) data = raw(block.hash, block.block,
                                     cryptonote::block_to_blob(block.block));
            else {
                json txs = json::array();
                for (size_t i = 0; i < block.transactions.size(); ++i)
                    txs.push_back(summary(block.transactions[i], block.metadata[i]));
                data = {{"header", summary(block_summary(block.block, block.hash, block.height, block.size))},
                        {"transactions", txs}};
            }
            return {200, {{"data", data}, {"meta", meta(block.chain_height)}}};
        }
        const bool tx_raw = path.compare(0, raw_tx_prefix.size(), raw_tx_prefix) == 0;
        if (tx_raw || path.compare(0, tx_prefix.size(), tx_prefix) == 0) {
            const auto id = path.substr(tx_raw ? raw_tx_prefix.size() : tx_prefix.size());
            if (id.find('/') != std::string::npos) return error(404, "Route not found.");
            auto result = transactions_.get(id, !tx_raw);
            auto& tx = result.transaction;
            const auto& metadata = result.metadata;
            json data;
            if (tx_raw) data = raw(metadata.hash, tx, cryptonote::tx_to_blob(tx));
            else {
                data = summary(tx, metadata);
                data["inclusion"] = {{"state", result.in_pool ? "mempool" : "confirmed"},
                    {"block_height", result.in_pool ? json(nullptr) : json(std::to_string(result.block_height))},
                    {"timestamp_unix", result.in_pool ? json(nullptr) : json(std::to_string(result.timestamp))},
                    {"confirmations", std::to_string(result.confirmations)}};
                data["unlock_time"] = std::to_string(tx.unlock_time);
                data["public_key"] = optional_key(metadata.public_key);
                data["additional_public_keys"] = json::array();
                for (const auto& key : metadata.additional_keys)
                    data["additional_public_keys"].push_back(epee::string_tools::pod_to_hex(key));
                data["payment_id"] = metadata.payment_id_present ? json(hex(metadata.payment_id)) : json(nullptr);
                data["payment_id8"] = metadata.payment_id8_present ?
                    json(epee::string_tools::pod_to_hex(metadata.payment_id8)) : json(nullptr);
                data["extra_hex"] = epee::string_tools::buff_to_hex_nodelimer(
                    std::string(tx.extra.begin(), tx.extra.end()));
                data["coinbase_height"] = metadata.coinbase ?
                    json(std::to_string(boost::get<cryptonote::txin_gen>(tx.vin.at(0)).height)) : json(nullptr);
                data["inputs"] = json::array(); data["outputs"] = json::array();
                for (size_t i = 0; i < metadata.inputs.size(); ++i) {
                    const auto& input = metadata.inputs[i];
                    json offsets = json::array(), candidates = json::array();
                    for (const auto offset : input.key_offsets) offsets.push_back(std::to_string(offset));
                    for (size_t j = 0; j < result.ring_members.at(i).size(); ++j) {
                        const auto& candidate = result.ring_members.at(i).at(j);
                        candidates.push_back({{"public_key", epee::string_tools::pod_to_hex(candidate.pubkey)},
                            {"block_height", std::to_string(candidate.height)},
                            {"timestamp_unix", std::to_string(result.ring_timestamps.at(i).at(j))}});
                    }
                    data["inputs"].push_back({{"key_image", epee::string_tools::pod_to_hex(input.k_image)},
                        {"key_offsets_relative", offsets}, {"ring_candidates", candidates}});
                }
                for (size_t i = 0; i < metadata.outputs.size(); ++i)
                    data["outputs"].push_back({{"index", i},
                        {"public_key", epee::string_tools::pod_to_hex(metadata.outputs[i].first.key)},
                        {"amount_atomic", metadata.output_amounts_visible ?
                            json(std::to_string(metadata.outputs[i].second)) : json(nullptr)}});
            }
            return {200, {{"data", data}, {"meta", meta(result.chain_height)}}};
        }
        return error(404, "Route not found.");
    } catch (const QueryFailure& failure) {
        if (failure.code == QueryError::invalid) return error(400, "Invalid request.");
        if (failure.code == QueryError::missing) return error(404, "Resource not found.");
        if (failure.code == QueryError::chain_changed) return error(409, "Chain changed; restart the query.");
        return error(503, "Native query unavailable or resource limit reached.");
    } catch (const std::exception&) { return error(503, "Native serialization unavailable."); }
}
}
