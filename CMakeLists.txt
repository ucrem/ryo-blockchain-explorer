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
    src/MempoolStatus.cpp src/CurrentBlockchainStatus.cpp
    src/services/TransactionMetadata.cpp src/services/BlockService.cpp
    src/services/TransactionService.cpp src/services/NetworkService.cpp)
target_include_directories(ryo_explorer_core PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/src")
target_compile_features(ryo_explorer_core PUBLIC cxx_std_14)
target_link_libraries(ryo_explorer_core PUBLIC ryo_fmt Ryo::core)

execute_process(COMMAND git rev-parse --short HEAD WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
    OUTPUT_VARIABLE RYO_EXPLORER_COMMIT OUTPUT_STRIP_TRAILING_WHITESPACE)
execute_process(COMMAND git show -s --format=%cs HEAD WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
    OUTPUT_VARIABLE RYO_EXPLORER_COMMIT_DATE OUTPUT_STRIP_TRAILING_WHITESPACE)
execute_process(COMMAND git branch --show-current WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
    OUTPUT_VARIABLE RYO_EXPLORER_BRANCH OUTPUT_STRIP_TRAILING_WHITESPACE)
add_library(ryo_explorer_legacy_json STATIC api/LegacyJson.cpp)
target_include_directories(ryo_explorer_legacy_json PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/api")
target_link_libraries(ryo_explorer_legacy_json PUBLIC ryo_explorer_core)
target_compile_definitions(ryo_explorer_legacy_json PRIVATE
    RYO_EXPLORER_COMMIT="${RYO_EXPLORER_COMMIT}"
    RYO_EXPLORER_COMMIT_DATE="${RYO_EXPLORER_COMMIT_DATE}"
    RYO_EXPLORER_BRANCH="${RYO_EXPLORER_BRANCH}")
option(RYO_BUILD_HTTP "Build the separate read-only HTTP executable" OFF)
add_library(ryo_explorer_api_v2 STATIC api/ApiV2.cpp api/ApiRouter.cpp)
target_include_directories(ryo_explorer_api_v2 PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/api")
target_link_libraries(ryo_explorer_api_v2 PUBLIC ryo_explorer_legacy_json)
if(RYO_BUILD_HTTP)
    find_package(Python3 REQUIRED COMPONENTS Interpreter)
    add_custom_command(OUTPUT "${CMAKE_CURRENT_BINARY_DIR}/generated/OpenApiDocument.h"
        COMMAND "${Python3_EXECUTABLE}" "${CMAKE_CURRENT_SOURCE_DIR}/scripts/bundle-openapi.py"
            "${CMAKE_CURRENT_SOURCE_DIR}/docs/api-v2.openapi.yaml"
            "${CMAKE_CURRENT_BINARY_DIR}/generated/OpenApiDocument.h"
        DEPENDS docs/api-v2.openapi.yaml scripts/bundle-openapi.py
        VERBATIM)
    add_executable(ryo_explorer_http app/main.cpp api/HttpServer.cpp)
    target_sources(ryo_explorer_http PRIVATE "${CMAKE_CURRENT_BINARY_DIR}/generated/OpenApiDocument.h")
    target_include_directories(ryo_explorer_http PRIVATE "${CMAKE_CURRENT_BINARY_DIR}/generated")
    target_link_libraries(ryo_explorer_http PRIVATE ryo_explorer_api_v2)
endif()

option(RYO_BUILD_BENCHMARKS "Build read-only native query diagnostics" OFF)
if(RYO_BUILD_BENCHMARKS)
    add_executable(ryo_native_lookup_benchmark tests/native_lookup_benchmark.cpp)
    target_link_libraries(ryo_native_lookup_benchmark PRIVATE ryo_explorer_api_v2)
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
    add_executable(ryo_service_fixture tests/service_fixture.cpp)
    target_link_libraries(ryo_service_fixture PRIVATE ryo_explorer_api_v2)
    target_compile_definitions(ryo_service_fixture PRIVATE
        RYO_FIXTURE_DIR="${CMAKE_CURRENT_SOURCE_DIR}/tests/fixtures")
    set(RYO_SERVICE_TEST_ARGS "")
    if(RYO_BUILD_HTTP)
        set(RYO_SERVICE_TEST_ARGS --api-v2-contracts)
    endif()
    add_test(NAME ryo_native_services COMMAND "${Python3_EXECUTABLE}"
        "${CMAKE_CURRENT_SOURCE_DIR}/scripts/offline-native-test.py"
        "${RYO_CORE_BUILD_DIR}/bin/ryod" $<TARGET_FILE:ryo_service_fixture> ${RYO_SERVICE_TEST_ARGS})
    set_tests_properties(ryo_native_services PROPERTIES TIMEOUT 180)
    if(RYO_BUILD_HTTP)
        add_test(NAME ryo_api_v2_schema COMMAND "${Python3_EXECUTABLE}"
            "${CMAKE_CURRENT_SOURCE_DIR}/scripts/check-api-v2-contract.py")
        add_test(NAME ryo_http_contracts COMMAND "${Python3_EXECUTABLE}"
            "${CMAKE_CURRENT_SOURCE_DIR}/scripts/offline-native-test.py"
            "${RYO_CORE_BUILD_DIR}/bin/ryod" $<TARGET_FILE:ryo_explorer_http> --http --timeout 60)
        set_tests_properties(ryo_http_contracts PROPERTIES TIMEOUT 210)
    endif()
endif()
