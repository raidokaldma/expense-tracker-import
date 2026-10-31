#!/bin/sh
# Fetches and imports every enabled connection, unattended. The app logs a line per connection; this only adds a
# line when the request itself fails.
wget -q -O /dev/null --header 'Content-Type: application/json' \
  --post-data '{"mode":"scheduled"}' http://app:3000/api/import/fetch ||
  echo "$(date '+%F %T') scheduled fetch failed: the app did not answer with success"
