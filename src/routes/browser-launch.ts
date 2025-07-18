import express, { Request, Response } from 'express';

const router = express.Router();

// PD Software Browser Launch API
// This endpoint is called by PD software to get the registration URL
router.get('/launch/register', (req: Request, res: Response) => {
  const baseUrl = process.env.FRONTEND_URL || 'https://returnfeed.net';
  const source = req.query.source || 'pd_software';
  const version = req.query.version || '1.0.0';
  const vmixPort = req.query.vmixPort || '8088';
  
  // Generate a unique token for this registration session
  const token = Buffer.from(JSON.stringify({
    timestamp: Date.now(),
    source: source,
    ip: req.ip
  })).toString('base64');
  
  const registrationUrl = `${baseUrl}/register-pd?source=${source}&version=${version}&vmixPort=${vmixPort}&token=${token}`;
  
  res.json({
    success: true,
    action: 'open_browser',
    url: registrationUrl,
    message: 'Please open this URL in your default browser to complete PD registration'
  });
});

// Get staff access URL for a session
router.get('/launch/staff/:sessionKey', (req: Request, res: Response) => {
  const { sessionKey } = req.params;
  const baseUrl = process.env.FRONTEND_URL || 'https://returnfeed.net';
  
  const staffUrl = `${baseUrl}/staff/${sessionKey}`;
  
  res.json({
    success: true,
    url: staffUrl,
    qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(staffUrl)}`,
    message: 'Share this URL with your staff members'
  });
});

// Validate session key and get staff HTML page
router.get('/staff-page/:sessionKey', async (req: Request, res: Response) => {
  const { sessionKey } = req.params;
  
  // In production, validate session key against database
  // For now, we'll serve the HTML with dynamic configuration
  
  const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>ReturnFeed Staff - ${sessionKey}</title>
    <script>
        // Dynamic configuration
        window.RETURNFEED_CONFIG = {
            sessionKey: '${sessionKey}',
            wsUrl: 'wss://${req.get('host')}/ws',
            streamUrl: '/mediamtx/session_${sessionKey}',
            apiUrl: 'https://${req.get('host')}/api'
        };
    </script>
</head>
<body>
    <div id="root"></div>
    <script>
        // Redirect to the React app with session key
        window.location.href = '/staff/${sessionKey}';
    </script>
</body>
</html>`;

  res.type('html').send(htmlContent);
});

// Get streaming URLs for PD software
router.get('/stream-urls/:sessionKey', (req: Request, res: Response) => {
  const { sessionKey } = req.params;
  const host = req.get('host') || 'returnfeed.net';
  
  res.json({
    success: true,
    urls: {
      srt: {
        publish: `srt://${host}:8890?streamid=session_${sessionKey}`,
        passphrase: sessionKey
      },
      staff: {
        web: `https://${host}/staff/${sessionKey}`,
        qr: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`https://${host}/staff/${sessionKey}`)}`
      },
      websocket: `wss://${host}/ws`,
      api: `https://${host}/api`
    }
  });
});

export default router;