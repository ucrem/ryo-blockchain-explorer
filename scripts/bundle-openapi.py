#!/usr/bin/env python3
"""Bundle the repository-local OpenAPI YAML as native build-time JSON bytes."""
import json
from pathlib import Path
import sys
import yaml

source, destination = map(Path, sys.argv[1:])
document = yaml.safe_load(source.read_text(encoding="utf-8"))
text = json.dumps(document, separators=(",", ":"), ensure_ascii=True)
delimiter = "RYO_OPENAPI"
if f'){delimiter}\"' in text:
    raise ValueError("Invalid native raw-string delimiter in specification")
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(
    '#pragma once\nnamespace ryo_explorer {\n'
    f'constexpr const char* openapi_document = R"{delimiter}({text}){delimiter}";\n'
    '}\n', encoding="utf-8")
