#!/bin/bash
# Generates /etc/squid/passwords from SQUID_USER/SQUID_PASSWORD, then hands off
# to the image's own entrypoint (which starts squid with the given command args).
set -e

SQUID_USER="${SQUID_USER:-oibus}"
SQUID_PASSWORD="${SQUID_PASSWORD:-pass}"

echo "${SQUID_USER}:$(openssl passwd -6 "${SQUID_PASSWORD}")" > /etc/squid/passwords

exec /usr/local/bin/entrypoint.sh "$@"
