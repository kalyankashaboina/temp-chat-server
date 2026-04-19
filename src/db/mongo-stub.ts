/**
 * MongoDB Stub for Development
 *
 * When real MongoDB is not available, this provides a minimal
 * implementation to allow the server to start and basic testing.
 *
 * WARNING: Data is NOT persisted. For testing only.
 */

import mongoose from 'mongoose';

const USE_STUB = process.env.USE_MONGO_STUB === 'true';

export async function connectMongoStub() {
  if (!USE_STUB) {
    throw new Error('MongoDB stub is not enabled. Set USE_MONGO_STUB=true');
  }

  console.log('WARNING -  WARNING: Using MongoDB stub - data will NOT persist!');
  console.log('WARNING -  This is for development/testing only');

  // Override the connection state
  // @ts-expect-error - we need to override readonly property for stub
  mongoose.connection.readyState = 1; // Set to connected state

  console.log('OK - MongoDB stub initialized (no persistence)');
}

export const isStubMode = () => USE_STUB;
