/**
 * In-Memory MongoDB Server for Development/Testing
 *
 * This script starts an in-memory MongoDB instance so we can
 * test the application without installing MongoDB locally.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer | null = null;

export async function startInMemoryMongo(): Promise<string> {
  console.log('🔄 Starting in-memory MongoDB...');

  mongoServer = await MongoMemoryServer.create({
    instance: {
      port: 27017, // Use default MongoDB port
      dbName: 'relay-chat',
    },
    binary: {
      version: '7.0.14', // Use stable version that works on Ubuntu
    },
  });

  const uri = mongoServer.getUri();
  console.log('OK - In-memory MongoDB started at:', uri);

  return uri;
}

export async function stopInMemoryMongo(): Promise<void> {
  if (mongoServer) {
    await mongoServer.stop();
    console.log('🛑 In-memory MongoDB stopped');
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  await stopInMemoryMongo();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stopInMemoryMongo();
  process.exit(0);
});
