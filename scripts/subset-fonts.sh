#!/usr/bin/env bash
# Cuts the Fixel fonts down to the characters this site shows (Ukrainian/Russian Cyrillic incl. ґ, basic Latin for EN,
# Latin-1 symbols such as « » © ° ² · ×, dashes, quotes, ≈ ≤ ≥ № ₴; no accented Latin letters). Full fonts: scripts/fonts-src/ (MacPaw Fixel, SIL OFL).
# Output: assets/fonts/fixel/*-sub.woff2 (about half the full size). Characters outside the set fall back to the
# system font. Needs: pip install fonttools brotli
set -euo pipefail
cd "$(dirname "$0")/.."
UNICODES="U+0020-007E,U+00A0-00BF,U+00D7,U+00F7,U+0400-045F,U+0490-0491,U+02BC,U+2010-2027,U+2030-203A,U+20B4,U+2116,U+2122,U+2212,U+2248,U+2264-2265"
for f in scripts/fonts-src/*.woff2; do
  name=$(basename "$f" .woff2)
  pyftsubset "$f" --unicodes="$UNICODES" --layout-features='*' --flavor=woff2 \
    --output-file="assets/fonts/fixel/${name}-sub.woff2"
  echo "$name: $(stat -c %s "$f") -> $(stat -c %s "assets/fonts/fixel/${name}-sub.woff2") bytes"
done
