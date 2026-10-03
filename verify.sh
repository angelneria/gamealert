#!/bin/bash
# Verify all project files exist

PROJECT_DIR="."

FILES=(
  "package.json"
  "tsconfig.json"
  "next.config.js"
  "tailwind.config.ts"
  "postcss.config.js"
  "jest.config.ts"
  "prisma/schema.prisma"
  "prisma/seed.ts"
  ".env.example"
  "docker-compose.yml"
  "docker/Dockerfile"
  ".github/workflows/ci.yml"
  "src/app/layout.tsx"
  "src/app/page.tsx"
  "src/app/globals.css"
  "src/app/error.tsx"
  "src/app/not-found.tsx"
  "src/app/(auth)/register/page.tsx"
  "src/app/dashboard/page.tsx"
  "src/app/dashboard/settings/page.tsx"
  "src/app/api/auth/route.ts"
  "src/app/api/auth/preferences/route.ts"
  "src/app/api/games/route.ts"
  "src/app/api/games/scrape/route.ts"
  "src/app/api/notifications/route.ts"
  "src/app/api/webhook/route.ts"
  "src/lib/prisma.ts"
  "src/lib/filter.ts"
  "src/lib/api-client.ts"
  "src/lib/auth.ts"
  "src/lib/index.ts"
  "src/server/scraper-runner.ts"
  "src/server/queue-worker.ts"
  "src/server/notemail.ts"
  "src/server/notification-discord.ts"
  "src/config/index.ts"
  "src/types/index.ts"
  "src/middleware.ts"
  "src/components/GameCard.tsx"
  "src/components/NotificationList.tsx"
  "tests/filter.test.ts"
  "tests/api.test.ts"
  "docs/ARCHITECTURE.md"
  "README.md"
  "CLAUDE.md"
  "infra/deployment.tf"
)

echo "🔍 Verifying project structure..."
echo ""

missing=0
for file in "${FILES[@]}"; do
  if [ ! -f "$PROJECT_DIR/$file" ]; then
    echo "❌ Missing: $file"
    missing=$((missing + 1))
  else
    echo "✅ $file"
  fi
done

echo ""
if [ $missing -eq 0 ]; then
  echo "🎉 All $(${#FILES[@]}) files verified successfully!"
else
  echo "⚠️  $missing files are missing"
fi
