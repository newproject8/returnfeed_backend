#!/bin/bash

# Fix NGINX configuration for PD Software HTTPS redirect loop issue
# This script updates NGINX configuration to handle API requests properly

echo "🔧 ReturnFeed NGINX Configuration Fix for PD Software"
echo "====================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run this script with sudo${NC}"
    exit 1
fi

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Backup current NGINX configuration
echo "1. Backing up current NGINX configuration..."
BACKUP_DIR="/etc/nginx/backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -f "/etc/nginx/sites-available/returnfeed" ]; then
    cp /etc/nginx/sites-available/returnfeed "$BACKUP_DIR/returnfeed.conf"
    print_status "Backed up existing configuration to $BACKUP_DIR"
else
    print_warning "No existing returnfeed configuration found"
fi

# 2. Copy new NGINX configuration
echo -e "\n2. Installing new NGINX configuration..."
if [ -f "nginx/nginx-pd-fix.conf" ]; then
    # For sites-available/sites-enabled structure
    if [ -d "/etc/nginx/sites-available" ]; then
        cp nginx/nginx-pd-fix.conf /etc/nginx/sites-available/returnfeed
        ln -sf /etc/nginx/sites-available/returnfeed /etc/nginx/sites-enabled/returnfeed
        print_status "Installed new configuration to sites-available"
    else
        # For direct nginx.conf replacement
        cp /etc/nginx/nginx.conf "$BACKUP_DIR/nginx.conf"
        cp nginx/nginx-pd-fix.conf /etc/nginx/nginx.conf
        print_status "Replaced main nginx.conf"
    fi
else
    print_error "nginx-pd-fix.conf not found!"
    exit 1
fi

# 3. Test NGINX configuration
echo -e "\n3. Testing NGINX configuration..."
nginx -t
if [ $? -eq 0 ]; then
    print_status "NGINX configuration test passed"
else
    print_error "NGINX configuration test failed!"
    print_warning "Restoring backup..."
    if [ -d "/etc/nginx/sites-available" ]; then
        cp "$BACKUP_DIR/returnfeed.conf" /etc/nginx/sites-available/returnfeed 2>/dev/null
    else
        cp "$BACKUP_DIR/nginx.conf" /etc/nginx/nginx.conf 2>/dev/null
    fi
    exit 1
fi

# 4. Open port 8092 in firewall
echo -e "\n4. Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 8092/tcp
    print_status "Opened port 8092 in UFW firewall"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=8092/tcp
    firewall-cmd --reload
    print_status "Opened port 8092 in firewalld"
else
    print_warning "No firewall detected. Please manually open port 8092 if needed"
fi

# 5. Reload NGINX
echo -e "\n5. Reloading NGINX..."
systemctl reload nginx
if [ $? -eq 0 ]; then
    print_status "NGINX reloaded successfully"
else
    print_error "Failed to reload NGINX"
    exit 1
fi

# 6. Test endpoints
echo -e "\n6. Testing API endpoints..."
echo "Testing HTTP API access..."

# Test HTTP API endpoint
HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://returnfeed.net/api/pd-auth/login-pd -X POST -H "Content-Type: application/json" -d '{"test": true}' 2>/dev/null || echo "000")
if [ "$HTTP_RESPONSE" != "000" ] && [ "$HTTP_RESPONSE" != "301" ] && [ "$HTTP_RESPONSE" != "302" ]; then
    print_status "HTTP API endpoint accessible (Response: $HTTP_RESPONSE)"
else
    print_warning "HTTP API endpoint may have issues (Response: $HTTP_RESPONSE)"
fi

# Test port 8092
echo "Testing port 8092 API access..."
PORT_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://returnfeed.net:8092/api/pd-auth/login-pd -X POST -H "Content-Type: application/json" -d '{"test": true}' 2>/dev/null || echo "000")
if [ "$PORT_RESPONSE" != "000" ]; then
    print_status "Port 8092 API endpoint accessible (Response: $PORT_RESPONSE)"
else
    print_warning "Port 8092 API endpoint not accessible"
fi

# 7. Summary
echo -e "\n${GREEN}===== Configuration Update Complete =====${NC}"
echo "Summary of changes:"
echo "  ✓ API endpoints (/api/*) now accessible via HTTP without redirect"
echo "  ✓ CORS headers added for cross-origin requests"
echo "  ✓ Port 8092 opened for direct API access"
echo "  ✓ WebSocket endpoints configured"
echo ""
echo "PD Software can now connect using:"
echo "  - HTTP: http://returnfeed.net/api/*"
echo "  - Direct: http://returnfeed.net:8092/api/*"
echo "  - HTTPS: https://returnfeed.net/api/* (also available)"
echo ""
echo "Backup stored at: $BACKUP_DIR"
echo ""
print_warning "If issues persist, check application logs:"
echo "  - NGINX logs: /var/log/nginx/error.log"
echo "  - Backend logs: docker logs returnfeed_backend_backend_1"