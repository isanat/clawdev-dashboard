#!/bin/bash
# CLAWDEV Dashboard v6.0 - Deploy Script for VPS
# Server: deploy@95.111.231.60
# Port: 9876 (CLAWDEV Dashboard)

set -e

echo "=================================================="
echo "  CLAWDEV Dashboard v6.0 - Deploy Script"
echo "=================================================="

# Configuration
VPS_USER="deploy"
VPS_HOST="95.111.231.60"
VPS_PASS="Clawdev2024!"
REMOTE_DIR="/root/clawdev-dashboard"
PORT=9876

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}[1/6] Installing dependencies on VPS...${NC}"
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST << 'ENDSSH'
# Check if running as root, if not use sudo
if [ "$EUID" -ne 0 ]; then
    SUDO="sudo"
else
    SUDO=""
fi

# Install bun if not installed
if ! command -v bun &> /dev/null; then
    echo "Installing bun..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
fi

# Install pm2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing pm2..."
    npm install -g pm2
fi

# Create directory
mkdir -p /root/clawdev-dashboard
ENDSSH

echo -e "${GREEN}[2/6] Copying files to VPS...${NC}"
sshpass -p "$VPS_PASS" scp -o StrictHostKeyChecking=no -r \
    package.json bun.lock next.config.ts tsconfig.json tailwind.config.ts postcss.config.mjs \
    src/ prisma/ public/ components.json \
    $VPS_USER@$VPS_HOST:/root/clawdev-dashboard/

echo -e "${YELLOW}[3/6] Installing npm packages on VPS...${NC}"
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST << 'ENDSSH'
cd /root/clawdev-dashboard
export PATH="$HOME/.bun/bin:$PATH"

# Install dependencies
bun install

# Generate Prisma client
bunx prisma generate

# Setup database
bunx prisma db push --accept-data-loss || true
ENDSSH

echo -e "${YELLOW}[4/6] Building application...${NC}"
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST << 'ENDSSH'
cd /root/clawdev-dashboard
export PATH="$HOME/.bun/bin:$PATH"

# Build
bun run build
ENDSSH

echo -e "${YELLOW}[5/6] Starting CLAWDEV Dashboard on port 9876...${NC}"
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST << ENDSSH
cd /root/clawdev-dashboard
export PATH="\$HOME/.bun/bin:\$PATH"

# Stop old process if exists
pm2 stop clawdev-dashboard 2>/dev/null || true
pm2 delete clawdev-dashboard 2>/dev/null || true

# Kill any process on port 9876
fuser -k 9876/tcp 2>/dev/null || true

# Start with pm2
pm2 start "bun run start -- -p 9876" --name clawdev-dashboard

# Save pm2 config
pm2 save

# Setup pm2 startup if not already
pm2 startup | tail -1 | bash 2>/dev/null || true
ENDSSH

echo -e "${GREEN}[6/6] Verifying deployment...${NC}"
sleep 3

# Check if running
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://$VPS_HOST:9876/ 2>/dev/null || echo "000")

if [ "$RESPONSE" = "200" ]; then
    echo -e "${GREEN}=================================================="
    echo -e "  ✅ CLAWDEV Dashboard v6.0 Deployed Successfully!"
    echo -e "==================================================${NC}"
    echo ""
    echo -e "🌐 URL: ${GREEN}http://$VPS_HOST:9876${NC}"
    echo ""
    echo "📊 Dashboard Features:"
    echo "   • OODA Loop Autônomo (ativo)"
    echo "   • Chat AI (Z.AI + GROQ fallback)"
    echo "   • 6 Skills Integradas"
    echo "   • Monitoramento em Tempo Real"
    echo ""
else
    echo -e "${RED}⚠️ Warning: Server responded with code $RESPONSE"
    echo "Check logs: ssh $VPS_USER@$VPS_HOST 'pm2 logs clawdev-dashboard'${NC}"
fi
