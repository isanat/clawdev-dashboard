#!/bin/bash
# CLAWDEV Dashboard v6.0 - Deploy Script
# Cole e execute este script na VPS

set -e

echo "=========================================="
echo "  CLAWDEV Dashboard v6.0 - Deploy"
echo "=========================================="

# 1. Parar servidor atual
echo "[1/6] Parando servidor atual..."
pm2 stop clawdev-dashboard 2>/dev/null || true
pm2 delete clawdev-dashboard 2>/dev/null || true

# 2. Ir para diretório e atualizar
echo "[2/6] Atualizando repositório..."
cd /root
rm -rf clawdev-dashboard
git clone https://github.com/isanat/clawdev-dashboard.git
cd clawdev-dashboard

# 3. Instalar dependências
echo "[3/6] Instalando dependências..."
export PATH="$HOME/.bun/bin:$PATH"
bun install

# 4. Instalar Playwright (necessário para navegação autônoma)
echo "[4/6] Instalando Playwright..."
bunx playwright install chromium

# 5. Configurar variáveis de ambiente
echo "[5/6] Configurando variáveis de ambiente..."
# Configure suas variáveis de ambiente aqui
cat > .env << 'ENVEOF'
DATABASE_URL="file:/root/clawdev-dashboard/db/custom.db"
ZAI_API_KEY=your_zai_api_key_here
GROQ_API_KEY=your_groq_api_key_here
GMAIL_USER=clawdevagenteai@gmail.com
GMAIL_PASS=your_gmail_app_password_here
ENVEOF

echo "IMPORTANTE: Edite o arquivo .env com suas chaves de API!"

# 6. Build e iniciar
echo "[6/6] Build e iniciando servidor..."
bun run build

pm2 start "bun run start -- -p 9876" --name clawdev-dashboard
pm2 save

echo ""
echo "=========================================="
echo "  ✅ Deploy Completo!"
echo "  URL: http://95.111.231.60:9876"
echo "=========================================="
