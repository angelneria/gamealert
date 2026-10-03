import { prisma } from "@/lib/prisma";
import { scrapeAllPlatforms, scrapeDeals, type ScrapedGame } from "@/lib/api-client";
import { dedupeGames } from "@/lib/filters";
import { sendDiscordNotification, type DiscordGame } from "@/server/discord";
import { sendEmailNotification, isEmailConfigured, type EmailGame } from "@/server/notemail";
import {
  selectNewGamesForUser,
  shouldSendDiscord,
  shouldSendEmail,
  channelsForUser,
  limitRunBatch,
  MAX_DEALS_PER_RUN,
  type UserNotificationPrefs,
} from "@/lib/notification-filter";

/**
 * Notification Runner - Database-driven
 *
 * 1. Loads users + their preferences from DB (Discord webhook + email)
 * 2. Scrapes free games; ALSO scrapes discounted games (chollos) when at
 *    least one user has deals enabled (merged and deduped by title)
 * 3. For each user: finds NEW games matching their platforms, quality bar
 *    and, for deals, their price cap + minimum discount
 * 4. Sends to Discord webhook and/or email (both channels), applying the
 *    per-run deals cap (MAX_DEALS_PER_RUN) — free games are never capped
 * 5. Logs notifications in DB with cooldown per user+game
 *
 * No Redis needed - state lives in SQLite via Prisma
 */

export type UserPrefs = UserNotificationPrefs;

export interface RunResult {
  scraped: number;
  users: number;
  notified: number;
  failed: number;
  skipped: number;
}

let activeRun: Promise<RunResult> | null = null;

/**
 * Single-flight guard: the cron, the local loop and the manual dashboard
 * button can all trigger at the same time. Overlapping triggers SHARE the
 * same execution, so the "already notified?" set is read exactly once and
 * a game can never be picked up (and sent) twice concurrently.
 */
export function runNotifications(): Promise<RunResult> {
  if (activeRun) return activeRun;
  activeRun = executeRun().finally(() => {
    activeRun = null;
  });
  return activeRun;
}

async function loadUsers(): Promise<UserNotificationPrefs[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      platforms: true,
      discordWebhookUrl: true,
      discordEnabled: true,
      emailEnabled: true,
      minMetacritic: true,
      cooldownHours: true,
      dealsEnabled: true,
      maxDealPrice: true,
      minDiscountPct: true,
    },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    platforms: u.platforms ? u.platforms.split(",").filter(Boolean) : [],
    discordWebhookUrl: u.discordWebhookUrl || "",
    discordEnabled: u.discordEnabled,
    emailEnabled: u.emailEnabled,
    minMetacritic: u.minMetacritic || 0,
    cooldownHours: u.cooldownHours || 24,
    dealsEnabled: Boolean(u.dealsEnabled),
    maxDealPrice: u.maxDealPrice || 10,
    minDiscountPct: u.minDiscountPct ?? 75,
  }));
}

/**
 * Load all game titles a user was notified about (for cooldown)
 */
async function getUserNotifiedTitles(
  userId: string,
  cooldownHours: number
): Promise<Set<string>> {
  const since = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      status: "sent",
      sentAt: { gte: since },
    },
    select: { gameTitle: true },
  });
  return new Set(notifications.map((n) => n.gameTitle.toLowerCase().replace(/[^a-z0-9]/g, "")));
}

/**
 * Log a notification to the DB
 */
async function logNotification(
  userId: string,
  game: ScrapedGame,
  channel: string,
  status: "sent" | "failed" | "skipped"
) {
  await prisma.notification.create({
    data: {
      userId,
      gameTitle: game.title,
      platform: game.platform,
      storeUrl: game.storeUrl,
      channel,
      status,
    },
  });
}

