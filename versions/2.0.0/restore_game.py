#!/usr/bin/env python3
# Restore latest approved HOJA 2.0 Game.html from its SHA-verified text chunks.
# Only the current release chunks are stored; superseded R17S parts are removed.
from pathlib import Path
import hashlib
import json

folder = Path(__file__).resolve().parent
manifest = json.loads((folder / "SHA256_MANIFEST.json").read_text(encoding="utf-8"))
parts = manifest["parts"]
if len(parts) != manifest["partCount"]:
    raise SystemExit("PART_COUNT_MISMATCH")

chunks = []
for p in parts:
    data = (folder / "Game.html.parts" / p["name"]).read_bytes()
    actual_git_sha = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
    if len(data) != p["bytes"] or actual_git_sha != p["gitBlobSha1"]:
        raise SystemExit("PART_SHA_MISMATCH: " + p["name"])
    chunks.append(data)

content = b"".join(chunks)
digest = hashlib.sha256(content).hexdigest()
if len(content) != manifest["bytes"] or digest != manifest["sha256"]:
    raise SystemExit("GAME_SHA256_MISMATCH")

output = folder.parents[1] / "Game.html"
output.write_bytes(content)
print(f"RESTORED {output} ({len(content)} bytes), SHA256={digest}")
