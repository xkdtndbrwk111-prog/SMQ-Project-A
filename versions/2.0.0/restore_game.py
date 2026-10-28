#!/usr/bin/env python3
"""Reassemble HOJA QUIZ 2.0 R17S Game.html, verify SHA-256, refuse mismatches."""
from pathlib import Path
import hashlib

folder = Path(__file__).resolve().parent
parts = sorted((folder / "Game.html.parts").glob("part-*.txt"))
if len(parts) != 16:
    raise SystemExit(f"Expected 16 parts, got {len(parts)}")
raw = b"".join(p.read_bytes() for p in parts)
if hashlib.sha256(raw).hexdigest() != "f382c0ebfc01a17f9733e7e75e994698f82aa333a5918a78150ce310a5c3ce7e":
    raise SystemExit("FAIL: stored part data SHA-256 mismatch")
# The text extraction transport removed a trailing LF in each of six read windows.
for offset in reversed((113844,3168168,4017503,6528284,6590194)):
    raw = raw[:offset] + b"\n" + raw[offset:]
raw += b"\n"
want = "8ef1856efe8380d97e22e183e66b8b1771b04ca3de9457128646c74681d3c9d0"
if len(raw) != 7163576 or hashlib.sha256(raw).hexdigest() != want:
    raise SystemExit("FAIL: canonical source not restored")
dest=folder / "Game.html"
dest.write_bytes(raw)
print(f"OK: {dest} — {len(raw)} bytes — SHA-256 {want}")
