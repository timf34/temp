#!/bin/bash

# Simulate failure of a random game server
SERVERS=("game-server-1" "game-server-2" "game-server-3")
RANDOM_SERVER=${SERVERS[$RANDOM % ${#SERVERS[@]}]}

echo "Simulating failure of $RANDOM_SERVER..."
docker-compose stop $RANDOM_SERVER

echo "Server stopped. The system should continue to function."
echo "Clients should reconnect to other available servers."

# Wait for a while
echo "Waiting 30 seconds before restoring the server..."
sleep 30

# Restore the server
docker-compose start $RANDOM_SERVER
echo "$RANDOM_SERVER has been restored."

