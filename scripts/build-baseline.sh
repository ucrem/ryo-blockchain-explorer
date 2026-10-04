#!/usr/bin/env bash
# Build and validate the selectively imported native Ryo components.
set -euo pipefail
if [[ $# -lt 1 || $# -gt 3 ]]; then
    printf 'Usage: bash scripts/build-baseline.sh RYO_SOURCE [BUILD_DIR] [JOBS]\n' >&2
    exit 2
fi
task_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
task_core=$(cd -- "$1" && pwd)
task_build=${2:-"$task_root/build/native"}
task_jobs=${3:-2}
if [[ ! "$task_jobs" =~ ^[1-9][0-9]*$ ]]; then
    printf 'JOBS must be a positive integer.\n' >&2
    exit 2
fi
for task_tool in cmake c++ git python3; do
    if ! command -v "$task_tool" >/dev/null 2>&1; then
        printf 'Missing required tool: %s. See docs/BUILD.md.\n' "$task_tool" >&2
        exit 1
    fi
done
task_pin=$(tr -d '\n' < "$task_root/scripts/ryo-core-revision.txt")
if [[ $(git -C "$task_core" rev-parse HEAD) != "$task_pin" ]]; then
    printf 'Ryo checkout must match the baseline pin %s.\n' "$task_pin" >&2
    exit 1
fi
if [[ ! -f "$task_core/build/release/bin/ryod" ]]; then
    printf 'Build the pinned Ryo wallet/daemon targets first; see docs/BUILD.md.\n' >&2
    exit 1
fi
cmake -S "$task_root" -B "$task_build" -DCMAKE_BUILD_TYPE=Release \
    -DRYO_CORE_DIR="$task_core" -DRYO_CORE_BUILD_DIR="$task_core/build/release" \
    -DBUILD_TESTING=ON
cmake --build "$task_build" --parallel "$task_jobs"
ctest --test-dir "$task_build" --output-on-failure
