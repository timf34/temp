#!/bin/bash

# Monitor the cluster status
echo "Monitoring cluster status..."
echo "Press Ctrl+C to exit"

while true; do
  clear
  echo "=== Distributed Pac-Man Cluster Status ==="
  echo ""
  
  echo "=== Containers ==="
  docker-compose ps
  
  echo ""
  echo "=== Redis Status ==="
  docker-compose exec redis redis-cli info | grep connected_clients
  
  echo ""
  echo "=== Game Server Logs (last 5 lines per server) ==="
  for server in game-server-1 game-server-2 game-server-3; do
    echo "--- $server ---"
    docker-compose logs --tail=5 $server
  done
  
  sleep 5
done

