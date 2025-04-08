#!/bin/bash

# Run only the backend services (useful if you want to run the client separately)
docker-compose up -d redis nginx game-server-1 game-server-2 game-server-3

echo "Backend services are running."
echo "You can run the client locally with: npm run dev:client"
echo "Or access the backend API at: http://localhost:3000"

