#!/usr/bin/env python3
"""Record source and asset hashes for reproducible, reviewable browser crypto."""
import hashlib
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parent.parent
core = Path(sys.argv[1])
sources = ["src/crypto/crypto.cpp", "src/crypto/crypto-ops.c", "src/crypto/crypto-ops-data.c",
           "src/crypto/keccak.c", "src/crypto/hash.c", "src/common/base58.cpp", "src/common/string.cpp",
           "src/ringct/rctOps.cpp", "src/ringct/rctTypes.cpp", "src/cryptonote_basic/cryptonote_basic_impl.cpp",
           "src/cryptonote_basic/cryptonote_format_utils.cpp", "contrib/epee/src/hex.cpp", "contrib/epee/src/memwipe.c"]
digest = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
assets = root / "web/public/crypto"
manifest = {"ryo_revision": (root / "scripts/ryo-core-revision.txt").read_text().strip(),
            "emscripten": "6.0.12", "boost_headers": "1.83.0", "memory_bytes": 67108864,
            "reviewed_patches_sha256": {file.name: digest(file) for file in sorted((root / "scripts/patches").glob("*.patch"))},
            "sdk_sources_sha256": {file: digest(core / file) for file in sources},
            "explorer_sources_sha256": {file: digest(root / file) for file in
                ["verification/ReceiveVerifier.cpp", "verification/WasmEntry.cpp", "verification/ReceiveVerifier.h",
                 "scripts/build-receive-wasm.sh", "third_party/json/json.hpp"]},
            "assets_sha256": {file: digest(assets / file) for file in ["ryo-receive.mjs", "ryo-receive.wasm", "LICENSES.txt"]}}
(assets / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
