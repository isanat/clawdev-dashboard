#!/bin/bash
# ============================================================================
# CLAWDEV Dashboard - Deploy Automático via GitHub
# Execute este script na VPS:
#   ssh deploy@95.111.231.60
#   Senha: Clawdev2024!
#   bash <(curl -s https://raw.githubusercontent.com/isanat/clawdev-dashboard/main/download/deploy-from-github.sh)
# ============================================================================

set -e

echo "=================================================="
echo "  CLAWDEV Dashboard - Deploy Automático v7.0"
echo "=================================================="

# Configurações
APP_DIR="/root/clawdev-dashboard"
REPO_URL="https://github.com/isanat/clawdev-dashboard.git"
BRANCH="main"

# 1. Parar serviços existentes
echo ""
echo "🛑 Parando serviços existentes..."
systemctl stop clawdev 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true

# 2. Backup do banco de dados
echo ""
echo "💾 Fazendo backup do banco de dados..."
if [ -f "$APP_DIR/db/custom.db" ]; then
    cp "$APP_DIR/db/custom.db" "$APP_DIR/db/custom.db.backup.$(date +%Y%m%d_%H%M%S)"
    echo "   ✓ Backup criado"
fi

# 3. Atualizar código do GitHub
echo ""
echo "📥 Atualizando código do GitHub..."
if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/$BRANCH
    git pull origin $BRANCH
else
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
fi

# 4. Instalar dependências
echo ""
echo "📦 Instalando dependências..."
bun install --frozen-lockfile

# 5. Gerar Prisma Client
echo ""
echo "🗄️ Gerando Prisma Client..."
bunx prisma generate

# 6. Executar migrações
echo ""
echo "🔄 Executando migrações do banco de dados..."
bunx prisma db push --accept-data-loss

# 7. Build da aplicação
echo ""
echo "🔨 Build da aplicação..."
bun run build

# 8. Copiar arquivos estáticos
echo ""
echo "📋 Copiando arquivos estáticos..."
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
cp -r public .next/standalone/ 2>/dev/null || true

# 9. Criar serviço systemd
echo ""
echo "⚙️ Criando serviço systemd..."
cat > /etc/systemd/system/clawdev.service << 'EOF'
[Unit]
Description=CLAWDEV Dashboard
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/clawdev-dashboard
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
ExecStart=/usr/bin/bun run server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 10. Reiniciar serviços
echo ""
echo "🚀 Iniciando serviços..."
systemctl daemon-reload
systemctl enable clawdev
systemctl start clawdev

# 11. Verificar status
echo ""
echo "⏳ Aguardando aplicação iniciar..."
sleep 5

if systemctl is-active --quiet clawdev; then
    echo ""
    echo "=================================================="
    echo "  ✅ DEPLOY CONCLUÍDO COM SUCESSO!"
    echo "=================================================="
    echo ""
    echo "🌐 Aplicação disponível em:"
    echo "   http://95.111.231.60:3000"
    echo ""
    echo "📊 Status do serviço:"
    systemctl status clawdev --no-pager | head -15
    echo ""
    echo "📝 Comandos úteis:"
    echo "   Ver logs:     journalctl -u clawdev -f"
    echo "   Reiniciar:    systemctl restart clawdev"
    echo "   Parar:        systemctl stop clawdev"
    echo "   Status:       systemctl status clawdev"
else
    echo ""
    echo "❌ Erro ao iniciar o serviço!"
    echo "Verifique os logs: journalctl -u clawdev -n 50"
fi
