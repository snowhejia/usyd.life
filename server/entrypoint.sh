#!/bin/sh
set -eu
data_dir="${DATA_DIR:-/data}"
mkdir -p "$data_dir"
if [ "$(id -u)" = "0" ]; then
  chown node:node "$data_dir"
  for database_file in "$data_dir/stats.sqlite3" "$data_dir/stats.sqlite3-wal" "$data_dir/stats.sqlite3-shm"; do
    if [ -f "$database_file" ]; then chown node:node "$database_file"; fi
  done
  exec su-exec node "$@"
fi
exec "$@"
