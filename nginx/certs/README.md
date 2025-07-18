# SSL Certificates

This directory should contain your SSL certificates, but they should **NEVER** be committed to version control.

## Required Files

- `fullchain.pem` - Your SSL certificate chain
- `privkey.pem` - Your private key

## Generating Certificates

### Option 1: Let's Encrypt (Production)

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d returnfeed.net -d www.returnfeed.net

# Copy certificates to this directory
sudo cp /etc/letsencrypt/live/returnfeed.net/fullchain.pem ./
sudo cp /etc/letsencrypt/live/returnfeed.net/privkey.pem ./
sudo chown $(whoami):$(whoami) *.pem
```

### Option 2: Self-Signed (Development Only)

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/C=KR/ST=Seoul/L=Seoul/O=ReturnFeed/CN=localhost"
```

## Security Notes

1. **NEVER** commit private keys to version control
2. Set appropriate permissions: `chmod 600 *.pem`
3. Use strong key sizes (2048 bits minimum)
4. Renew certificates before expiration