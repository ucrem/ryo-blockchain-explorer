#!/usr/bin/env python3
"""Validate imported C++ implementations using a temporary offline Ryo genesis DB."""
import argparse
import math
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import URLError
from urllib.request import urlopen


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ryod", type=Path)
    parser.add_argument("fixture_executable", type=Path)
    parser.add_argument("--result-file", type=Path,
                        help="Save the native executable's stdout to this diagnostic file.")
    parser.add_argument("--timeout", type=float, default=30,
                        help="Native executable timeout in seconds (default: 30).")
    args = parser.parse_args()
    if not math.isfinite(args.timeout) or args.timeout <= 0:
        parser.error("--timeout must be finite and positive.")
    daemon = args.ryod.resolve(strict=True)
    fixture = args.fixture_executable.resolve(strict=True)
    ports = set()
    while len(ports) < 3:
        ports.add(free_port())
    rpc, p2p, zmq = sorted(ports)
    with tempfile.TemporaryDirectory(prefix="ryo-native-fixture-") as scratch:
        work = Path(scratch)
        with (work / "daemon.log").open("wb") as log:
            process = subprocess.Popen([
                str(daemon), "--offline", "--non-interactive", "--no-igd",
                "--data-dir", str(work / "chain"), "--log-file", str(work / "node.log"),
                "--rpc-bind-ip", "127.0.0.1", "--rpc-bind-port", str(rpc),
                "--p2p-bind-ip", "127.0.0.1", "--p2p-bind-port", str(p2p),
                "--zmq-rpc-bind-ip", "127.0.0.1", "--zmq-rpc-bind-port", str(zmq),
            ], cwd=work, stdout=log, stderr=subprocess.STDOUT)
            try:
                base = f"http://127.0.0.1:{rpc}"
                deadline = time.monotonic() + 120
                while time.monotonic() < deadline:
                    if process.poll() is not None:
                        raise RuntimeError(f"Offline daemon exited: {process.returncode}")
                    try:
                        with urlopen(base + "/get_info", timeout=3) as response:
                            info = json.load(response)
                        if info["height"] != 1:
                            raise RuntimeError("Expected a fresh genesis-only chain.")
                        break
                    except (URLError, TimeoutError):
                        time.sleep(0.25)
                else:
                    raise RuntimeError("Offline daemon readiness timed out.")
                command = [str(fixture), str(work / "chain" / "lmdb02"), base]
                if args.result_file:
                    with args.result_file.open("wb") as result:
                        subprocess.run(command, stdout=result, check=True, timeout=args.timeout)
                else:
                    subprocess.run(command, check=True, timeout=args.timeout)
                print("Disposable offline native integration checks passed.")
            except Exception:
                log.flush()
                print((work / "daemon.log").read_text(errors="replace")[-8000:], file=sys.stderr)
                raise
            finally:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=15)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()


if __name__ == "__main__":
    main()
