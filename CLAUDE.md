# GameAlert - CLAUDE.md

## Project Overview
GameAlert is an automated free game notification service. It monitors gaming platforms for free game releases, filters out low-quality titles, and sends notifications to registered users.

## Tech Stack
- **Framework**: Next.js 14 (App Router) + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis + BullMQ
- **Email**: Resend (primary) / Nodemailer (fallback SMTP)
- **Game Data APIs**: RAWG.io, Epic Games Store, Steam Store
- **Styling**: Tailwind CSS
- **Testing**: Jest
- **Containerization**: Docker + Docker Compose

## Key Commands
- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed whitelisted publishers
- `npm run scrape` - Run one-time scraper
- `npm run queue` - Start notification worker
- `npm run test` - Run tests
- `npm run dev:docker` - Start everything with Docker

## Core Modules

### 1. Filtering Engine (`src/lib/filter.ts`)
The heart of the project. Scores games 0-100 based on:
- Popularity (30% weight): Reviews, concurrent players
- Critic Score (25% weight): Metacritic, RAWG rating  
- Publisher (25% weight): Whitelisted status
- Trend (20% weight): Recency, platform type

Threshold for "important": 50/100

### 2. Scraping Pipeline (`src/server/scraper-runner.ts`)
Orchestrates: scrape → match RAWG → filter → save → queue notifications

### 3. Notification System (`src/server/queue-worker.ts`, `src/server/notemail.ts`)
BullMQ queues handle notification delivery via email (Resend/SMTP) and Discord webhooks

### 4. API Clients (`src/lib/api-client.ts`)
Fetches free games from Epic Games Store API, Steam API, RAWG.io

## Database Schema
Key tables:
- `users` - Registrations with preferences
- `subscriptions` - Platform subscriptions per user
- `tracked_games` - Free games found with metadata
- `game_scores` - Computed importance scores
- `notifications` - Delivery log
- `scrape_logs` - Scraper run history
- `whitelisted_publishers` - Publisher whitelist

## Important Notes
- The scraper uses RAWG.io as the primary metadata source
- Epic Games Store has a public free games endpoint
- Steam requires careful handling - use Steam app details API
- Always cache API responses to avoid rate limits
- Filter hard-rejects happen before the scoring system
- Cooldown prevents notification spam per user

## Development Patterns
- All API routes use Next.js App Router
- Database access only through `src/lib/prisma.ts` (`db` object)
- Filter logic only in `src/lib/filter.ts`
- Environment variables in `.env`, never hardcoded
- Use `@/` path alias for imports
