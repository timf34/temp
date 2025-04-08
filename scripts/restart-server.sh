#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: ./restart-server.sh <server-number>"
  echo "Example: ./restart-server.sh 2"
  exit 1
fi

SERVER_NUM=$1
SERVER_NAME="game-server-$SERVER_NUM"

echo "Stopping $SERVER_NAME..."
docker-compose stop $SERVER_NAME

echo "Waiting 5 seconds..."
sleep 5

echo "Starting $SERVER_NAME..."
docker-compose start $SERVER_NAME

echo "Server restarted. Check logs with: docker-compose logs -f $SERVER_NAME"
