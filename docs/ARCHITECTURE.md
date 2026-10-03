# GameAlert Architecture Documentation

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│                                                                 │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│   │  Web App │   │  PWA     │   │  Mobile  │   │  CLI     │   │
│   │ (Next.js)│   │          │   │  (Future)│   │ (Future) │   │
│   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘   │
│        │              │              │              │          │
└────────┼──────────────┼──────────────┼──────────────┼──────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NEXT.JS API LAYER                           │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Auth Routes │  │ Game Routes │  │Notification │             │
│  │ /api/auth   │  │ /api/games  │  │ /api/notify │             │
│  │ /api/register│ │ /api/webhook│  │ Routes      │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER-SIDE SERVICES                         │
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────────────┐            │
│  │ Scraper Runner  │    │ Notification Queue Worker │            │
│  │                 │    │                          │            │
│  │ 1. Scrape APIs  │    │ 1. Dequeue job           │            │
│  │ 2. Match RAWG   │    │ 2. Check cooldown        │            │
│  │ 3. Filter games │    │ 3. Send email/Discord    │            │
│  │ 4. Save to DB   │    │ 4. Log notification      │            │
│  │ 5. Queue notify │    │                          │            │
│  └───────┬─────────┘    └────────────┬─────────────┘            │
│          │                          │                           │
└──────────┼──────────────────────────┼───────────────────────────┘
           │                          │
           ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                   │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  PostgreSQL │  │    Redis    │  │   External   │             │
│  │  (Prisma)   │  │ (BullMQ +   │  │   APIs       │             │
│  │             │  │  Cache)     │  │              │             │
│  │             │  │             │  │  - RAWG.io   │             │
│  │             │  │             │  │  - Epic Games│             │
│  │             │  │             │  │  - Steam     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Scraping Pipeline
```
External APIs (Epic, Steam) → Scraper Runner → RAWG Lookup → Filter Engine → Database → Notification Queue
```

### 2. Notification Pipeline
```
Notification Queue → Worker → Check Cooldown → Send Email/Discord → Log in DB
```

### 3. User Registration Flow
```
User submits form → POST /api/auth/register → Create User → Create Subscriptions → Send Welcome Email
```

## Filtering Pipeline (Detailed)

```
Free Game Detected
       │
       ▼
┌──────────────────┐
│ HARD FILTERS      │
│ - Is publisher    │
│   in blacklist?   │──Yes──▶ REJECT
│ - Is genre        │
│   excluded?       │──Yes──▶ REJECT
│ - Is game < 24h   │
│   old?            │──Yes──▶ REJECT (already notified)
└──────────────────┘
       │ (pass)
       ▼
┌──────────────────┐
│ SCORING ENGINE    │
│ - Popularity(30%) │
│ - Critics(25%)    │
│ - Publisher(25%)  │
│ - Trend(20%)      │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│ DECISION          │
│ Score ≥ 50?       │──No──▶ REJECT
│                   │──Yes──▶ SAVE + NOTIFY
└──────────────────┘
```

## Deployment Architecture

### Docker Compose (Development/Small Scale)
- App container (Next.js)
- PostgreSQL container
- Redis container
- Scraper container (cron-based)

### Kubernetes/Cloud (Production)
- App: 2+ replicas behind load balancer
- Scraper: CronJob running every hour
- Worker: Horizontal pod autoscaler
- PostgreSQL: Managed service (RDS/Azure SQL)
- Redis: Managed service (ElastiCache)
- CDN for static assets

## Security Considerations

1. **API Keys**: Stored in environment variables, never in code
2. **Rate Limiting**: Applied to all API endpoints
3. **Input Validation**: Zod schemas for all inputs
4. **Email Security**: Double opt-in, verify emails
5. **CORS**: Configured for specific origins
6. **SQL Injection**: Prevented by Prisma ORM
7. **XSS**: Sanitized user inputs
8. **CSRF**: Protected by Next.js middleware
