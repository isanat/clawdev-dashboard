#!/bin/bash
# CLAWDEV Dashboard v6.0 - VPS Deploy Script
# Execute este script na VPS ou copie e cole os comandos

set -e

echo "=========================================="
echo "  CLAWDEV Dashboard v6.0 - VPS Deploy"
echo "=========================================="

# Configuração
VPS="deploy@95.111.231.60"
PORT=9876

# Comandos a executar na VPS
COMMANDS=$(cat << 'ENDSSH'
#!/bin/bash
set -e

echo "[1/7] Preparando ambiente..."
cd /root
rm -rf clawdev-dashboard

echo "[2/7] Clonando repositório..."
git clone https://github.com/isanat/clawdev-dashboard.git
cd clawdev-dashboard

echo "[3/7] Configurando variáveis de ambiente..."
cat > .env << 'ENVEOF'
ZAI_API_KEY=your_zai_api_key_here
GROQ_API_KEY=your_groq_api_key_here
GMAIL_USER=clawdevagenteai@gmail.com
GMAIL_PASS=your_gmail_app_password_here
DATABASE_URL="file:./db/custom.db"
ENVEOF

echo "[4/7] Instalando dependências..."
export PATH="$HOME/.bun/bin:$PATH"
bun install

echo "[5/7] Configurando banco de dados..."
bunx prisma generate
bunx prisma db push --accept-data-loss || true

echo "[6/7] Compilando aplicação..."
bun run build

echo "[7/7] Iniciando servidor..."
pm2 stop clawdev-dashboard 2>/dev/null || true
pm2 delete clawdev-dashboard 2>/dev/null || true
fuser -k 9876/tcp 2>/dev/null || true

pm2 start "bun run start -- -p 9876" --name clawdev-dashboard
pm2 save

echo ""
echo "=========================================="
echo "  ✅ Deploy Completo!"
echo "  URL: http://95.111.231.60:9876"
echo "=========================================="
ENDSSH
)

# Mostrar instruções
echo ""
echo "==================================================================="
echo "  COPIE E COLE O SEGUINTE COMANDO NO SEU TERMINAL:"
echo "==================================================================="
echo ""
echo "ssh $VPS"
echo ""
echo "--- Depois execute estes comandos ---"
echo ""
echo "$COMMANDS"
