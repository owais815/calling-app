#!/bin/bash
# ============================================================
# LMS Calling App — First-Time CD Setup on VPS
# Run ONCE on the VPS to prepare for GitHub Actions deployments
# Usage: sudo bash setup-calling-app-cd.sh <VPS_PUBLIC_IP>
# ============================================================

set -e

VPS_IP="${1}"
DEPLOY_DIR="/var/www/lms-calling"
DOMAIN="call.ejazmehmood.com"
REPO="https://github.com/Ejaz-Mehmood/calling-app.git"

if [ -z "$VPS_IP" ]; then
    echo "ERROR: Provide your VPS public IP"
    echo "Usage: sudo bash setup-calling-app-cd.sh <VPS_PUBLIC_IP>"
    exit 1
fi

echo "==> VPS IP: $VPS_IP"
echo "==> Deploy dir: $DEPLOY_DIR"
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
    echo "==> Docker already installed: $(docker --version)"
fi

# -------------------------------------------------------
# 2. Clone calling-app repo
# -------------------------------------------------------
echo "==> Setting up repo at $DEPLOY_DIR..."
if [ ! -d "$DEPLOY_DIR/.git" ]; then
    mkdir -p "$DEPLOY_DIR"
    git clone "$REPO" "$DEPLOY_DIR"
    echo "==> Repo cloned"
else
    echo "==> Repo already exists, pulling latest..."
    cd "$DEPLOY_DIR" && git fetch origin && git reset --hard origin/main
fi

cd "$DEPLOY_DIR"

# -------------------------------------------------------
# 3. Write .env file
# -------------------------------------------------------
echo "==> Writing .env..."
cat > .env <<EOF
MEDIASOUP_ANNOUNCED_IP=${VPS_IP}
CALLING_APP_API_SECRET=lms_calling_secret_2026
EOF
echo "==> .env written"

# -------------------------------------------------------
# 4. Open firewall ports for WebRTC
# -------------------------------------------------------
echo "==> Opening firewall ports..."
ufw allow 40000:40100/udp comment 'WebRTC media UDP' 2>/dev/null || true
ufw allow 40000:40100/tcp comment 'WebRTC media TCP' 2>/dev/null || true
echo "==> Ports 40000-40100 opened"

# -------------------------------------------------------
# 5. Get SSL certificate for call subdomain
# -------------------------------------------------------
echo "==> Checking SSL certificate for $DOMAIN..."
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "==> Getting SSL certificate (make sure DNS A record for $DOMAIN points to $VPS_IP first!)..."
    systemctl stop nginx 2>/dev/null || true
    certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos -m admin@ejazmehmood.com
    systemctl start nginx 2>/dev/null || true
    echo "==> SSL certificate obtained"
else
    echo "==> SSL certificate already exists"
fi

# -------------------------------------------------------
# 6. Configure nginx for call.ejazmehmood.com
# -------------------------------------------------------
echo "==> Writing nginx config..."
cat > /etc/nginx/sites-available/lms-calling <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

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
# 7. Initial build and start
# -------------------------------------------------------
echo "==> Building and starting calling app container..."
docker compose build --no-cache
docker compose up -d
echo "==> Container started"

echo ""
echo "========================================"
echo "  First-time setup complete!"
echo "  Calling app: https://${DOMAIN}"
echo ""
echo "  GitHub Actions will now handle"
echo "  all future deployments on git push."
echo ""
echo "  Required GitHub Secrets (repo settings):"
echo "    VPS_HOST                = Your VPS IP"
echo "    VPS_USERNAME            = root"
echo "    VPS_SSH_KEY             = (private key content)"
echo "    VPS_PORT                = 22"
echo "    MEDIASOUP_ANNOUNCED_IP  = ${VPS_IP}"
echo "    CALLING_APP_API_SECRET  = lms_calling_secret_2026"
echo ""
echo "  Also update backend .env on VPS:"
echo "    CALLING_APP_URL=https://${DOMAIN}"
echo "    CALLING_APP_API_URL=http://localhost:3010"
echo "  Then: pm2 restart lms-backend --update-env"
echo "========================================"
