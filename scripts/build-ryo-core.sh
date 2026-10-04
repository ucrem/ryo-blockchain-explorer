#!/usr/bin/env bash
# Apply only the reviewed compatibility patch to the pinned Ryo checkout.
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
task_patch="$task_root/scripts/patches/ryo-ubuntu24.patch"
if ! git -C "$task_core" diff --cached --quiet; then
    printf 'Refusing to modify a core checkout with staged changes.\n' >&2
    exit 1
fi
if git -C "$task_core" diff --quiet; then
    git -C "$task_core" apply --check "$task_patch"
    git -C "$task_core" apply "$task_patch"
elif git -C "$task_core" diff --binary | cmp -s - "$task_patch"; then
    printf 'The baseline compatibility patch is already applied.\n'
else
    printf 'Unexpected Ryo source modifications; refusing to overwrite them.\n' >&2
    exit 1
fi
cmake -S "$task_core" -B "$task_core/build/release" \
    -DCMAKE_BUILD_TYPE=Release -DARCH=default \
    -DBUILD_TESTS=OFF -DBUILD_DOCUMENTATION=OFF \
    '-DCMAKE_CXX_FLAGS=-Wno-error=deprecated-copy -Wno-error=misleading-indentation'
cmake --build "$task_core/build/release" --parallel "$task_jobs" --target wallet daemon
