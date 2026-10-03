# Skill: Test GameAlert

Automated testing skill for GameAlert. Run this after every code change to verify everything works.

## What it tests
1. TypeScript compilation (zero errors)
2. Dev server health
3. API endpoints return valid data
4. Games page loads (HTTP 200)
5. Scraped games have images and valid URLs

## How to use
After making changes, invoke this skill or run the test script:
```bash
./scripts/test.sh
```

## Test checklist
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] Dev server starts on port 3000
- [ ] `GET /api/games` returns 200 with games array
- [ ] Games have titles, images (imageUrl), and store URLs
- [ ] `GET /dashboard/games` returns 200
- [ ] No hydration errors in browser console
