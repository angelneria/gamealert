#!/bin/bash
# GameAlert Setup Script
# Run this to set up the project

set -e

echo "🎮 GameAlert Setup"
echo "=================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v docker >/dev/null 2>&1 && HAS_DOCKER=true || HAS_DOCKER=false
echo "   Node.js: $(node --version)"
echo "   Docker: $([ $HAS_DOCKER = true ] && echo "✅" || echo "❌ (optional)")"
echo ""

# Copy environment file
echo "📝 Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "   ✅ Created .env from .env.example"
else
    echo "   ✅ .env already exists"
fi
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps 2>&1 | tail -5
echo ""

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate
echo ""

# Push database schema (development only)
echo "🗄️ Setting up database..."
npx prisma db push 2>&1 || echo "⚠️  Database push failed (make sure PostgreSQL is running)"
echo ""

# Seed whitelisted publishers
echo "🌱 Seeding whitelisted publishers..."
npx tsx prisma/seed.ts 2>&1 || echo "⚠️  Seed failed (make sure database is accessible)"
echo ""

# Generate env secret if not set
if [ -z "$NEXTAUTH_SECRET" ]; then
    echo "🔑 Generating NEXTAUTH_SECRET..."
    SECRET=$(openssl rand -base64 32)
    sed -i.bak "s/your-nextauth-secret-change-this/$SECRET/" .env
    rm -f .env.bak
    echo "   ✅ Secret generated"
fi

echo ""
echo "=============================="
echo "✅ Setup complete!"
echo ""
echo "To start development:"
echo "  1. Start infrastructure:  docker compose up -d"
echo "  2. Run migrations:        npx prisma migrate dev"
echo "  3. Start dev server:      npm run dev"
echo ""
echo "Or use Docker everything:"
echo "  npm run dev:docker"
echo ""
echo "Run scrapers manually:"
echo "  npm run scrape"
echo ""
echo "Start notification worker:"
echo "  npm run queue"
echo ""
echo "View API docs at: http://localhost:3000"
echo "Prisma Studio:    npx prisma studio"
