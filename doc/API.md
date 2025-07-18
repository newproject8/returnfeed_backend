# ReturnFeed API Documentation

## Overview

ReturnFeed API provides RESTful endpoints for managing live production sessions, user authentication, and stream control. All API endpoints are prefixed with `/api` and require authentication unless otherwise specified.

### Base URL
```
https://your-domain.com/api
```

### Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Response Format
All responses follow a consistent JSON structure:
```json
{
  "success": true,
  "data": {},
  "message": "Operation successful"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

---

## Endpoints

### Authentication

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### POST /api/auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### GET /api/auth/google
Initiate Google OAuth login flow.

**Response:** Redirects to Google OAuth consent page

#### GET /api/auth/google/callback
Google OAuth callback endpoint (handled automatically).

#### GET /api/auth/me
Get current user information.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "googleId": "1234567890"
    }
  }
}
```

#### POST /api/auth/logout
Logout the current user.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### Sessions

#### GET /api/sessions
Get all sessions for the current user.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
- `active` (boolean): Filter by active status
- `limit` (number): Number of results to return
- `offset` (number): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Morning Show Production",
        "createdBy": 1,
        "isActive": true,
        "createdAt": "2025-07-15T10:00:00Z",
        "participantCount": 5
      }
    ],
    "total": 10
  }
}
```

#### POST /api/sessions
Create a new production session.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "name": "Evening News Production"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Evening News Production",
      "createdBy": 1,
      "isActive": true,
      "createdAt": "2025-07-15T14:00:00Z"
    }
  }
}
```

#### GET /api/sessions/:sessionId
Get details of a specific session.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Morning Show Production",
      "createdBy": 1,
      "isActive": true,
      "createdAt": "2025-07-15T10:00:00Z",
      "participants": [
        {
          "userId": 1,
          "name": "John Doe",
          "role": "director",
          "joinedAt": "2025-07-15T10:05:00Z"
        },
        {
          "userId": 2,
          "name": "Jane Smith",
          "role": "camera",
          "joinedAt": "2025-07-15T10:06:00Z"
        }
      ]
    }
  }
}
```

#### PUT /api/sessions/:sessionId
Update session details.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "name": "Updated Session Name",
  "isActive": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Updated Session Name",
      "isActive": false
    }
  }
}
```

#### DELETE /api/sessions/:sessionId
Delete a session (creator only).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Session deleted successfully"
}
```

#### POST /api/sessions/:sessionId/join
Join a session as a participant.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "role": "camera"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "participant": {
      "sessionId": "550e8400-e29b-41d4-a716-446655440000",
      "userId": 3,
      "role": "camera",
      "joinedAt": "2025-07-15T10:10:00Z"
    },
    "wsToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### POST /api/sessions/:sessionId/leave
Leave a session.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Left session successfully"
}
```

---

### Streaming

#### GET /api/stream/config
Get streaming configuration for the current session.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
- `sessionId` (string): Session ID

**Response:**
```json
{
  "success": true,
  "data": {
    "srt": {
      "publishUrl": "srt://your-domain.com:8890",
      "streamId": "live/stream1",
      "passphrase": "your-passphrase"
    },
    "webrtc": {
      "whepEndpoint": "https://your-domain.com/whep/stream1",
      "iceServers": [
        {
          "urls": "stun:stun.l.google.com:19302"
        }
      ]
    },
    "hls": {
      "playbackUrl": "https://your-domain.com/hls/stream1/index.m3u8"
    }
  }
}
```

#### POST /api/stream/switch
Switch the program output to a different camera.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "cameraId": "camera1",
  "transition": "cut"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "programOutput": "camera1",
    "tallyStatus": {
      "camera1": "program",
      "camera2": "preview",
      "camera3": "standby"
    }
  }
}
```

---

### Health Check

#### GET /api/health
Check API server health status.

**No authentication required**

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-07-15T10:00:00Z",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "mediamtx": "connected",
    "relay": "connected"
  }
}
```

---

## WebSocket API

### Connection
Connect to the WebSocket server for real-time updates.

**URL:**
```
wss://your-domain.com/ws?token=<ws-token>
```

### Message Types

#### Tally Update
Received when tally status changes.
```json
{
  "type": "tallyUpdate",
  "data": {
    "camera1": "program",
    "camera2": "preview",
    "camera3": "standby"
  }
}
```

