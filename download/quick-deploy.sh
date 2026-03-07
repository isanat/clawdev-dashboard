#!/bin/bash
# EXECUTE ESTE SCRIPT NA VPS:
# ssh deploy@95.111.231.60
# Senha: Clawdev2024!

set -e

echo "=================================================="
echo "  CLAWDEV Dashboard v6.0 - Quick Deploy"
echo "=================================================="

# 1. Criar diretório
mkdir -p /root/clawdev-dashboard
cd /root/clawdev-dashboard

# 2. Baixar o código do repositório local
# Você precisa primeiro enviar os arquivos de outra forma

# 3. Ou criar os arquivos manualmente aqui...

echo "Próximo passo: Enviar arquivos do local para VPS"
echo "Execute no seu computador local:"
echo "  scp -r package.json bun.lock next.config.ts tsconfig.json tailwind.config.ts postcss.config.mjs src/ prisma/ public/ components.json deploy@95.111.231.60:/root/clawdev-dashboard/"
