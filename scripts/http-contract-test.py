#!/usr/bin/env python3
"""Test the real read-only HTTP executable against a disposable offline genesis DB."""
from concurrent.futures import ThreadPoolExecutor
import http.client
import json
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
            return response.status, data
        finally:
            connection.close()

    def launch(enabled, log):
        command = [server, "--bc-path", chain, "--port", str(port)]
        if enabled:
            command.append("--enable-json-api")
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
        check(process.returncode == 0, "HTTP shutdown was not clean.")

    with tempfile.TemporaryFile() as log:
        process = launch(True, log)
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
            for route in ("/", "/api/v2/network", "/api/networkinfo", "/api/push"):
                check(request(route)[0] == 404, "Unsupported route returned a success.")
            check(request("/api/version", method="POST")[0] == 405, "Write method accepted.")
            check(request("/api/block/0", body="data")[0] == 400, "Request body accepted.")
            check(request("/" + "x" * 1100)[0] == 400, "Oversized target accepted.")
            check(request("/health?viewkey=example")[0] == 400, "Unexpected secret-bearing query target accepted.")
            check(request("/health", headers={"X-Large": "x" * 5000})[0] == 400, "Oversized header accepted.")
            batch_started = time.monotonic()
            with ThreadPoolExecutor(max_workers=8) as pool:
                results = list(pool.map(lambda _: request("/api/block/0"), range(24)))
            batch_seconds = time.monotonic() - batch_started
            check(all(result == (200, block) for result in results), "Concurrent response mismatch.")
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
            partial = socket.create_connection(("127.0.0.1", port), timeout=5)
            partial.sendall(b"GET /health HTTP/1.1\r\n")
            stop(process)
            partial.close()
        finally:
            if process.poll() is None:
                stop(process)
        for arguments in (["--bc-path", chain, "--testnet", "--stagenet"],
                          ["--bc-path", chain, "--testnet"],
                          ["--bc-path", chain, "--port", "0"],
                          ["--bc-path", chain + "/missing"]):
            result = subprocess.run([server] + arguments, stdout=log, stderr=subprocess.STDOUT, timeout=10)
            check(result.returncode != 0, "Invalid startup configuration accepted.")
    print("Legacy HTTP/raw contracts, bounds, concurrency, flags, deadlines, and shutdown passed.")


if __name__ == "__main__":
    main()
