#!/bin/bash

# Scale the number of game server instances
if [ -z "$1" ]; then
  echo "Usage: ./scale-cluster.sh <number_of_instances>"
  exit 1
fi

docker-compose up -d --scale game-server=$1

echo "Scaled game server to $1 instances"

