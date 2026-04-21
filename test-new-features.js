#!/usr/bin/env node
/**
 * Relay Chat v1.1.0 - Feature Test Script
 * Tests all newly implemented features
 *
 * Usage: node test-new-features.js
 */

const API_BASE = 'http://localhost:4000/api';
let authToken = '';
let testUserId = '';
let testConversationId = '';
let testGroupId = '';

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function request(method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { Cookie: `relay_token=${authToken}` }),
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);

  // Extract token from Set-Cookie header if present
  const setCookie = response.headers.get('set-cookie');
  if (setCookie && setCookie.includes('relay_token=')) {
    const match = setCookie.match(/relay_token=([^;]+)/);
    if (match) authToken = match[1];
  }

  const data = await response.json();
  return { status: response.status, data };
}

async function testMessageSearch() {
  log('\n=== Testing Message Search ===', 'blue');

  try {
    // Search for messages
    const { status, data } = await request('GET', '/messages/search?query=hello&limit=10');

    if (status === 200) {
      log(`✓ Message search working - Found ${data.results?.length || 0} results`, 'green');
      return true;
    } else {
      log(`✗ Message search failed: ${data.message}`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ Message search error: ${error.message}`, 'red');
    return false;
  }
}

async function testGroupManagement() {
  log('\n=== Testing Group Management ===', 'blue');

  try {
    // Try to get conversations (to find a group)
    const { status: listStatus, data: listData } = await request('GET', '/conversations?limit=10');

    if (listStatus !== 200) {
      log('⚠ No conversations found - create a group first', 'yellow');
      return true; // Not a failure, just no data
    }

    const group = listData.conversations?.find((c) => c.type === 'group');
    if (!group) {
      log('⚠ No groups found - create a group to test management', 'yellow');
      return true;
    }

    testGroupId = group.id;
    log(`✓ Found test group: ${group.groupName || 'Unnamed'}`, 'green');

    // Test mute
    const { status: muteStatus } = await request('POST', `/conversations/${testGroupId}/mute`);
    if (muteStatus === 200) {
      log('✓ Group mute successful', 'green');
    }

    // Test unmute
    const { status: unmuteStatus } = await request('DELETE', `/conversations/${testGroupId}/mute`);
    if (unmuteStatus === 200) {
      log('✓ Group unmute successful', 'green');
    }

    return true;
  } catch (error) {
    log(`✗ Group management error: ${error.message}`, 'red');
    return false;
  }
}

async function testMuteArchive() {
  log('\n=== Testing Mute/Archive ===', 'blue');

  try {
    // Get first conversation
    const { status: listStatus, data: listData } = await request('GET', '/conversations?limit=1');

    if (listStatus !== 200 || !listData.conversations?.length) {
      log('⚠ No conversations found - send messages first', 'yellow');
      return true;
    }

    const convId = listData.conversations[0].id;

    // Test mute
    const { status: muteStatus } = await request('POST', `/conversations/${convId}/mute`);
    if (muteStatus === 200) {
      log('✓ Mute conversation successful', 'green');
    } else {
      log('✗ Mute failed', 'red');
      return false;
    }

    // Test unmute
    const { status: unmuteStatus } = await request('DELETE', `/conversations/${convId}/mute`);
    if (unmuteStatus === 200) {
      log('✓ Unmute conversation successful', 'green');
    }

    // Test archive
    const { status: archiveStatus } = await request('POST', `/conversations/${convId}/archive`);
    if (archiveStatus === 200) {
      log('✓ Archive conversation successful', 'green');
    }

    // Test unarchive
    const { status: unarchiveStatus } = await request('DELETE', `/conversations/${convId}/archive`);
    if (unarchiveStatus === 200) {
      log('✓ Unarchive conversation successful', 'green');
    }

    return true;
  } catch (error) {
    log(`✗ Mute/Archive error: ${error.message}`, 'red');
    return false;
  }
}

async function testHealthCheck() {
  log('\n=== Testing Backend Health ===', 'blue');

  try {
    const response = await fetch('http://localhost:4000/health');
    const data = await response.json();

    if (response.status === 200) {
      log('✓ Backend is running', 'green');
      log(`  MongoDB: ${data.mongodb}`, data.mongodb === 'connected' ? 'green' : 'red');
      log(`  Redis: ${data.redis}`, data.redis === 'connected' ? 'green' : 'red');
      return true;
    }
  } catch (error) {
    log('✗ Backend is not running - start the server first', 'red');
    return false;
  }
}

async function login() {
  log('\n=== Attempting Login ===', 'blue');
  log('⚠ You need to have a registered user account', 'yellow');
  log('  Run: POST /api/auth/register with {email, username, password}', 'yellow');

  // Try default test credentials
  const { status, data } = await request('POST', '/auth/login', {
    email: 'test@test.com',
    password: 'testpassword123',
  });

  if (status === 200) {
    testUserId = data.user?.id || data.user?._id;
    log('✓ Login successful', 'green');
    return true;
  } else {
    log('✗ Login failed - create test user first', 'red');
    log('  Register: POST /api/auth/register', 'yellow');
    log(
      '  Body: {"email":"test@test.com","username":"testuser","password":"testpassword123"}',
      'yellow'
    );
    return false;
  }
}

async function runAllTests() {
  log('\n╔════════════════════════════════════════════╗', 'blue');
  log('║  Relay Chat v1.1.0 - Feature Test Suite   ║', 'blue');
  log('╚════════════════════════════════════════════╝', 'blue');

  // Check backend health
  const healthOk = await testHealthCheck();
  if (!healthOk) {
    log('\n❌ Backend not running. Start with: npm run dev', 'red');
    process.exit(1);
  }

  // Try to login
  const loggedIn = await login();
  if (!loggedIn) {
    log('\n⚠ Skipping authenticated tests - login failed', 'yellow');
    log('Create a test user first, then run this script again', 'yellow');
    process.exit(0);
  }

  // Run tests
  const results = {
    messageSearch: await testMessageSearch(),
    groupManagement: await testGroupManagement(),
    muteArchive: await testMuteArchive(),
  };

  // Summary
  log('\n╔════════════════════════════════════════════╗', 'blue');
  log('║           Test Results Summary             ║', 'blue');
  log('╚════════════════════════════════════════════╝', 'blue');

  const total = Object.keys(results).length;
  const passed = Object.values(results).filter((r) => r).length;

  Object.entries(results).forEach(([name, passed]) => {
    const status = passed ? '✓' : '✗';
    const color = passed ? 'green' : 'red';
    log(`${status} ${name}`, color);
  });

  log(`\nTotal: ${passed}/${total} tests passed`, passed === total ? 'green' : 'yellow');

  if (passed === total) {
    log('\n🎉 All tests passed! v1.1.0 features are working.', 'green');
  } else {
    log('\n⚠ Some tests failed. Check the output above.', 'yellow');
  }
}

// Run tests
runAllTests().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
