# Link the separately built, pinned official Ryo archives without vendoring the chain.
add_library(ryo_native_dependencies INTERFACE)
add_library(Ryo::core ALIAS ryo_native_dependencies)

foreach(archive IN ITEMS wallet blockchain_db cryptonote_core cryptonote_protocol
        cryptonote_basic multisig daemonizer cncrypto lmdb ringct ringct_basic
        device common mnemonics checkpoints version epee)
    find_library(RYO_ARCHIVE_${archive} NAMES ${archive}
        PATHS "${RYO_CORE_BUILD_DIR}"
        PATH_SUFFIXES lib src src/${archive} src/crypto src/ringct
            external/db_drivers/lib${archive} contrib/epee/src
        NO_DEFAULT_PATH REQUIRED)
    add_library(Ryo::${archive} STATIC IMPORTED)
    set_target_properties(Ryo::${archive} PROPERTIES
        IMPORTED_LOCATION "${RYO_ARCHIVE_${archive}}")
    target_link_libraries(ryo_native_dependencies INTERFACE Ryo::${archive})
endforeach()

target_include_directories(ryo_native_dependencies SYSTEM INTERFACE
    "${RYO_CORE_DIR}/src" "${RYO_CORE_DIR}/external" "${RYO_CORE_DIR}/build"
    "${RYO_CORE_DIR}/external/easylogging++"
    "${RYO_CORE_DIR}/external/fmt/include"
    "${RYO_CORE_DIR}/contrib/epee/include"
    "${RYO_CORE_DIR}/external/db_drivers/liblmdb")

find_package(Boost 1.83 CONFIG REQUIRED COMPONENTS system filesystem thread date_time
    chrono regex serialization program_options locale)
find_package(Threads REQUIRED)
target_link_libraries(ryo_native_dependencies INTERFACE
    Boost::system Boost::filesystem Boost::thread Boost::date_time Boost::chrono
    Boost::regex Boost::serialization Boost::program_options Boost::locale
    Threads::Threads unbound curl crypto ssl atomic unwind dl)