async function executeRun(): Promise<RunResult> {
  console.log("🔔 GameAlert Notification Runner started");
  console.log("=".repeat(50));

  // 1. Load users first (we need their deal preferences to know what to scrape)
  const users = await loadUsers();
  console.log(`👥 Users with notifications: ${users.length}`);

  if (users.length === 0) {
    console.log(
      "⚠️  No users registered. Go to /register to add your email + Discord webhook."
    );
    return { scraped: 0, users: 0, notified: 0, failed: 0, skipped: 0 };
  }

  // 2. Scrape free games + discounted games (chollos, only if someone wants them)
  const freeGames = await scrapeAllPlatforms();
  const dealUsers = users.filter((u) => u.dealsEnabled);
  let dealGames: ScrapedGame[] = [];
  if (dealUsers.length > 0) {
    const maxDealUsd = Math.max(...dealUsers.map((u) => u.maxDealPrice));
    dealGames = await scrapeDeals(maxDealUsd);
  }

  // Merge: free first (a title that is both free AND discounted wins as free),
  // then dedupe by normalized title so the same game is never sent twice.
  const games =
    dealGames.length > 0
      ? dedupeGames([...freeGames, ...dealGames])
      : freeGames;
  console.log(
    `📊 Candidates: ${games.length} (free: ${freeGames.length}, deals: ${dealGames.length})`
  );

  let notifiedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  // 3. For each user, filter games and send
  for (const user of users) {
    // Filter out games on cooldown (single DB query for all games)
    const notifiedTitles = await getUserNotifiedTitles(
      user.id,
      user.cooldownHours
    );

    // Platform → quality → deals → cooldown pipeline (pure logic)
    const { newGames, skipped } = selectNewGamesForUser(
      games,
      user,
      notifiedTitles
    );
    skippedCount += skipped;

    // Tope de chollos por ejecución: primero los gratis (sin límite) y los
    // mejores chollos; el resto queda en cola para el próximo pase.
    const { toSend, deferred } = limitRunBatch(newGames);
    if (deferred > 0) {
      console.log(
        `⏳ ${user.email}: ${deferred} chollos en cola para el próximo pase (tope ${MAX_DEALS_PER_RUN} por ejecución)`
      );
    }

    if (toSend.length === 0) {
      console.log(
        `⏭️  ${user.email}: no new games (all on cooldown or filtered)`
      );
      continue;
    }

    console.log(
      `📨 ${user.email}: ${toSend.length} new games${deferred > 0 ? ` (+${deferred} en cola)` : ""} → Discord: ${user.discordEnabled ? "✅" : "❌"} | Email: ${user.emailEnabled ? "✅" : "❌"}`
    );

    // 4. Send via enabled channels
    for (const game of toSend) {
      const discordGame: DiscordGame = {
        title: game.title,
        platform: game.platform,
        storeUrl: game.storeUrl,
        imageUrl: game.imageUrl,
        description: game.description,
        publisher: game.publisher,
        metacriticScore: game.metacriticScore,
        isFree: game.isFree,
        salePrice: game.salePrice,
        discountPct: game.discountPct,
        originalPrice: game.originalPrice,
      };

      const emailGame: EmailGame = {
        title: game.title,
        platform: game.platform,
        storeUrl: game.storeUrl,
        imageUrl: game.imageUrl,
        description: game.description,
        publisher: game.publisher,
        metacriticScore: game.metacriticScore,
        isFree: game.isFree,
        salePrice: game.salePrice,
        discountPct: game.discountPct,
        originalPrice: game.originalPrice,
      };

      // Discord
      if (user.discordEnabled && user.discordWebhookUrl) {
        const ok = await sendDiscordNotification(
          discordGame,
          user.discordWebhookUrl
        );
        await logNotification(user.id, game, "discord", ok ? "sent" : "failed");
        if (ok) notifiedCount++;
        else failedCount++;
        // El límite de rate de Discord lo aplica el propio emisor (discord.ts)
      }

      // Email
      if (user.emailEnabled) {
        if (!isEmailConfigured()) {
          await logNotification(user.id, game, "email", "skipped");
        } else {
          const ok = await sendEmailNotification(user.email, emailGame, game.importanceScore);
          await logNotification(user.id, game, "email", ok ? "sent" : "failed");
          if (ok) notifiedCount++;
          else failedCount++;
        }
      }
    }
  }

  console.log("=".repeat(50));
  console.log(`✅ Results:`);
  console.log(`   Scraped: ${games.length}`);
  console.log(`   Users: ${users.length}`);
  console.log(`   Notified: ${notifiedCount}`);
  console.log(`   Failed: ${failedCount}`);
  console.log(`   Skipped (cooldown): ${skippedCount}`);

  return {
    scraped: games.length,
    users: users.length,
    notified: notifiedCount,
    failed: failedCount,
    skipped: skippedCount,
  };
}

// CLI entry point
if (require.main === module) {
  runNotifications()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
