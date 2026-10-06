// Native calculations extracted from official explorer 2e334724, page.h get_tx_details.
// Original project attribution and licenses are retained in THIRD_PARTY_NOTICES.md.
#include "TransactionMetadata.h"

namespace ryo_explorer {
TransactionMetadata transaction_metadata(const cryptonote::transaction& tx) {
    TransactionMetadata result;
    result.hash = cryptonote::get_transaction_hash(tx);
    result.coinbase = cryptonote::is_coinbase(tx);
    result.public_key = xmreg::get_tx_pub_key_from_received_outs(tx);
    result.additional_keys = cryptonote::get_additional_tx_pub_keys_from_extra(tx);
    const auto totals = xmreg::summary_of_in_out_rct(tx, result.outputs, result.inputs);
    result.output_atoms = totals[0]; result.input_atoms = totals[1];
    result.ring_size = totals[2]; result.non_ringct_inputs = totals[3];
    if (!result.coinbase && !tx.vin.empty()) result.fee = cryptonote::get_tx_fee(tx);
    result.size = cryptonote::get_object_blobsize(tx);
    xmreg::get_payment_id(tx, result.payment_id, result.payment_id8);
    // Presence is distinct from all-zero bytes. Keep the legacy numeric convention
    // unchanged while allowing v2 to preserve a present zero-valued payment ID.
    std::vector<cryptonote::tx_extra_field> fields;
    cryptonote::tx_extra_nonce nonce;
    if (cryptonote::parse_tx_extra(tx.extra, fields) &&
        cryptonote::find_tx_extra_field_by_type(fields, nonce)) {
        result.payment_id8_present = cryptonote::get_encrypted_payment_id_from_tx_extra_nonce(
            nonce.nonce, result.payment_id8);
        if (!result.payment_id8_present)
            result.payment_id_present = cryptonote::get_payment_id_from_tx_extra_nonce(nonce.nonce, result.payment_id);
    }
    cryptonote::tx_extra_uniform_payment_id uniform_pid;
    result.uniform_payment_id_present = cryptonote::get_payment_id_from_tx_extra(tx.extra, uniform_pid);
    result.input_amounts_visible = !result.inputs.empty() &&
        result.non_ringct_inputs == result.inputs.size();
    result.output_amounts_visible = result.coinbase || tx.rct_signatures.type == 0;
    return result;
}
}
