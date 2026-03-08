#!/bin/bash

# CLAWDEV Dashboard - Update Script for VPS
# Run this script on the VPS to update to the latest version

set -e

echo "🚀 CLAWDEV Dashboard Update Script"
echo "=================================="

# Configuration
APP_DIR="/root/clawdev-dashboard"
REPO_URL="https://github.com/isanat/clawdev-dashboard.git"
BACKUP_DIR="/root/clawdev-backup-$(date +%Y%m%d_%H%M%S)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root"
    exit 1
fi

# Step 1: Stop services
log_info "Stopping services..."
systemctl stop clawdev 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true
pkill -f "bun.*server.js" 2>/dev/null || true

# Step 2: Backup current version
if [ -d "$APP_DIR" ]; then
    log_info "Creating backup at $BACKUP_DIR..."
    cp -r "$APP_DIR" "$BACKUP_DIR"
fi

# Step 3: Pull latest changes
log_info "Pulling latest changes from GitHub..."
cd "$APP_DIR" || {
    log_info "Directory not found, cloning fresh..."
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
}
git fetch origin
git reset --hard origin/main

# Step 4: Install dependencies
log_info "Installing dependencies..."
bun install --frozen-lockfile

# Step 5: Update database
log_info "Updating database schema..."
bun run db:push || true
bun run db:generate || true

# Step 6: Build application
log_info "Building application..."
bun run build

# Step 7: Start services
log_info "Starting services..."

# Kill any existing processes
pkill -f "node.*next" 2>/dev/null || true
pkill -f "bun.*server.js" 2>/dev/null || true

# Start the application
cd "$APP_DIR"
nohup bun start > /root/clawdev.log 2>&1 &

log_info "Waiting for application to start..."
sleep 5

# Check if running
if pgrep -f "bun.*server.js" > /dev/null; then
    log_info "✅ CLAWDEV Dashboard is running!"
else
    log_error "❌ Failed to start CLAWDEV Dashboard"
    log_error "Check logs at /root/clawdev.log"
    exit 1
fi

# Summary
echo ""
echo "=================================="
echo "✅ Update completed successfully!"
echo "📱 Dashboard: http://localhost:3000"
echo "📊 Logs: /root/clawdev.log"
echo "💾 Backup: $BACKUP_DIR"
echo "=================================="
