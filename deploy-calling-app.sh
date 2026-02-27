#!/bin/bash
# ============================================================
# LMS Calling App (MiroTalk SFU) — VPS Deployment Script
# Run this ON YOUR VPS as root after uploading the calling-app folder
# Usage: sudo bash deploy-calling-app.sh <YOUR_VPS_PUBLIC_IP>
# ============================================================

set -e

VPS_IP="${1}"
CALLING_APP_DIR="/var/www/lms-calling"
DOMAIN="call.ejazmehmood.com"

if [ -z "$VPS_IP" ]; then
    echo "ERROR: Provide your VPS public IP"
    echo "Usage: sudo bash deploy-calling-app.sh <VPS_PUBLIC_IP>"
    exit 1
fi

echo "==> VPS IP: $VPS_IP"
echo "==> Domain: $DOMAIN"
echo ""

# -------------------------------------------------------
# 1. Install Docker (if not installed)
# -------------------------------------------------------
if ! command -v docker &> /dev/null; then
    echo "==> Installing Docker..."
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    echo "==> Docker installed"
else
    echo "==> Docker already installed"
fi

# -------------------------------------------------------
# 2. Create app directory and write .env
# -------------------------------------------------------
echo "==> Setting up $CALLING_APP_DIR..."
mkdir -p "$CALLING_APP_DIR"
cp -r . "$CALLING_APP_DIR/"
cd "$CALLING_APP_DIR"

cat > .env <<EOF
MEDIASOUP_ANNOUNCED_IP=${VPS_IP}
CALLING_APP_API_SECRET=lms_calling_secret_2026
EOF

echo "==> .env written"

# -------------------------------------------------------
# 3. Open firewall ports
# -------------------------------------------------------
echo "==> Opening firewall ports..."
ufw allow 3010/tcp   comment 'MiroTalk SFU HTTP (nginx proxied)'  2>/dev/null || true
ufw allow 40000:40100/udp comment 'WebRTC media'                  2>/dev/null || true
ufw allow 40000:40100/tcp comment 'WebRTC media TCP'              2>/dev/null || true
echo "==> Firewall updated"

# -------------------------------------------------------
# 4. Get SSL certificate for call subdomain
# -------------------------------------------------------
echo "==> Getting SSL certificate for $DOMAIN..."
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    # Temporarily stop nginx if running to free port 80
    systemctl stop nginx 2>/dev/null || true
    certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos -m admin@ejazmehmood.com
    systemctl start nginx 2>/dev/null || true
    echo "==> SSL certificate obtained"
else
    echo "==> SSL certificate already exists"
fi

# -------------------------------------------------------
# 5. Create nginx config for call.ejazmehmood.com
# -------------------------------------------------------
echo "==> Writing nginx config..."
cat > /etc/nginx/sites-available/lms-calling <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    # Redirect HTTP to HTTPS
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # WebSocket + HTTP proxy to calling app container
    location / {
        proxy_pass         http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        # Large timeouts for long-lived WebSocket connections
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/lms-calling /etc/nginx/sites-enabled/lms-calling
nginx -t
systemctl reload nginx
echo "==> Nginx configured"

# -------------------------------------------------------
# 6. Build and start the Docker container
# -------------------------------------------------------
echo "==> Building and starting calling app..."
cd "$CALLING_APP_DIR"
docker compose down 2>/dev/null || true
docker compose build --no-cache
docker compose up -d

echo ""
echo "========================================"
echo "  Calling app deployed successfully!"
echo "  URL: https://${DOMAIN}"
echo "  Container: mirotalksfu"
echo ""
echo "  Useful commands:"
echo "    docker compose -f $CALLING_APP_DIR/docker-compose.yml logs -f"
echo "    docker compose -f $CALLING_APP_DIR/docker-compose.yml restart"
echo "========================================"
echo ""
echo "  Next: Update backend .env on VPS:"
echo "    CALLING_APP_URL=https://${DOMAIN}"
echo "  Then: pm2 restart lms-backend"
echo ""
