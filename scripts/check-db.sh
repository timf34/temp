#!/bin/bash

echo "Checking database connection..."

# Run a simple script to test database connection
docker-compose exec game-server-1 node -e "
const { getDatabase } = require('./src/server/db/database.js');

async function testDb() {
  try {
    console.log('Initializing database...');
    const db = await getDatabase();
    
    console.log('Testing leaderboard...');
    const leaderboard = await db.getLeaderboard();
    console.log('Leaderboard entries:', leaderboard.length);
    
    console.log('Testing player score update...');
    await db.updatePlayerScore('test-player', 'TestUser', 100);
    
    console.log('Testing game state...');
    await db.saveGameState('test-sector', { test: true });
    const state = await db.getGameState('test-sector');
    console.log('Retrieved state:', state);
    
    console.log('Database tests completed successfully!');
  } catch (error) {
    console.error('Database test failed:', error);
  }
}

testDb();
"

echo "Database check complete."

