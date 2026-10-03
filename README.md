# 🎮 GameAlert

[![Live](https://img.shields.io/badge/producci%C3%B3n-online-d4ff3f)](https://gamealert-ashen.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![Prisma + Turso](https://img.shields.io/badge/Prisma-Turso-2e5b4f)](https://www.prisma.io/)
[![Tests](https://img.shields.io/badge/tests-318%20verdes-d4ff3f)](#)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/angelneria/gamealert)

**Never miss an important free game again. No junk, only quality.**

🌐 **En producción:** https://gamealert-ashen.vercel.app

An automated system that monitors Steam, Epic Games and GOG for free game releases (100% temporary discounts, never F2P) and deep deals, filters out low-quality titles using Metacritic scores, and sends notifications via Discord and email.

## Features

- 🔍 **Multi-Platform Monitoring** - Steam, Epic Games, GOG
- 🧹 **Smart Filtering** - Rejects low-quality free games using Metacritic scores and publisher reputation
- ⚡ **Instant Notifications** - Email and Discord notifications the moment a quality free game drops
- 📊 **Importance Scoring** - Composite 0-100 score based on popularity, critics, publisher, and trend analysis
- ⚙️ **Customizable** - Set your own thresholds for what counts as "important"
- 🏷️ **Deals (Chollos)** - Find deeply discounted games: pick the maximum price you're willing to pay and a minimum discount %; quality and notification rules apply too. Deal alerts are capped at 10 per run (free games are never capped) so Discord never floods — the rest arrive automatically in the following runs
- 🔒 **Privacy First** - We never share your data

## How It Works

```
1. Register with your email & choose platforms
2. Scraper runs every hour checking all platforms
3. Each free game gets scored (0-100 importance)
4. High-scoring games trigger notifications
5. You get an email with a direct link to play
```

## Filtering Algorithm

Games are scored across four dimensions:

| Dimension | Weight | What It Measures |
|-----------|--------|-----------------|
| **Popularity** | 30% | Steam reviews, concurrent players, RAWG added count |
| **Critic Score** | 25% | Metacritic score, RAWG rating |
| **Publisher** | 25% | Whitelisted AAA/AA publishers, reputation |
| **Trend** | 20% | Recency, social buzz, platform type |

**Threshold**: Games scoring ≥50/100 are considered "important".

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 16+
- Redis 7+

### Setup

```bash
# Clone and install
cd gamealert
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your API keys

# Start infrastructure
docker compose up -d

# Setup database
npm run db:generate
npm run db:migrate
npm run db:seed

# Start development
npm run dev
```

Or use Docker Compose for everything:
```bash
npm run dev:docker
```

### Run Scrapers
```bash
# One-time scrape
npm run scrape

# Queue worker (for notifications)
npm run queue
```

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Next.js App    │────▶│  PostgreSQL  │◀────│   Redis      │
│  (Frontend+API) │     │  (Database)  │     │  (Queue/Cache)│
└────────┬────────┘     └──────────────┘     └─────────────┘
         │
         │    ┌──────────────┐     ┌─────────────┐
         └───▶│  Scraper     │────▶│  RAWG/Steam/ │
              │  (BullMQ)    │     │  Epic APIs   │
              └──────────────┘     └─────────────┘
                      │
                      ▼
              ┌──────────────┐     ┌─────────────┐
              │  Notifier    │────▶│  Resend/SMTP │
              │  (BullMQ)    │     │  Discord API  │
              └──────────────┘     └─────────────┘
```

## API Reference

### Auth
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/email-verify` - Verify email

### Games
- `GET /api/games?platform=steam&isFree=true` - Get tracked games
- `GET /api/deals?maxPrice=10&minDiscount=75` - Get discounted games (chollos)
- `POST /api/games/scrape` - Trigger manual scrape
- `DELETE /api/games?olderThan=2024-01-01` - Clean old entries

### Notifications
- `GET /api/notifications?userId=xxx` - Get notification history
- `POST /api/notifications` - Trigger test notification

### Webhooks
- `POST /api/webhook` - External platform webhook

## Configuration

Key environment variables in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `MIN_METACRITIC_SCORE` | 60 | Minimum Metacritic score |
| `MIN_STEAM_REVIEWS` | 5000 | Minimum Steam review count |
| `WHITELIST_PUBLISHERS` | *(default list)* | Comma-separated trusted publishers |
| `SCRAPE_INTERVAL_MINUTES` | 60 | How often to scrape |
| `NOTIFICATION_COOLDOWN_HOURS` | 24 | Min hours between notifications |

## Project Structure

```
gamealert/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API routes
│   │   ├── (auth)/register # Registration page
│   │   └── dashboard/      # User dashboard
│   ├── components/          # React components
│   ├── lib/                # Library code (Prisma, Filter, API)
│   ├── server/             # Server services (scraper, queue, notifications)
│   ├── config/             # Configuration
│   ├── types/              # TypeScript types
│   └── middleware.ts        # Next.js middleware
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Seed script
├── docker/                 # Docker configuration
├── tests/                  # Test files
├── docs/                   # Documentation
└── infra/                  # Infrastructure as code
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run test`
5. Submit a pull request

## License

MIT
