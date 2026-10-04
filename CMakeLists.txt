cmake_minimum_required(VERSION 3.24)
project(RyoExplorerFoundation LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(RYO_CORE_DIR "" CACHE PATH "Separately compiled official Ryo source checkout")
if(NOT EXISTS "${RYO_CORE_DIR}/src/cryptonote_config.h")
    message(FATAL_ERROR "Set RYO_CORE_DIR to the pinned Ryo checkout; see docs/BUILD.md.")
endif()
set(RYO_CORE_BUILD_DIR "${RYO_CORE_DIR}/build/release" CACHE PATH "Compiled Ryo build directory")
include(cmake/RyoCore.cmake)

add_library(ryo_fmt STATIC
    "${RYO_CORE_DIR}/external/fmt/src/format.cc"
    "${RYO_CORE_DIR}/external/fmt/src/posix.cc")
target_include_directories(ryo_fmt SYSTEM PUBLIC "${RYO_CORE_DIR}/external/fmt/include")
target_compile_features(ryo_fmt PUBLIC cxx_std_14)

add_library(ryo_explorer_core STATIC
    src/MicroCore.cpp src/tools.cpp src/rpccalls.cpp
    src/MempoolStatus.cpp src/CurrentBlockchainStatus.cpp)
target_include_directories(ryo_explorer_core PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/src")
target_compile_features(ryo_explorer_core PUBLIC cxx_std_14)
target_link_libraries(ryo_explorer_core PUBLIC ryo_fmt Ryo::core)

option(RYO_BUILD_BENCHMARKS "Build read-only native query diagnostics" OFF)
if(RYO_BUILD_BENCHMARKS)
    add_executable(ryo_native_lookup_benchmark tests/native_lookup_benchmark.cpp)
    target_link_libraries(ryo_native_lookup_benchmark PRIVATE ryo_explorer_core)
endif()

include(CTest)
if(BUILD_TESTING)
    find_package(Python3 REQUIRED COMPONENTS Interpreter)
    add_executable(ryo_genesis_fixture tests/genesis_fixture.cpp)
    target_link_libraries(ryo_genesis_fixture PRIVATE ryo_explorer_core)
    add_test(NAME ryo_mainnet_genesis COMMAND ryo_genesis_fixture
        "${CMAKE_CURRENT_SOURCE_DIR}/tests/fixtures/genesis-transaction.hex")
    add_executable(ryo_native_chain_fixture tests/native_chain_fixture.cpp)
    target_link_libraries(ryo_native_chain_fixture PRIVATE ryo_explorer_core)
    add_test(NAME ryo_native_offline COMMAND "${Python3_EXECUTABLE}"
        "${CMAKE_CURRENT_SOURCE_DIR}/scripts/offline-native-test.py"
        "${RYO_CORE_BUILD_DIR}/bin/ryod" $<TARGET_FILE:ryo_native_chain_fixture>)
    set_tests_properties(ryo_native_offline PROPERTIES TIMEOUT 180)
endif()
