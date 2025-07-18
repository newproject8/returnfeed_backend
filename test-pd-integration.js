#!/usr/bin/env node

/**
 * ReturnFeed PD Software Integration Test Script
 * 
 * This script tests all PD software integration endpoints
 * Usage: node test-pd-integration.js
 */

const https = require('https');
const WebSocket = require('ws');

// Configuration
const API_BASE_URL = process.env.API_URL || 'https://returnfeed.net';
const WS_URL = process.env.WS_URL || 'wss://returnfeed.net/ws';
const TEST_USER = {
  username: 'pd_test_user',
  password: 'test_password_123'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Test results
let testsPassed = 0;
let testsFailed = 0;

// Helper functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          };
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function test(name, fn) {
  try {
    log(`\nTesting: ${name}`, 'blue');
    await fn();
    log(`✓ ${name}`, 'green');
    testsPassed++;
  } catch (error) {
    log(`✗ ${name}`, 'red');
    log(`  Error: ${error.message}`, 'red');
    testsFailed++;
  }
}

// Test functions
let authToken = null;
let pdToken = null;
let sessionKey = null;

async function testHealthCheck() {
  const response = await makeRequest({
    hostname: API_BASE_URL.replace('https://', ''),
    path: '/api/health',
    method: 'GET'
  });

  if (response.statusCode !== 200) {
    throw new Error(`Expected 200, got ${response.statusCode}`);
  }

  if (response.body.status !== 'healthy') {
    throw new Error('API is not healthy');
  }
}

async function testUserRegistration() {
  const response = await makeRequest({
    hostname: API_BASE_URL.replace('https://', ''),
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }, TEST_USER);

  // User might already exist
  if (response.statusCode !== 201 && response.statusCode !== 409) {
    throw new Error(`Expected 201 or 409, got ${response.statusCode}`);
  }
}

async function testUserLogin() {
  const response = await makeRequest({
    hostname: API_BASE_URL.replace('https://', ''),
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }, TEST_USER);

  if (response.statusCode !== 200) {
    throw new Error(`Expected 200, got ${response.statusCode}`);
  }

  if (!response.body.token) {
    throw new Error('No token received');
  }

  authToken = response.body.token;
}

async function testCreateSession() {
  const response = await makeRequest({
    hostname: API_BASE_URL.replace('https://', ''),
    path: '/api/sessions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  }, {
    name: 'Test PD Session'
  });

  if (response.statusCode !== 201) {
    throw new Error(`Expected 201, got ${response.statusCode}`);
  }

  if (!response.body.session_key) {
    throw new Error('No session key received');
  }

  sessionKey = response.body.session_key;
}

async function testPDRegistration() {
  const response = await makeRequest({
    hostname: API_BASE_URL.replace('https://', ''),
    path: '/api/pd-software/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  }, {
    softwareVersion: '1.0.0',
    vmixPort: 8088
  });

  // Might fail if user doesn't have PD role
  if (response.statusCode === 403) {
    log('  User does not have PD role (expected)', 'yellow');
    return;
  }

  if (response.statusCode !== 200) {
    throw new Error(`Expected 200, got ${response.statusCode}`);
  }

  if (!response.body.pdToken) {
    throw new Error('No PD token received');
  }

  pdToken = response.body.pdToken;
}

async function testGetStreamConfig() {
  if (!sessionKey) {
    log('  Skipping - no session key', 'yellow');
    return;
  }

  const response = await makeRequest({
    hostname: API_BASE_URL.replace('https://', ''),
    path: `/api/pd-software/stream-config/${sessionKey}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  if (response.statusCode !== 200) {
    throw new Error(`Expected 200, got ${response.statusCode}`);
  }

  if (!response.body.srt || !response.body.webrtc) {
    throw new Error('Missing stream configuration');
  }
}

async function testWebSocketConnection() {
  if (!authToken || !sessionKey) {
    log('  Skipping - no auth token or session key', 'yellow');
    return;
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket connection timeout'));
    }, 5000);

    ws.on('open', () => {
      log('  WebSocket connected', 'green');
      
      // Send registration
      ws.send(JSON.stringify({
        type: 'register',
        token: authToken,
        sessionId: sessionKey,
        role: 'viewer'
      }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'session_registered') {
        log('  Session registered successfully', 'green');
        clearTimeout(timeout);
        ws.close();
        resolve();
      } else if (message.type === 'error') {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(message.message));
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

// Run tests
async function runTests() {
  log('\n=== ReturnFeed PD Software Integration Tests ===\n', 'blue');
  log(`API URL: ${API_BASE_URL}`, 'yellow');
  log(`WebSocket URL: ${WS_URL}`, 'yellow');

  // API Tests
  await test('Health Check', testHealthCheck);
  await test('User Registration', testUserRegistration);
  await test('User Login', testUserLogin);
  await test('Create Session', testCreateSession);
  await test('PD Software Registration', testPDRegistration);
  await test('Get Stream Configuration', testGetStreamConfig);
  
  // WebSocket Tests
  await test('WebSocket Connection', testWebSocketConnection);

  // Summary
  log('\n=== Test Summary ===', 'blue');
  log(`Passed: ${testsPassed}`, 'green');
  log(`Failed: ${testsFailed}`, testsFailed > 0 ? 'red' : 'green');
  
  process.exit(testsFailed > 0 ? 1 : 0);
}

// Check if WebSocket module is available
try {
  require('ws');
} catch (error) {
  log('\nError: WebSocket module not found', 'red');
  log('Please run: npm install ws', 'yellow');
  process.exit(1);
}

// Run the tests
runTests().catch((error) => {
  log('\nFatal error:', 'red');
  log(error.message, 'red');
  process.exit(1);
});