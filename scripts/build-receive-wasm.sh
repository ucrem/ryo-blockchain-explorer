#!/usr/bin/env bash
# Regenerate the bundled browser verifier from the pinned, reviewed Ryo SDK.
set -euo pipefail
if [[ $# != 3 ]]; then
    printf 'Usage: bash scripts/build-receive-wasm.sh RYO_SOURCE EMSDK BOOST_INCLUDE\n' >&2
    exit 2
fi
task_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
task_core=$(cd -- "$1" && pwd)
task_emsdk=$(cd -- "$2" && pwd)
task_boost=$(cd -- "$3" && pwd)
python3 "$task_root/scripts/apply-ryo-patches.py" "$task_core"
source "$task_emsdk/emsdk_env.sh"
[[ $(emcc --version | head -1) == *'6.0.12'* ]] || { printf 'Emscripten 6.0.12 is required.\n' >&2; exit 1; }
[[ $(cat "$task_boost/boost/version.hpp") == *'BOOST_VERSION 108300'* ]] || { printf 'Boost 1.83.0 headers are required.\n' >&2; exit 1; }
task_build="$task_root/build/receive-wasm"
task_assets="$task_root/web/public/crypto"
mkdir -p "$task_build/include" "$task_assets"
ln -sfn "$task_boost/boost" "$task_build/include/boost"
# BOOST_HAS_PTHREADS makes SDK header-only mutex declarations available with
# Emscripten's single-thread libc stubs; no pthreads/shared memory are enabled.
task_flags=(-std=c++14 -O2 -fwasm-exceptions -DNDEBUG -DFMT_HEADER_ONLY -DBOOST_HAS_PTHREADS
    -ffile-prefix-map="$task_core"=ryo-sdk -ffile-prefix-map="$task_root"=explorer
    -I"$task_build/include" -I"$task_core/src" -I"$task_core/contrib/epee/include"
    -I"$task_core/external" -I"$task_core/external/fmt/include")
for task_file in crypto/crypto.cpp common/base58.cpp common/string.cpp ringct/rctOps.cpp ringct/rctTypes.cpp cryptonote_basic/cryptonote_basic_impl.cpp cryptonote_basic/cryptonote_format_utils.cpp; do
    em++ "${task_flags[@]}" -c "$task_core/src/$task_file" -o "$task_build/$(basename "$task_file").o"
done
em++ "${task_flags[@]}" -c "$task_core/contrib/epee/src/hex.cpp" -o "$task_build/hex.cpp.o"
for task_file in crypto-ops.c crypto-ops-data.c keccak.c hash.c; do
    emcc -O2 -I"$task_build/include" -I"$task_core/src" -I"$task_core/contrib/epee/include" \
        -c "$task_core/src/crypto/$task_file" -o "$task_build/$task_file.o"
done
emcc -O2 -I"$task_core/contrib/epee/include" -c "$task_core/contrib/epee/src/memwipe.c" -o "$task_build/memwipe.o"
em++ "${task_flags[@]}" "$task_root/verification/ReceiveVerifier.cpp" "$task_root/verification/WasmEntry.cpp" \
    "$task_build/"*.o --no-entry -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node \
    -sEXPORTED_FUNCTIONS='["_ryo_receive_request","_ryo_wipe","_malloc","_free"]' \
    -sEXPORTED_RUNTIME_METHODS='["UTF8ToString","stringToUTF8","lengthBytesUTF8"]' \
    -sINITIAL_MEMORY=67108864 -sSTACK_SIZE=1048576 -sALLOW_MEMORY_GROWTH=0 -sABORTING_MALLOC=0 \
    -o "$task_assets/ryo-receive.mjs"
chmod 0644 "$task_assets/ryo-receive.mjs" "$task_assets/ryo-receive.wasm"
python3 "$task_root/scripts/receive-wasm-manifest.py" "$task_core"
