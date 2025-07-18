# ReturnFeed Deployment Guide

## 📋 Overview

This guide provides step-by-step instructions for deploying ReturnFeed in various environments.

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Domain name (for production)
- SSL certificate (Let's Encrypt recommended)

### Basic Deployment

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/returnfeed.git
   cd returnfeed
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start services**
   ```bash
   docker-compose up -d
   ```

4. **Verify deployment**
   ```bash
   docker-compose ps
   curl https://localhost/api/health
   ```

## 🔐 Production Deployment

### 1. SSL Certificate Setup

#### Option A: Let's Encrypt (Recommended)
```bash
./setup-letsencrypt.sh
```

#### Option B: Self-signed (Development only)
```bash
./setup-self-signed-ssl.sh
```

### 2. Environment Configuration

Create production `.env` file:
```env
# Database
DB_USER=returnfeed
DB_PASSWORD=your-secure-password
DATABASE_URL=postgresql://returnfeed:your-secure-password@postgres:5432/returnfeed

# Authentication
JWT_SECRET=your-very-long-random-string-at-least-32-characters

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Application
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
BACKEND_URL=https://your-domain.com/api
```

### 3. Secure Deployment

Use the secure Docker Compose configuration:
```bash
docker-compose -f docker-compose.secure.yml up -d
```

## 🌐 Domain Configuration

### 1. DNS Setup

Configure your domain's DNS records:
```
A     @     your-server-ip
A     www   your-server-ip
```

### 2. Reverse Proxy Configuration

NGINX is pre-configured to handle:
- SSL termination
- WebSocket proxying
- API routing
- Static file serving

## 📡 Streaming Configuration

### 1. SRT Input with Simulcast

Configure your encoder for 2-layer simulcast:
```
Protocol: SRT
Host: your-domain.com
Port: 8890
Stream ID Format: publish:simulcast_{sessionKey}_{quality}
Quality Layers:
  - High: publish:simulcast_{sessionKey}_h (1Mbps)
  - Low: publish:simulcast_{sessionKey}_l (0.1Mbps)
```

### 2. MediaMTX Passthrough Mode

Ensure MediaMTX is using the passthrough configuration:
```bash
# Use minimal config for zero transcoding
docker-compose exec mediamtx cat /mediamtx.yml | grep -A5 "paths:"
```

### 3. Port Forwarding

Required ports for external access:
- 80 (HTTP)
- 443 (HTTPS)
- 8890/udp (SRT input)
- 8899 (WebRTC output - mapped from 8889)
- 8189/udp (WebRTC ICE)
- 9997 (MediaMTX API)
- 9998 (MediaMTX Metrics)

## 🌐 Simulcast Deployment

### 1. Enable 2-Layer Simulcast

```bash
# Update MediaMTX configuration
cp mediamtx/mediamtx-minimal.yml mediamtx.yml

# Restart MediaMTX
docker-compose restart mediamtx
```

### 2. Configure PD Software

```python
# In PD software
from simulcast_encoder import SimulcastEncoder

encoder = SimulcastEncoder("your-domain.com:8890")
result = encoder.start_simulcast(ndi_source, session_key)
```

### 3. Frontend Integration

Update frontend to use simulcast player:
```typescript
import { SimulcastVideoPlayer } from './components/SimulcastVideoPlayer';

// Replace standard player with simulcast version
<SimulcastVideoPlayer 
  sessionKey={sessionKey}
  mediamtxUrl="your-domain.com"
/>
```

### 4. Network Requirements

- **PD Upload**: 1.2Mbps minimum (both streams)
- **Viewer Download**: 
  - High quality: 1.5Mbps
  - Low quality: 150kbps
- **Latency Target**: 20-50ms

## 🔧 Advanced Configuration

### 1. Database Backup

Set up automated backups:
```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
docker exec postgres pg_dump -U returnfeed returnfeed > backup_$(date +%Y%m%d).sql
EOF

chmod +x backup.sh

# Add to crontab
(crontab -l ; echo "0 2 * * * /path/to/backup.sh") | crontab -
```

### 2. Monitoring

Enable health checks:
```yaml
# docker-compose.yml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### 3. Scaling

For high-load environments:
```yaml
# docker-compose.yml
services:
  backend:
    deploy:
      replicas: 3
    environment:
      - REDIS_URL=redis://redis:6379
```

## 🐛 Troubleshooting

### Issue: Containers not starting
```bash
# Check logs
docker-compose logs -f

# Verify environment variables
docker-compose config
```

### Issue: SSL certificate errors
```bash
# Regenerate certificates
rm -rf nginx/certs/*
./setup-letsencrypt.sh
docker-compose restart nginx
```

### Issue: Database connection failed
```bash
# Check database status
docker exec postgres pg_isready

# Verify credentials
docker exec postgres psql -U returnfeed -c "SELECT 1"
```

## 📊 Performance Tuning

### 1. NGINX Optimization for Simulcast
```nginx
# nginx.conf
worker_processes auto;
worker_connections 4096;
keepalive_timeout 65;
gzip on;

# WebRTC specific
location ~ ^/simulcast_ {
    proxy_pass http://mediamtx:8889;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
    proxy_buffering off;
}
```

### 2. PostgreSQL Tuning
```sql
-- Increase connections
ALTER SYSTEM SET max_connections = 200;

-- Optimize for SSD
ALTER SYSTEM SET random_page_cost = 1.1;
```

### 3. Docker Resources for Simulcast
```yaml
# docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
  
  mediamtx:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
    environment:
      - MTX_PROTOCOLS_SRT_PASSPHRASE=${SRT_PASSPHRASE}
```

## 🔄 Updates and Maintenance

### 1. Update Application
```bash
git pull origin main
docker-compose build
docker-compose up -d
```

### 2. Database Migrations
```bash
docker exec backend npm run migrate
```

### 3. Clear Cache
```bash
docker exec backend npm run cache:clear
docker-compose restart nginx
```

## 🚨 Security Checklist

- [ ] Changed all default passwords
- [ ] Set strong JWT_SECRET
- [ ] Configured firewall rules
- [ ] Enabled SSL/TLS
- [ ] Set up regular backups
- [ ] Configured log rotation
- [ ] Disabled unnecessary ports
- [ ] Set up monitoring alerts
- [ ] Configured SRT passphrase
- [ ] Enabled simulcast access control
- [ ] Set quality-based permissions

## 📞 Support

For deployment assistance:
- Documentation: [docs.returnfeed.com](https://docs.returnfeed.com)
- Issues: [GitHub Issues](https://github.com/yourusername/returnfeed/issues)
- Email: support@returnfeed.com

---

_Last updated: January 17, 2025_