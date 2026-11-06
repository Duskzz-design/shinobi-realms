#!/bin/sh
# Unpack this upload's changed files, then copy any other site file from the live site.
set -e
[ -f p.tar.xz ] && tar xJf p.tar.xz && rm p.tar.xz
while read -r f; do
  [ -z "$f" ] && continue
  if [ ! -f "$f" ]; then
    mkdir -p "$(dirname "$f")"
    curl -fsSL "https://shinobi-realms.netlify.app/$f" -o "$f"
    echo "kept $f from live site"
  fi
done < files.txt
