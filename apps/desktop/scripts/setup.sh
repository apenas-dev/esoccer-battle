#!/bin/bash
# E-Soccer Battle - Script de Setup
# Uso: bash scripts/setup.sh

set -e

echo "🎮 E-Soccer Battle - Setup Script"
echo "=================================="

# Detecta gerenciador de pacotes
detectPackageManager() {
    if command -v pnpm &> /dev/null; then
        echo "pnpm"
    elif command -v yarn &> /dev/null; then
        echo "yarn"
    else
        echo "npm"
    fi
}

PKG_MANAGER=$(detectPackageManager)
echo "📦 Usando: $PKG_MANAGER"

# Verifica Node.js
echo ""
echo "🔍 Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado!"
    echo "   Instale Node.js 18+ de: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js versão $NODE_VERSION encontrada, precisa ser 18+"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# Verifica Python
echo ""
echo "🔍 Verificando Python..."
PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
fi

if [ -z "$PYTHON_CMD" ]; then
    echo "⚠️  Python não encontrado (opcional para comandos de voz)"
else
    echo "✅ Python $($PYTHON_CMD --version | cut -d' ' -f2)"
fi

# Verifica espaços no caminho
echo ""
echo "🔍 Verificando caminho do projeto..."
CURRENT_PATH=$(pwd)
if [[ "$CURRENT_PATH" == *" "* ]]; then
    echo "⚠️  AVISO: O caminho contém espaços!"
    echo "   Caminho atual: $CURRENT_PATH"
    echo "   Isso pode causar problemas com Electron."
    echo "   Considere mover o projeto para um caminho sem espaços."
    echo ""
    read -p "Continuar mesmo assim? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ Caminho OK: $CURRENT_PATH"
fi

# Limpa instalação anterior
echo ""
echo "🧹 Limpando instalação anterior..."
rm -rf node_modules 2>/dev/null || true
rm -rf dist 2>/dev/null || true
rm -rf dist-electron 2>/dev/null || true

# Instala dependências
echo ""
echo "📥 Instalando dependências..."
$PKG_MANAGER install

# Verifica se Electron foi instalado
echo ""
echo "🔍 Verificando Electron..."
if [ -d "node_modules/electron" ]; then
    ELECTRON_VERSION=$(cat node_modules/electron/package.json | grep '"version"' | head -1 | cut -d'"' -f4)
    echo "✅ Electron $ELECTRON_VERSION instalado"
else
    echo "❌ Electron não encontrado! Tentando reinstalar..."
    $PKG_MANAGER add -D electron@28.1.0 --force
fi

# Rebuild módulos nativos
echo ""
echo "🔨 Rebuild de módulos nativos..."
if [ -d "node_modules/better-sqlite3" ]; then
    npx @electron/rebuild -f -w better-sqlite3
    echo "✅ better-sqlite3 compilado"
else
    echo "ℹ️  better-sqlite3 não encontrado (ok se não usar SQLite)"
fi

# Instala backend Python (opcional)
echo ""
echo "🐍 Instalando backend Python (opcional)..."
if [ -n "$PYTHON_CMD" ] && [ -d "../../backend/voice-engine" ]; then
    cd ../../backend/voice-engine
    $PYTHON_CMD -m pip install -e . --quiet 2>/dev/null && echo "✅ Backend Python instalado" || echo "⚠️  Falha ao instalar backend (opcional)"
    cd ../../apps/desktop
else
    echo "ℹ️  Backend Python não instalado (comandos de voz não funcionarão)"
fi

echo ""
echo "=================================="
echo "✅ Setup completo!"
echo ""
echo "Para executar o app:"
echo "  $PKG_MANAGER dev"
echo ""
echo "Para comandos de voz, inicie o backend primeiro:"
echo "  cd backend/voice-engine && python -m esoccer_voice.api.main"
echo ""
