#!/bin/bash

echo "Stopping containers..."
docker-compose down

echo "Rebuilding and starting containers..."
docker-compose up --build -d

echo "Containers are now running."
echo "Access the client at: http://localhost:5173"
echo "Access the backend API at: http://localhost:3000"

echo "Showing logs..."
docker-compose logs -f

