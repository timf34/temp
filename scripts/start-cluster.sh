#!/bin/bash

# Start the entire cluster
docker-compose up -d

echo "Distributed Pac-Man cluster is starting..."
echo "Access the game at http://localhost:5173"
echo "Access the API at http://localhost:3000"

# Wait for services to be ready
sleep 5

# Show running containers
docker-compose ps

