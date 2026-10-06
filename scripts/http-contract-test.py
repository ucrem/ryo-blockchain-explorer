#!/usr/bin/env python3
"""Test the real read-only HTTP executable against a disposable offline genesis DB."""
from concurrent.futures import ThreadPoolExecutor
import http.client
import json
import runpy
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time


def check(value, message):
    if not value:
        raise RuntimeError(message)


def main():
    server, chain, _rpc = sys.argv[1:]
    fixtures = Path(__file__).resolve().parent.parent / "tests" / "fixtures"
    block_hash = "6eb04b6b8c68049a76206fe2805ede5f7465c03b7112850d3262a067b9914dac"
    tx_hash = "ef9edde12f78ce1776ce1886b3e448d8f3575bc25111231370989baeae4a2d88"
    helpers = runpy.run_path(str(Path(__file__).with_name("check-api-v2-contract.py")))
    specification = helpers["load_spec"]()
    examples = json.loads((fixtures.parents[1] / "docs/api-v2.examples.json").read_text())

    def validate(data, schema):
        helpers["validator"](specification, schema).validate(data)
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]

    def request(path, method="GET", body=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=12)
        try:
            connection.request(method, path, body=body, headers=headers or {})
            response = connection.getresponse()
            data = json.loads(response.read())
            check(response.getheader("Cache-Control") == "no-store", "Unexpected public caching.")
            check(response.getheader("X-Content-Type-Options") == "nosniff", "Missing content-type guard.")
            if response.status == 405:
                check(response.getheader("Allow") == "GET", "Missing allowed-method header.")
            return response.status, data
        finally:
            connection.close()

    def launch(enabled, log, v2_enabled=False):
        command = [server, "--bc-path", chain, "--port", str(port)]
        if enabled:
            command.append("--enable-json-api")
        if v2_enabled:
            command.append("--enable-api-v2")
        process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT)
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            check(process.poll() is None, "HTTP server exited before readiness.")
            try:
                if request("/health")[0] == 200:
                    return process
            except (OSError, http.client.HTTPException):
                time.sleep(0.1)
        process.terminate()
        process.wait(timeout=10)
        raise RuntimeError("HTTP readiness timed out.")

    def stop(process):
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
                raise RuntimeError("HTTP shutdown timed out.")
        if process.returncode != 0:
            log.seek(0)
            print(log.read().decode(errors="replace")[-4000:], file=sys.stderr)
            raise RuntimeError(f"HTTP server exited with {process.returncode}.")

    with tempfile.TemporaryFile() as log:
        process = launch(True, log, True)
        try:
            status, block = request("/api/block/0")
            expected = json.loads((fixtures / "genesis-block.json").read_text())
            expected["data"]["current_height"] = 1
            check(status == 200 and block == expected, "Legacy block contract mismatch.")
            check(request("/api/block/" + block_hash)[1] == block, "Legacy block hash lookup mismatch.")
            status, transaction = request("/api/transaction/" + tx_hash)
            expected = json.loads((fixtures / "genesis-transaction.json").read_text())
            expected["data"]["current_height"] = 1
            expected["data"]["confirmations"] = 1
            check(status == 200 and transaction == expected, "Legacy transaction contract mismatch.")
            for route, name in (("/api/rawblock/0", "genesis-raw-block.json"),
                                ("/api/rawtransaction/" + tx_hash, "genesis-raw-transaction.json")):
                check(request(route) == (200, json.loads((fixtures / name).read_text())), "Native raw contract mismatch.")
            status, version = request("/api/version")
            check(status == 200 and version["data"]["api"] == 65537 and
                  version["data"]["blockchain_height"] == 1 and version["data"]["last_git_commit_hash"],
                  "Legacy version contract mismatch.")
            for route in ("/api/block/1", "/api/block/-1", "/api/block/18446744073709551616",
                          "/api/transaction/invalid", "/api/transaction/" + "0" * 64):
                status, data = request(route)
                check(status == 200 and data["status"] == "fail", "Legacy query fail contract mismatch.")
            for route in ("/", "/api/networkinfo", "/api/push"):
                check(request(route)[0] == 404, "Unsupported route returned a success.")
            check(request("/api/version", method="POST")[0] == 405, "Write method accepted.")
            check(request("/api/block/0", body="data")[0] == 400, "Request body accepted.")
            check(request("/" + "x" * 1100)[0] == 400, "Oversized target accepted.")
            check(request("/health?viewkey=example")[0] == 400, "Unexpected secret-bearing query target accepted.")
            check(request("/health", headers={"X-Large": "x" * 5000})[0] == 400, "Oversized header accepted.")
            status, network = request("/api/v2/network")
            check(status == 200, "V2 network query failed.")
            validate(network, "NetworkResponse")
            check(network["data"]["tip"] == examples["NetworkResponse"]["data"]["tip"] and
                  network["data"]["tip_difficulty"] == "1" and network["data"]["units"]["atomic_decimals"] == 9,
                  "V2 native network values differ from genesis.")
            v2_routes = (("/api/v2/blocks", "BlockPageResponse"),
                         ("/api/v2/block-intervals?window=1h", "BlockIntervalsResponse"),
                         ("/api/v2/blocks?limit=1", "BlockPageResponse"),
                         ("/api/v2/blocks/0", "BlockResponse"),
                         ("/api/v2/transactions/" + tx_hash, "TransactionResponse"))
            for route, schema in v2_routes:
                status, data = request(route)
                check(status == 200, "V2 lookup failed.")
                validate(data, schema)
                check(data == examples[schema], "V2 genesis response differs from documented example.")
            for window in ("24h", "7d", "30d"):
                status, data = request("/api/v2/block-intervals?window=" + window + "&anchor=" + block_hash)
                check(status == 200 and not data["data"]["points"], "Genesis interval window differs.")
                validate(data, "BlockIntervalsResponse")
            for suffix in ("?", "?window=", "?window=2h", "?window=1h&window=7d", "?anchor=x",
                           "?anchor=" + block_hash + "&anchor=" + block_hash, "?window=%31h",
                           "?window=1h&", "?viewkey=example", "?limit=1"):
                check(request("/api/v2/block-intervals" + suffix)[0] == 400,
                      "Invalid interval query accepted.")
            check(request("/api/v2/blocks/" + block_hash.upper()) == request("/api/v2/blocks/0"),
                  "V2 block height/hash/case lookup differs.")
            check(request("/api/v2/transactions/" + tx_hash.upper()) == request("/api/v2/transactions/" + tx_hash),
                  "V2 transaction hash case lookup differs.")
            for route, name in (("/api/v2/raw/block/0", "genesis-raw-block.json"),
                                ("/api/v2/raw/transaction/" + tx_hash, "genesis-raw-transaction.json")):
                status, data = request(route)
                check(status == 200, "V2 raw query failed.")
                validate(data, "RawResponse")
                check(data["data"]["native_json"] == json.loads((fixtures / name).read_text())["data"],
                      "V2 raw native JSON differs from public capture.")
                if "transaction" in route:
                    check(data == examples["RawResponse"], "V2 raw native transaction bytes differ.")
            check(request("/api/v2/openapi.json") == (200, specification), "Bundled OpenAPI differs from source.")
            errors = {
                400: ("/api/v2/blocks/-1", "/api/v2/blocks/01", "/api/v2/blocks/18446744073709551616",
                      "/api/v2/transactions/invalid", "/api/v2/blocks?", "/api/v2/blocks?limit=",
                      "/api/v2/blocks?limit=0", "/api/v2/blocks?limit=21", "/api/v2/blocks?limit=01",
                      "/api/v2/blocks?limit=1&limit=2", "/api/v2/blocks?limit=1&", "/api/v2/blocks?cursor=",
                      "/api/v2/blocks?cursor=x", "/api/v2/blocks?cursor=x&cursor=x", "/api/v2/blocks?foo=1",
                      "/api/v2/blocks?viewkey=example", "/api/v2/blocks?limit=%31", "/api/v2/network?limit=1",
                      "/api/v2/network#fragment", "/api/v2/" + "x" * 1100),
                404: ("/api/v2/blocks/1", "/api/v2/transactions/" + "0" * 64,
                      "/api/v2/blocks/" + "0" * 64, "/api/v2/mempool", "/api/v2/blocks/0/extra"),
                409: ("/api/v2/blocks?cursor=1." + "0" * 64 + ".0",),
            }
            codes = {400: "invalid_request", 404: "not_found", 409: "chain_changed"}
            for expected_status, routes in errors.items():
                for route in routes:
                    status, data = request(route)
                    check(status == expected_status and data["error"]["code"] == codes[status],
                          f"Unexpected V2 error/status for {route}")
                    validate(data, "ErrorResponse")
            for route, options in (("/api/v2/network", {"method": "POST"}),
                                   ("/api/v2/network", {"body": "data"}),
                                   ("/api/v2/network", {"headers": {"X-Large": "x" * 5000}})):
                status, data = request(route, **options)
                check(status == (405 if "method" in options else 400), "V2 transport error mapping failed.")
                validate(data, "ErrorResponse")
            batch_started = time.monotonic()
            with ThreadPoolExecutor(max_workers=8) as pool:
                results = list(pool.map(lambda _: request("/api/block/0"), range(24)))
            batch_seconds = time.monotonic() - batch_started
            check(all(result == (200, block) for result in results), "Concurrent response mismatch.")
            with ThreadPoolExecutor(max_workers=8) as pool:
                v2_results = list(pool.map(lambda _: request("/api/v2/blocks?limit=1"), range(24)))
            check(all(result == (200, examples["BlockPageResponse"]) for result in v2_results),
                  "Concurrent V2 snapshot mismatch.")
            print(f"HTTP diagnostic: 24 checked block queries in one concurrent batch took {batch_seconds * 1000:.3f} ms.")
            with socket.create_connection(("127.0.0.1", port), timeout=12) as slow:
                slow.sendall(b"GET /health HTTP/1.1\r\nHost: localhost\r\n")
                check(request("/health")[0] == 200, "Partial client blocked healthy clients.")
                time.sleep(6)
                check(slow.recv(1) == b"", "Partial request deadline not enforced.")
            check(request("/health")[0] == 200, "Server failed after malformed/slow clients.")
        finally:
            stop(process)
        process = launch(False, log)
        try:
            check(request("/api/version")[0] == 404 and request("/health")[0] == 200,
                  "JSON API enable flag failed.")
            status, data = request("/api/v2/network")
            check(status == 404 and data["error"]["code"] == "not_found", "Disabled V2 flag failed.")
            partial = socket.create_connection(("127.0.0.1", port), timeout=5)
            partial.sendall(b"GET /health HTTP/1.1\r\n")
            stop(process)
            partial.close()
        finally:
            if process.poll() is None:
                stop(process)
        process = launch(False, log, True)
        try:
            check(request("/api/version")[0] == 404 and request("/api/v2/network")[0] == 200,
                  "V2-only enablement failed.")
        finally:
            stop(process)
        process = launch(True, log, False)
        try:
            check(request("/api/version")[0] == 200 and request("/api/v2/network")[0] == 404,
                  "Legacy-only enablement failed.")
        finally:
            stop(process)
        for arguments in (["--bc-path", chain, "--testnet", "--stagenet"],
                          ["--bc-path", chain, "--testnet"],
                          ["--bc-path", chain, "--port", "0"],
                          ["--bc-path", chain + "/missing"]):
            result = subprocess.run([server] + arguments, stdout=log, stderr=subprocess.STDOUT, timeout=10)
            check(result.returncode != 0, "Invalid startup configuration accepted.")
    print("Legacy and V2 HTTP/raw/schema contracts, bounds, concurrency, independent flags, deadlines, and shutdown passed.")


if __name__ == "__main__":
    main()
