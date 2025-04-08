#!/bin/bash

echo "Checking health of all services..."

echo "Redis:"
docker-compose exec redis redis-cli ping

echo "Game Servers:"
for i in 1 2 3; do
  echo "game-server-$i:"
  docker-compose exec -T game-server-$i curl -s http://localhost:3000/health || echo "Not responding"
done

echo "Nginx:"
docker-compose exec nginx curl -s http://localhost:80/health || echo "Not responding"

echo "Client:"
docker-compose ps client

echo "Health check complete."
