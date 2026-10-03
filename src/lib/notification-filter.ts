// ============================================
// Pure notification-targeting logic
// Decides, for one user, which scraped games
// should trigger a notification right now.
// Extracted for exhaustive unit testing.
// ============================================

import type { ScrapedGame } from "./api-client";
import {
  normalizeTitle,
  passesQualityThreshold,
  passesDealPrice,
  passesDealDiscount,
} from "./filters";

export interface UserNotificationPrefs {
  id: string;
  email: string;
  platforms: string[];
  discordWebhookUrl: string;
  discordEnabled: boolean;
  emailEnabled: boolean;
  minMetacritic: number;
  cooldownHours: number;
  /** El usuario quiere alertas de juegos rebajados (chollos) */
  dealsEnabled: boolean;
  /** Tope de precio que está dispuesto a pagar, en USD */
  maxDealPrice: number;
  /** Descuento mínimo (%) para considerar un chollo */
  minDiscountPct: number;
}

/** Game is on a platform the user selected (empty list = all platforms) */
export function matchesPlatforms(
  game: Pick<ScrapedGame, "platform">,
  platforms: string[]
): boolean {
  if (platforms.length === 0) return true;
  return platforms.includes(game.platform);
}

/** Game clears the user's Metacritic bar (0 = no bar) */
export function meetsMetacriticThreshold(
  game: Pick<ScrapedGame, "importanceScore" | "metacriticScore">,
  minMetacritic: number
): boolean {
  if (minMetacritic <= 0) return true;
  return passesQualityThreshold(game, minMetacritic);
}

/** Title was already notified within the cooldown window */
export function isOnCooldown(
  title: string,
  notifiedTitles: Set<string>
): boolean {
  return notifiedTitles.has(normalizeTitle(title));
}

export interface UserSelection {
  newGames: ScrapedGame[];
  skipped: number;
}

/**
 * Full per-user pipeline: platform filter → quality filter → deal filter
 * (precio + descuento, solo juegos rebajados) → cooldown filter.
 * Returns only games the user has NOT seen recently and wants to hear about.
 */
export function selectNewGamesForUser(
  games: ScrapedGame[],
  prefs: UserNotificationPrefs,
  notifiedTitles: Set<string>
): UserSelection {
  let skipped = 0;
  const newGames: ScrapedGame[] = [];

  for (const game of games) {
    // Chollo (juego rebajado): solo si el usuario lo quiere, cabe en su
    // presupuesto y cumple su descuento mínimo. Los gratis no se tocan.
    if (!game.isFree) {
      if (!prefs.dealsEnabled) continue;
      if (!passesDealPrice(game, prefs.maxDealPrice)) continue;
      if (!passesDealDiscount(game, prefs.minDiscountPct)) continue;
    }
    if (!matchesPlatforms(game, prefs.platforms)) continue;
    if (!meetsMetacriticThreshold(game, prefs.minMetacritic)) continue;
    if (isOnCooldown(game.title, notifiedTitles)) {
      skipped++;
      continue;
    }
    newGames.push(game);
  }

  return { newGames, skipped };
}

/**
 * Tope de chollos enviados a un usuario en UNA ejecución. Motivo: la primera
 * pasada puede encontrar decenas de chollos que cascan y eso inundaría el
 * Discord. Los que sobran NO se descartan: al no registrarse siguen siendo
 * "nuevos" y salen en las siguientes ejecuciones (de mayor a menor
 * puntuación). Los juegos gratis no tienen tope: son pocos y caducan rápido.
 */
export const MAX_DEALS_PER_RUN = 10;

export interface RunBatch {
  /** Lo que se envía ahora: primero los gratis, luego los mejores chollos */
  toSend: ScrapedGame[];
  /** Chollos que quedan para la siguiente ejecución (no se pierden) */
  deferred: number;
}

/**
 * Aplica el tope de chollos por ejecución. Los gratis pasan siempre
 * (sin límite) y los chollos se ordenan de mejor a peor antes de cortar,
 * de modo que en cada pase salen los más interesantes.
 */
export function limitRunBatch(
  games: ScrapedGame[],
  maxDeals: number = MAX_DEALS_PER_RUN
): RunBatch {
  const free = games.filter((g) => g.isFree);
  const deals = games
    .filter((g) => !g.isFree)
    .sort(
      (a, b) =>
        b.importanceScore - a.importanceScore ||
        (b.discountPct ?? 0) - (a.discountPct ?? 0)
    );
  const cap = Math.max(0, Math.floor(maxDeals));
  return {
    toSend: [...free, ...deals.slice(0, cap)],
    deferred: Math.max(0, deals.length - cap),
  };
}

/** Discord delivery is only possible with a webhook URL configured */
export function shouldSendDiscord(prefs: UserNotificationPrefs): boolean {
  return prefs.discordEnabled && !!prefs.discordWebhookUrl;
}

/** Email delivery requires the channel flag (SMTP checked at send time) */
export function shouldSendEmail(prefs: UserNotificationPrefs): boolean {
  return prefs.emailEnabled;
}

/** Enabled channel names, for logging/DB records */
export function channelsForUser(prefs: UserNotificationPrefs): string[] {
  const channels: string[] = [];
  if (shouldSendDiscord(prefs)) channels.push("discord");
  if (shouldSendEmail(prefs)) channels.push("email");
  return channels;
}
