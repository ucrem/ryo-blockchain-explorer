#!/usr/bin/env python3
"""Check API v2 schemas/examples and provide offline HTTP response validators."""
import copy
import json
from pathlib import Path
import re

from jsonschema import Draft202012Validator
import yaml


ROOT = Path(__file__).resolve().parents[1]
SPEC_PATH = ROOT / "docs/api-v2.openapi.yaml"
EXAMPLES_PATH = ROOT / "docs/api-v2.examples.json"


def load_spec():
    return yaml.safe_load(SPEC_PATH.read_text(encoding="utf-8"))


def validator(spec, schema_name):
    # Keep component references local to this schema document. This works with
    # Ubuntu 24.04's packaged jsonschema without downloading runtime references.
    return Draft202012Validator(
        {"$ref": f"#/components/schemas/{schema_name}", "components": spec["components"]})


def check_references(spec):
    def visit(value):
        if isinstance(value, dict):
            if "$ref" in value:
                ref = value["$ref"]
                if not ref.startswith("#/"):
                    raise ValueError(f"Non-local reference in bundled contract: {ref}")
                target = spec
                for part in ref[2:].split("/"):
                    target = target[part.replace("~1", "/").replace("~0", "~")]
            for item in value.values():
                visit(item)
        elif isinstance(value, list):
            for item in value:
                visit(item)
    visit(spec)


def expect_invalid(checker, value, label):
    if checker.is_valid(value):
        raise ValueError(f"Contract incorrectly accepts {label}")


def main():
    spec = load_spec()
    if spec["openapi"] != "3.1.1" or spec["info"]["version"] != "0.3.0":
        raise ValueError("Unexpected OpenAPI/product version")
    check_references(spec)
    for schema in spec["components"]["schemas"].values():
        Draft202012Validator.check_schema(schema)

    operations = set()
    for path, item in spec["paths"].items():
        operation = item["get"]
        if operation["operationId"] in operations:
            raise ValueError("Duplicate operationId")
        operations.add(operation["operationId"])
        parameters = operation.get("parameters", [])
        names = set()
        for parameter in parameters:
            if "$ref" in parameter:
                parameter = spec["components"]["parameters"][parameter["$ref"].split("/")[-1]]
            if parameter["in"] == "path":
                if not parameter.get("required"):
                    raise ValueError("Path parameter must be required")
                names.add(parameter["name"])
        if names != set(re.findall(r"\{([^}]+)\}", path)):
            raise ValueError(f"Path parameter mismatch: {path}")

    examples = json.loads(EXAMPLES_PATH.read_text(encoding="utf-8"))
    for name, example in examples.items():
        validator(spec, name).validate(example)

    # Known public fixture values, not native interpretation reimplemented here.
    fixtures = ROOT / "tests/fixtures"
    genesis = json.loads((fixtures / "genesis-transaction.json").read_text())["data"]
    tx = examples["TransactionResponse"]["data"]
    assert tx["hash"] == genesis["tx_hash"]
    assert tx["outputs"][0]["public_key"] == genesis["outputs"][0]["public_key"]
    assert tx["outputs"][0]["amount_atomic"] == str(genesis["outputs"][0]["amount"])
    assert tx["extra_hex"] == genesis["extra"]
    assert tx["version"] == genesis["tx_version"]
    assert tx["ringct_type"] == genesis["rct_type"]
    assert tx["size_bytes"] == str(genesis["tx_size"])
    assert examples["RawResponse"]["data"]["blob_hex"] == (
        fixtures / "genesis-transaction.hex").read_text().strip()
    assert examples["RawResponse"]["data"]["native_json"] == json.loads(
        (fixtures / "genesis-raw-transaction.json").read_text())["data"]
    ringct = json.loads((fixtures / "ringct-v3-transaction.json").read_text())["data"]
    assert examples["Output"]["public_key"] == ringct["outputs"][0]["public_key"]
    assert examples["Output"]["amount_atomic"] is None

    uint = validator(spec, "UInt64")
    for value in ["0", "9007199254740993", "18446744073709551615"]:
        uint.validate(value)
    for value in [0, 9007199254740993, "01", "-1", "1.0", "1e9", "", "9" * 21]:
        expect_invalid(uint, value, "noncanonical or inexact integer")
    broken = copy.deepcopy(examples["TransactionResponse"])
    broken["data"]["outputs"][0]["amount_atomic"] = genesis["outputs"][0]["amount"]
    expect_invalid(validator(spec, "TransactionResponse"), broken, "numeric atomic amount")
    broken["data"]["outputs"][0]["amount_atomic"] = "8800000000000000"
    broken["data"]["first_seen"] = "1791135062"
    expect_invalid(validator(spec, "TransactionResponse"), broken, "propagation metadata field")
    hidden = copy.deepcopy(examples["TransactionResponse"])
    hidden["data"].update(coinbase=False, coinbase_height=None, version=3, ringct_type=3)
    expect_invalid(validator(spec, "TransactionResponse"), hidden, "known amount claimed for RingCT output")
    hidden["data"]["outputs"][0]["amount_atomic"] = None
    validator(spec, "TransactionResponse").validate(hidden)
    pool = examples["Inclusion"]
    broken = {**pool, "timestamp_unix": "1791135062"}
    expect_invalid(validator(spec, "Inclusion"), broken, "pool timestamp")
    broken = {**pool, "confirmations": "1"}
    expect_invalid(validator(spec, "Inclusion"), broken, "confirmed pool state")
    confirmed = {**pool, "state": "confirmed"}
    expect_invalid(validator(spec, "Inclusion"), confirmed, "confirmed state without inclusion")
    invalid_cursor = "0." + "0" * 64 + ".01"
    expect_invalid(validator(spec, "Cursor"), invalid_cursor, "noncanonical cursor")
    print(f"PASS: {len(operations)} operations, {len(examples)} examples, "
          "local references, DTO schemas, precision and privacy rejection cases")



if __name__ == "__main__":
    main()
