#!/usr/bin/env bash
# setup.sh — Clean install & start for Kira MD
# Run: bash setup.sh

set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Kira MD — Setup by Victory Tech™       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Check Node.js and npm ────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "❌  Node.js not found. Install Node.js 18+ first."
  echo "    https://nodejs.org"
  exit 1
fi
if ! command -v npm &>/dev/null; then
  echo "❌  npm not found. Install Node.js and npm, then run this script again."
  exit 1
fi

NODE_VER=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_VER" -lt 18 ]; then
  echo "❌  Node.js $NODE_VER detected. Kira MD requires Node.js 18+."
  exit 1
fi
echo "✅  Node.js $(node -v) detected"

# ── Create .env if missing ─────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "✅  Created .env from .env.example"
  echo ""
  echo "⚠️  IMPORTANT: Edit .env and set your OWNER_NUMBER before starting!"
  echo "    nano .env   (or open .env in any text editor)"
  echo ""
fi

# ── Clean old dependencies and stale lockfiles ───────────────────────────────
if [ -d "node_modules" ]; then
  echo "🧹  Removing old node_modules..."
  rm -rf node_modules
fi

# A lockfile from another hosting panel may point to an inaccessible registry.
# Regenerate it from the public npm registry for a portable installation.
if [ -f "package-lock.json" ]; then
  rm -f package-lock.json
fi

# ── Install dependencies ───────────────────────────────────────────────────
echo "📦  Installing dependencies..."
npm install --legacy-peer-deps --registry=https://registry.npmjs.org

# ── Verify the dependency that must load at startup ─────────────────────────
if ! node -e "require.resolve('dotenv')" >/dev/null 2>&1; then
  echo "❌  dotenv was not installed."
  echo "    Try: npm install dotenv --save --registry=https://registry.npmjs.org"
  exit 1
fi
echo "✅  dotenv is installed"

echo ""
echo "✅  Setup complete!"
echo ""
echo "   To start the bot: npm start"
echo "   Logs:             npm start 2>&1 | tee kira-md.log"
echo ""
