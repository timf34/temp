#!/bin/bash

# Run all services including the client
docker-compose up -d

echo "All services are running."
echo "Access the client at: http://localhost:5173"
echo "Access the backend API at: http://localhost:3000"

