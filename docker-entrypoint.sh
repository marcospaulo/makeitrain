#!/bin/bash
set -e

# Start Xvfb (virtual framebuffer) for headed browser mode
echo "Starting Xvfb..."
Xvfb :99 -screen 0 1920x1080x24 &
sleep 2

# Optionally start VNC for debugging
if [ "$ENABLE_VNC" = "true" ]; then
    echo "Starting VNC server on port 5900..."
    x11vnc -display :99 -forever -nopw -quiet &
fi

# Execute the main command
exec "$@"
