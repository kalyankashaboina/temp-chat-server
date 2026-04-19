/**
 * Database Seed Script
 * Creates initial users, conversations, and messages for testing
 *
 * Usage: npm run seed
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../modules/users/user.model';
import { Conversation } from '../modules/conversations/conversation.model';
import { Message } from '../modules/messages/message.model';
import { connectMongo } from '../db/mongo';
import { logger } from '../shared/utils/logger';

// Test Users
const testUsers = [
  {
    username: 'Alice Johnson',
    email: 'alice@test.com',
    password: 'password123',
    bio: 'Software engineer passionate about real-time chat apps',
    avatar: 'https://i.pravatar.cc/150?img=1',
  },
  {
    username: 'Bob Smith',
    email: 'bob@test.com',
    password: 'password123',
    bio: 'Product manager who loves collaborative tools',
    avatar: 'https://i.pravatar.cc/150?img=2',
  },
  {
    username: 'Charlie Davis',
    email: 'charlie@test.com',
    password: 'password123',
    bio: 'Designer focused on user experience',
    avatar: 'https://i.pravatar.cc/150?img=3',
  },
  {
    username: 'Diana Wilson',
    email: 'diana@test.com',
    password: 'password123',
    bio: 'Developer advocate and tech enthusiast',
    avatar: 'https://i.pravatar.cc/150?img=4',
  },
  {
    username: 'Eve Martinez',
    email: 'eve@test.com',
    password: 'password123',
    bio: 'Data scientist exploring new technologies',
    avatar: 'https://i.pravatar.cc/150?img=5',
  },
];

async function seed() {
  try {
    logger.info('Starting database seed...');

    // Connect to MongoDB
    await connectMongo();

    // Clear existing data
    logger.info('Clearing existing data...');
    await User.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});

    // Create users
    logger.info('Creating test users...');
    const users = [];
    for (const userData of testUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const user = await User.create({
        ...userData,
        password: hashedPassword,
        isOnline: false,
      });
      users.push(user);
      logger.info(`  OK - Created user: ${user.username} (${user.email})`);
    }

    // Create conversations
    logger.info('Creating conversations...');

    // Direct conversation: Alice <-> Bob
    const conv1 = await Conversation.create({
      type: 'direct',
      participants: [users[0]._id, users[1]._id],
    });
    logger.info(`  OK - Created conversation: Alice <-> Bob`);

    // Direct conversation: Alice <-> Charlie
    const conv2 = await Conversation.create({
      type: 'direct',
      participants: [users[0]._id, users[2]._id],
    });
    logger.info(`  OK - Created conversation: Alice <-> Charlie`);

    // Group conversation: Alice, Bob, Charlie
    const conv3 = await Conversation.create({
      type: 'group',
      name: 'Project Team',
      participants: [users[0]._id, users[1]._id, users[2]._id],
      createdBy: users[0]._id,
    });
    logger.info(`  OK - Created group: Project Team`);

    // Group conversation: All users
    const conv4 = await Conversation.create({
      type: 'group',
      name: 'All Hands',
      participants: users.map((u) => u._id),
      createdBy: users[0]._id,
    });
    logger.info(`  OK - Created group: All Hands`);

    // Create messages
    logger.info('Creating messages...');

    // Messages in Alice <-> Bob conversation
    const messages1 = [
      {
        conversationId: conv1._id,
        senderId: users[0]._id,
        content: 'Hey Bob! How are you?',
        type: 'text' as const,
        createdAt: new Date(Date.now() - 300000), // 5 min ago
        readBy: [users[1]._id],
      },
      {
        conversationId: conv1._id,
        senderId: users[1]._id,
        content: "Hi Alice! I'm doing great, thanks for asking!",
        type: 'text' as const,
        createdAt: new Date(Date.now() - 240000), // 4 min ago
        readBy: [users[0]._id],
      },
      {
        conversationId: conv1._id,
        senderId: users[0]._id,
        content: 'Have you seen the new feature we shipped?',
        type: 'text' as const,
        createdAt: new Date(Date.now() - 180000), // 3 min ago
        readBy: [users[1]._id],
      },
      {
        conversationId: conv1._id,
        senderId: users[1]._id,
        content: 'Yes! The real-time messaging is super fast ',
        type: 'text' as const,
        createdAt: new Date(Date.now() - 120000), // 2 min ago
        readBy: [users[0]._id],
        reactions: [{ userId: users[0]._id, emoji: '👍', username: 'Alice Johnson' }],
      },
      {
        conversationId: conv1._id,
        senderId: users[0]._id,
        content: 'Should we add voice calls next?',
        type: 'text' as const,
        createdAt: new Date(Date.now() - 60000), // 1 min ago
        deliveredTo: [users[1]._id],
      },
    ];

    // Messages in Alice <-> Charlie conversation
    const messages2 = [
      {
        conversationId: conv2._id,
        senderId: users[0]._id,
        content: 'Charlie, the new UI looks amazing!',
        type: 'text' as const,
        createdAt: new Date(Date.now() - 3600000),
        readBy: [users[2]._id],
      },
      {
        conversationId: conv2._id,
        senderId: users[2]._id,
        content: 'Thank you! I spent a lot of time on the color palette',
        type: 'text' as const,
        createdAt: new Date(Date.now() - 3540000),
        readBy: [users[0]._id],
      },
    ];

    // Messages in Project Team group
    const messages3 = [
      {
        conversationId: conv3._id,
        senderId: users[1]._id,
        content: 'Team, we have a meeting at 3pm today',
        type: 'text' as const,
        createdAt: new Date(Date.now() - 7200000),
        readBy: [users[0]._id, users[2]._id],
      },
      {
        conversationId: conv3._id,
        senderId: users[0]._id,
        content: "Got it! I'll be there",
        type: 'text' as const,
        createdAt: new Date(Date.now() - 7140000),
        readBy: [users[1]._id],
      },
      {
        conversationId: conv3._id,
        senderId: users[2]._id,
        content: 'Same here 👍',
        type: 'text' as const,
        createdAt: new Date(Date.now() - 7080000),
        readBy: [users[0]._id, users[1]._id],
      },
    ];

    // Messages in All Hands group
    const messages4 = [
      {
        conversationId: conv4._id,
        senderId: users[0]._id,
        content: 'Welcome everyone to the Relay Chat!',
        type: 'text' as const,
        createdAt: new Date(Date.now() - 86400000),
        readBy: [users[1]._id, users[2]._id, users[3]._id, users[4]._id],
      },
      {
        conversationId: conv4._id,
        senderId: users[1]._id,
        content: 'Excited to be here!',
        type: 'text' as const,
        createdAt: new Date(Date.now() - 86340000),
        readBy: [users[0]._id],
      },
    ];

    // Insert all messages
    const allMessages = [...messages1, ...messages2, ...messages3, ...messages4];
    await Message.insertMany(allMessages);
    logger.info(`  OK - Created ${allMessages.length} messages`);

    // Summary
    logger.info('\nOK - Seed complete!');
    logger.info('Summary:');
    logger.info(`  - Users: ${users.length}`);
    logger.info(`  - Conversations: 4 (2 direct, 2 groups)`);
    logger.info(`  - Messages: ${allMessages.length}`);
    logger.info('Test Credentials:');
    testUsers.forEach((u) => {
      logger.info(`  - ${u.email} / ${u.password}`);
    });

    process.exit(0);
  } catch (error) {
    logger.error('Seed failed:', error);
    process.exit(1);
  }
}

// Run seed
seed();
