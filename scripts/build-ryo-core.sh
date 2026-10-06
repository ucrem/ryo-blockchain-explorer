#!/usr/bin/env bash
# Build the pinned SDK with only its reviewed native maintenance patches.
set -euo pipefail
if [[ $# -lt 1 || $# -gt 2 ]]; then
    printf 'Usage: bash scripts/build-ryo-core.sh RYO_SOURCE [JOBS]\n' >&2
    exit 2
fi
task_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
task_core=$(cd -- "$1" && pwd)
task_jobs=${2:-2}
if [[ ! "$task_jobs" =~ ^[1-9][0-9]*$ ]]; then
    printf 'JOBS must be a positive integer.\n' >&2
    exit 2
fi
task_pin=$(tr -d '\n' < "$task_root/scripts/ryo-core-revision.txt")
if [[ $(git -C "$task_core" rev-parse HEAD) != "$task_pin" ]]; then
    printf 'Ryo checkout must match %s. No checkout/history changes were made.\n' "$task_pin" >&2
    exit 1
fi
python3 "$task_root/scripts/apply-ryo-patches.py" "$task_core"
task_config_flags=()
if [[ -f "$task_core/build/release/CMakeCache.txt" ]]; then
    task_cxx_flags=$(python3 - "$task_core/build/release/CMakeCache.txt" <<'PY'
from pathlib import Path
import re
import sys
for line in Path(sys.argv[1]).read_text().splitlines():
    if line.startswith("CMAKE_CXX_FLAGS:STRING="):
        flags = line.split("=", 1)[1]
        cleaned = re.sub(r"(?<!\S)-Wno-error=(?:deprecated-copy|misleading-indentation)(?!\S)", "", flags).strip()
        if cleaned != flags:
            print("Removed the baseline's legacy copy/indentation error exemptions.", file=sys.stderr)
        print(cleaned)
        break
PY
)
    task_config_flags+=("-DCMAKE_CXX_FLAGS=$task_cxx_flags")
fi
cmake -S "$task_core" -B "$task_core/build/release" \
    -DCMAKE_BUILD_TYPE=Release -DARCH=default \
    -DBUILD_TESTS=OFF -DBUILD_DOCUMENTATION=OFF "${task_config_flags[@]}"
cmake --build "$task_core/build/release" --parallel "$task_jobs" --target wallet daemon