#### Session Update
Received when session details change.
```json
{
  "type": "sessionUpdate",
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "event": "participantJoined",
    "participant": {
      "userId": 4,
      "name": "New User",
      "role": "viewer"
    }
  }
}
```

#### Error
Received when an error occurs.
```json
{
  "type": "error",
  "data": {
    "code": "INVALID_SESSION",
    "message": "Session not found or inactive"
  }
}
```

---

## 5. Bitrate Management Endpoints

### Initialize Bitrate Settings
```http
POST /api/bitrate/initialize/:sessionId/:cameraId
Authorization: Bearer {token}
```

Initializes bitrate settings for a specific camera in a session.

**Request Body:**
```json
{
  "maxBitrate": 5000000,
  "defaultPercentage": 0.7
}
```

**Response:**
```json
{
  "success": true,
  "settings": {
    "sessionId": "pd_abc123",
    "cameraId": "cam_1",
    "maxBitrate": 5000000,
    "currentBitrate": 3500000,
    "percentage": 0.7
  }
}
```

### Get Bitrate Settings
```http
GET /api/bitrate/settings/:sessionId/:cameraId
Authorization: Bearer {token}
```

**Response:**
```json
{
  "sessionId": "pd_abc123",
  "cameraId": "cam_1",
  "maxBitrate": 5000000,
  "currentBitrate": 3500000,
  "percentage": 0.7,
  "qualityPreset": "balanced",
  "adaptiveEnabled": true
}
```

### Update Bitrate Percentage
```http
PUT /api/bitrate/percentage/:sessionId/:cameraId
Authorization: Bearer {token}
```

Updates the bitrate as a percentage (0.1-1.0) of maximum.

**Request Body:**
```json
{
  "percentage": 0.85
}
```

**Response:**
```json
{
  "success": true,
  "currentBitrate": 4250000,
  "percentage": 0.85
}
```

### Set Quality Preset
```http
PUT /api/bitrate/quality/:sessionId/:cameraId
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "preset": "low_latency"  // Options: "low_latency", "balanced", "quality"
}
```

**Response:**
```json
{
  "success": true,
  "preset": "low_latency",
  "settings": {
    "bitrate": 2000000,
    "bufferSize": 100,
    "keyFrameInterval": 1
  }
}
```

### Get Latency Statistics
```http
GET /api/bitrate/latency/:sessionId/:cameraId
Authorization: Bearer {token}
```

**Response:**
```json
{
  "current": 145,
  "average": 152,
  "min": 135,
  "max": 201,
  "jitter": 12,
  "history": [
    {
      "timestamp": 1705500000000,
      "latency": 145,
      "segments": {
        "pdToMediamtx": 35,
        "mediamtxToBackend": 15,
        "backendToBrowser": 95
      }
    }
  ]
}
```

### Reset Bitrate Settings
```http
POST /api/bitrate/reset/:sessionId/:cameraId
Authorization: Bearer {token}
```

Resets bitrate settings to default values.

**Response:**
```json
{
  "success": true,
  "message": "Bitrate settings reset to defaults"
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Missing or invalid authentication token |
| `FORBIDDEN` | Insufficient permissions for the requested action |
| `NOT_FOUND` | Requested resource not found |
| `VALIDATION_ERROR` | Request body validation failed |
| `DUPLICATE_EMAIL` | Email already registered |
| `INVALID_CREDENTIALS` | Invalid email or password |
| `SESSION_NOT_FOUND` | Session does not exist |
| `SESSION_FULL` | Session has reached maximum participants |
| `ALREADY_IN_SESSION` | User is already in another session |
| `INTERNAL_ERROR` | Internal server error |

---

## Rate Limiting

API endpoints are rate limited to prevent abuse:

- Authentication endpoints: 5 requests per minute
- Session endpoints: 30 requests per minute
- Stream endpoints: 60 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1626360000
```

---

## Versioning

The API uses URL versioning. The current version is v1, included in all endpoint paths (`/api/v1/...`). When breaking changes are introduced, a new version will be released while maintaining backward compatibility.

---

## 6. Simulcast Management Endpoints

### Get Simulcast Status
```http
GET /api/simulcast/status/:sessionId
Authorization: Bearer {token}
```

Returns the current simulcast configuration and status.

