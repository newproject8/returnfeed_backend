/**
 * MediaMTX Authentication Test Script
 * 
 * This script tests the MediaMTX authentication integration:
 * 1. Publishing authentication (SRT input)
 * 2. Reading authentication (WebRTC/HLS output)
 * 3. Stream statistics API
 */

const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

// Configuration
const API_BASE = 'http://localhost:3002/api';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Test user credentials
const testPDUser = {
  userId: 'test-pd-user',
  streamKey: 'test-stream-key-123'
};

const testViewer = {
  userId: 'test-viewer',
  role: 'staff'
};

// Generate test JWT tokens
function generateToken(payload, expiresIn = '1h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

// Test MediaMTX authentication endpoint
async function testMediaMTXAuth() {
  console.log('🧪 Testing MediaMTX Authentication Integration\n');

  // Test 1: Publishing authentication
  console.log('1️⃣ Testing SRT Publishing Authentication');
  
  try {
    const publishAuthRequest = {
      action: 'publish',
      path: 'pgm_srt_raw',
      pass: testPDUser.streamKey,
      protocol: 'srt',
      ip: '192.168.1.100'
    };

    const publishResponse = await fetch(`${API_BASE}/mediamtx/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(publishAuthRequest)
    });

    const publishResult = await publishResponse.json();
    console.log(`   ✓ Publish auth response: ${publishResponse.status}`);
    console.log(`   ✓ Authenticated: ${publishResult.authenticated}`);
    
    if (!publishResult.authenticated) {
      console.log(`   ⚠️  Note: Authentication failed because test stream key doesn't exist in DB`);
    }
  } catch (error) {
    console.error(`   ✗ Error testing publish auth: ${error.message}`);
  }

  console.log('');

  // Test 2: Reading authentication with valid token
  console.log('2️⃣ Testing WebRTC Reading Authentication (with valid token)');
  
  try {
    const viewerToken = generateToken({ userId: testViewer.userId, role: testViewer.role });
    
    const readAuthRequest = {
      action: 'read',
      path: 'pgm_srt_raw',
      query: `token=${viewerToken}`,
      protocol: 'webrtc',
      ip: '192.168.1.101'
    };

    const readResponse = await fetch(`${API_BASE}/mediamtx/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(readAuthRequest)
    });

    const readResult = await readResponse.json();
    console.log(`   ✓ Read auth response: ${readResponse.status}`);
    console.log(`   ✓ Authenticated: ${readResult.authenticated}`);
  } catch (error) {
    console.error(`   ✗ Error testing read auth: ${error.message}`);
  }

  console.log('');

  // Test 3: Reading authentication without token
  console.log('3️⃣ Testing Reading Authentication (without token)');
  
  try {
    const readAuthRequest = {
      action: 'read',
      path: 'pgm_srt_raw',
      protocol: 'webrtc',
      ip: '192.168.1.102'
    };

    const readResponse = await fetch(`${API_BASE}/mediamtx/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(readAuthRequest)
    });

    const readResult = await readResponse.json();
    console.log(`   ✓ Read auth response: ${readResponse.status}`);
    console.log(`   ✓ Authenticated: ${readResult.authenticated}`);
    console.log(`   ✓ Expected: false (no token provided)`);
  } catch (error) {
    console.error(`   ✗ Error testing read auth: ${error.message}`);
  }

  console.log('');

  // Test 4: API access from internal network
  console.log('4️⃣ Testing API Access (internal network)');
  
  try {
    const apiAuthRequest = {
      action: 'api',
      ip: '172.17.0.1' // Docker internal IP
    };

    const apiResponse = await fetch(`${API_BASE}/mediamtx/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiAuthRequest)
    });

    const apiResult = await apiResponse.json();
    console.log(`   ✓ API auth response: ${apiResponse.status}`);
    console.log(`   ✓ Authenticated: ${apiResult.authenticated}`);
  } catch (error) {
    console.error(`   ✗ Error testing API auth: ${error.message}`);
  }

  console.log('');

  // Test 5: Generate viewing link
  console.log('5️⃣ Testing Viewing Link Generation');
  
  try {
    const userToken = generateToken({ userId: testViewer.userId, role: testViewer.role });
    
    const linkResponse = await fetch(`${API_BASE}/mediamtx/generate-viewing-link`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        streamPath: 'pgm_srt_raw',
        expiresIn: 3600
      })
    });

    if (linkResponse.ok) {
      const linkResult = await linkResponse.json();
      console.log(`   ✓ Viewing link generated successfully`);
      console.log(`   ✓ URL: ${linkResult.viewingUrl.substring(0, 50)}...`);
      console.log(`   ✓ Expires at: ${linkResult.expiresAt}`);
    } else {
      console.log(`   ⚠️  Response status: ${linkResponse.status}`);
    }
  } catch (error) {
    console.error(`   ✗ Error generating viewing link: ${error.message}`);
  }

  console.log('');

  // Test 6: Stream statistics
  console.log('6️⃣ Testing Stream Statistics API');
  
  try {
    const userToken = generateToken({ userId: testViewer.userId, role: 'admin' });
    
    const statsResponse = await fetch(`${API_BASE}/mediamtx/stats/${testPDUser.streamKey}`, {
      headers: { 
        'Authorization': `Bearer ${userToken}`
      }
    });

    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log(`   ✓ Stream stats retrieved`);
      console.log(`   ✓ Stream is live: ${stats.isLive}`);
      console.log(`   ✓ Current viewers: ${stats.viewers}`);
    } else {
      console.log(`   ⚠️  Response status: ${statsResponse.status}`);
    }
  } catch (error) {
    console.error(`   ✗ Error fetching stream stats: ${error.message}`);
  }

  console.log('\n✅ MediaMTX authentication tests completed!');
}

// Test WebRTC connection
async function testWebRTCConnection() {
  console.log('\n🎥 Testing WebRTC Connection\n');

  const viewerToken = generateToken({ userId: testViewer.userId, role: testViewer.role });
  const webrtcUrl = `https://localhost/ws/mediamtx/pgm_srt_raw/whep?token=${viewerToken}`;

  console.log(`   📍 WebRTC URL: ${webrtcUrl}`);
  console.log(`   ⚠️  Note: Full WebRTC test requires a browser environment`);
  console.log(`   💡 To test WebRTC:`);
  console.log(`      1. Start a stream to MediaMTX using OBS/vMix`);
  console.log(`      2. Open the ReturnFeed web interface`);
  console.log(`      3. Navigate to the stream viewer`);
  console.log(`      4. Check browser console for WebRTC connection logs`);
}

// Run all tests
async function runTests() {
  console.log('🚀 MediaMTX Integration Test Suite\n');
  console.log(`   API Base: ${API_BASE}`);
  console.log(`   JWT Secret: ${JWT_SECRET.substring(0, 10)}...`);
  console.log('');

  await testMediaMTXAuth();
  await testWebRTCConnection();

  console.log('\n📝 Next Steps:');
  console.log('   1. Create a PD user in the database with the test stream key');
  console.log('   2. Start MediaMTX with: docker-compose up mediamtx');
  console.log('   3. Configure OBS/vMix to stream to srt://localhost:8890');
  console.log('   4. Open the web interface and test viewing the stream');
  console.log('   5. Monitor MediaMTX logs for authentication requests');
}

// Execute tests
runTests().catch(console.error);