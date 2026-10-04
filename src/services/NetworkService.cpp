#include "NetworkService.h"

namespace ryo_explorer {
NetworkSnapshot NetworkService::get() {
    try {
        QueryContext::Read read(context_);
        auto& db = read.db();
        NetworkSnapshot result;
        result.chain_height = db.height();
        if (result.chain_height == 0)
            throw QueryFailure(QueryError::database, "Native chain is empty.");
        result.tip = read_block_summary(db, result.chain_height - 1);
        result.tip_difficulty = db.get_block_difficulty(result.chain_height - 1);
        return result;
    } catch (const QueryFailure&) { throw; }
      catch (const std::exception&) { throw QueryFailure(QueryError::database, "Native database read failed."); }
}
}
