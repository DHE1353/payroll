#!/bin/sh
# Initialize DB if needed
cd /app/backend
node src/db/init.js 2>/dev/null || true

# Start backend in background
node src/server.js &

# Start nginx in foreground
nginx -g 'daemon off;'
