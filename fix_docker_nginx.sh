#!/bin/bash

# Fix Docker NGINX for PD Software

echo "🔧 Fixing Docker NGINX configuration..."

# Create fixed configuration
cat > /tmp/nginx-fix.conf << 'EOF'
server {
    listen 80;
    
    # API proxy without redirect
    location /api {
        proxy_pass http://192.168.0.242:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
        
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type';
            add_header 'Content-Length' 0;
            return 204;
        }
    }
    
    # WebSocket
    location /ws {
        proxy_pass http://192.168.0.242:8765;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
    
    # Frontend
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri /index.html;
    }
}
EOF

# Copy to container
docker cp /tmp/nginx-fix.conf returnfeed-nginx:/etc/nginx/conf.d/default.conf

# Reload
docker exec returnfeed-nginx nginx -s reload

echo "✅ Configuration updated!"
echo ""
echo "Test with:"
echo "curl -X POST http://returnfeed.net/api/pd-auth/login-pd -H 'Content-Type: application/json' -d '{\"username\": \"test\", \"password\": \"test\"}'"