**Response:**
```json
{
  "enabled": true,
  "layers": [
    {
      "id": "h",
      "name": "High Quality",
      "resolution": "640x360",
      "bitrate": 1000000,
      "fps": 60,
      "active": true,
      "viewers": 25
    },
    {
      "id": "l", 
      "name": "Low Quality",
      "resolution": "640x360",
      "bitrate": 100000,
      "fps": 30,
      "active": true,
      "viewers": 8
    }
  ],
  "autoQualitySwitching": true,
  "switchingThresholds": {
    "packetLoss": 0.03,
    "rtt": 150,
    "bandwidth": 200000
  }
}
```

### Update Simulcast Settings
```http
PUT /api/simulcast/settings/:sessionId
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "autoQualitySwitching": true,
  "switchingThresholds": {
    "packetLoss": 0.04,
    "rtt": 200
  }
}
```

**Response:**
```json
{
  "success": true,
  "settings": {
    "autoQualitySwitching": true,
    "switchingThresholds": {
      "packetLoss": 0.04,
      "rtt": 200,
      "bandwidth": 200000
    }
  }
}
```

### Get Quality Statistics
```http
GET /api/simulcast/stats/:sessionId/:userId
Authorization: Bearer {token}
```

Returns quality statistics for a specific user.

**Response:**
```json
{
  "currentQuality": "h",
  "qualityHistory": [
    {
      "timestamp": 1705500000000,
      "quality": "h",
      "reason": "Good network conditions"
    },
    {
      "timestamp": 1705499900000, 
      "quality": "l",
      "reason": "Packet loss 4.5%"
    }
  ],
  "metrics": {
    "packetLoss": 0.015,
    "rtt": 85,
    "bandwidth": 2500000,
    "framesDropped": 2
  },
  "switchCount": 3,
  "qualityDistribution": {
    "h": 85.5,
    "l": 14.5
  }
}
```

### Force Quality Level
```http
POST /api/simulcast/force-quality/:sessionId/:userId
Authorization: Bearer {token}
```

Forces a specific quality level for a user (overrides auto-switching).

**Request Body:**
```json
{
  "quality": "l",
  "duration": 300  // seconds, optional
}
```

**Response:**
```json
{
  "success": true,
  "quality": "l",
  "autoSwitchingDisabled": true,
  "expiresAt": 1705500300000
}
```

### Get Network Metrics
```http
GET /api/simulcast/network/:sessionId
Authorization: Bearer {token}
```

Returns aggregated network metrics for all participants.

**Response:**
```json
{
  "participants": [
    {
      "userId": 1,
      "name": "Camera 1",
      "currentQuality": "h",
      "metrics": {
        "packetLoss": 0.01,
        "rtt": 45,
        "bandwidth": 3000000
      },
      "status": "excellent"
    },
    {
      "userId": 2,
      "name": "Mobile Viewer", 
      "currentQuality": "l",
      "metrics": {
        "packetLoss": 0.05,
        "rtt": 250,
        "bandwidth": 150000
      },
      "status": "poor"
    }
  ],
  "summary": {
    "totalViewers": 33,
    "highQuality": 25,
    "lowQuality": 8,
    "averagePacketLoss": 0.023,
    "averageRtt": 112
  }
}
```

---

## WebSocket API Updates

### Simulcast Events

#### Quality Switch Event
Sent when a user's quality level changes.
```json
{
  "type": "qualitySwitch",
  "data": {
    "userId": 2,
    "fromQuality": "h",
    "toQuality": "l",
    "reason": "High packet loss detected",
    "metrics": {
      "packetLoss": 0.045,
      "rtt": 180
    }
  }
}
```

#### Network Status Update
Periodic network status updates for all participants.
```json
{
  "type": "networkStatus",
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "participants": [
      {
        "userId": 1,
        "quality": "h",
        "packetLoss": 0.01,
        "status": "excellent"
      }
    ]
  }
}
```

---

## Error Codes (Updated)

| Code | Description |
|------|-------------|
| `SIMULCAST_NOT_ENABLED` | Simulcast is not enabled for this session |
| `INVALID_QUALITY_LEVEL` | Requested quality level does not exist |
| `QUALITY_SWITCH_TOO_FREQUENT` | Quality switching cooldown period active |
| `METRICS_NOT_AVAILABLE` | Network metrics not yet collected |

---

_Last updated: January 17, 2025_