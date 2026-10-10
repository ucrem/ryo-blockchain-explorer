#pragma once

#include <string>

// Native SDK operations only; JSON is the bounded browser-worker boundary.
std::string receive_verifier_request(const std::string& request);
