FROM node:18

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Create data directory for LibSQL
RUN mkdir -p /data
VOLUME /data

# Expose the application port
EXPOSE 3000

# Start the server
CMD ["node", "src/server/index.js"]

