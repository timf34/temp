#!/bin/bash

echo "Checking build process..."

# Install dependencies
npm install

# Try to build
echo "Running npm run build..."
npm run build

# Check if dist directory exists
if [ -d "dist" ]; then
  echo "Build successful! dist directory found."
  ls -la dist
else
  echo "dist directory not found. Checking other possible build output locations..."
  
  if [ -d "build" ]; then
    echo "build directory found."
    ls -la build
  else
    echo "No build output directory found."
    echo "Checking vite.config.js for build output configuration..."
    
    if [ -f "vite.config.js" ]; then
      echo "vite.config.js found:"
      cat vite.config.js
    else
      echo "vite.config.js not found."
    fi
    
    echo "Checking package.json build script:"
    grep -A 3 "\"scripts\"" package.json
  fi
fi

echo "Done checking build process."

