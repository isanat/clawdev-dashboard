#!/bin/bash
# Script de atualização CLAWDEV Dashboard
# Execute: curl -fsSL http://SEU_IP:3000/api/update | bash

echo "🔄 Atualizando CLAWDEV Dashboard..."

cd /root/clawdev-dashboard

# Pull latest changes
echo "📥 Baixando atualizações..."
git pull origin main

# Install dependencies
echo "📦 Instalando dependências..."
bun install

# Restart PM2
echo "🔄 Reiniciando servidor..."
pm2 restart clawdev

# Check status
echo "✅ Status:"
pm2 status clawdev

echo ""
echo "🎉 CLAWDEV Dashboard atualizado com sucesso!"
echo "🌐 Acesse: http://95.111.231.60:9876"
