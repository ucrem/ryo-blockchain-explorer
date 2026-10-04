#pragma once
#include "MicroCore.h"
#include <mutex>
#include <stdexcept>

namespace ryo_explorer {
enum class QueryError { invalid, missing, database, chain_changed, limit };
class QueryFailure : public std::runtime_error {
public:
    QueryError code;
    QueryFailure(QueryError value, const std::string& message)
        : std::runtime_error(message), code(value) {}
};

// One application context serializes native reads. Services never nest read scopes.
class QueryContext {
    xmreg::MicroCore& core_;
    std::mutex mutex_;
public:
    explicit QueryContext(xmreg::MicroCore& core) : core_(core) {}
    class Read {
        std::unique_lock<std::mutex> lock_;
        cryptonote::BlockchainDB& db_;
    public:
        explicit Read(QueryContext& context)
            : lock_(context.mutex_), db_(context.core_.get_core().get_db()) {
            if (!db_.is_open()) throw QueryFailure(QueryError::database, "Native database is closed.");
            db_.block_txn_start(true);
        }
        ~Read() noexcept {
            try { db_.block_txn_stop(); } catch (...) { /* Native scope cleanup cannot throw. */ }
        }
        Read(const Read&) = delete;
        Read& operator=(const Read&) = delete;
        cryptonote::BlockchainDB& db() { return db_; }
    };
};

inline crypto::hash parse_hash(const std::string& text) {
    crypto::hash hash;
    if (text.size() != 64 || !xmreg::parse_str_secret_key(text, hash))
        throw QueryFailure(QueryError::invalid, "Invalid 64-character hexadecimal hash.");
    return hash;
}
}
