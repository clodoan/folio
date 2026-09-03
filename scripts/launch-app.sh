#!/bin/sh
set -e
cd "$(dirname "$0")/.."
npm run build
exec npx electron .
