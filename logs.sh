#!/bin/bash

# Show logs for all services or a specific service
if [ -z "$1" ]; then
  docker-compose logs -f
else
  docker-compose logs -f $1
fi

