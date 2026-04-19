#!/bin/sh
# DB is initialized by index.js on import, no need for init.js
cd /app/backend

# Start backend in background
node src/server.js &

# Start nginx in foreground
nginx -g 'daemon off;'
