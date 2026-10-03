import axios from "axios";
import { config } from "@/config";

/**
 * Discord notification - sends rich embeds via webhook.
 *
 * Security: webhook URLs are validated server-side before any request
 * is made (SSRF protection — only official Discord domains allowed).
 */

export interface DiscordGame {
  title: string;
  platform: string;
  storeUrl: string;
  imageUrl: string;
  description: string;
  publisher: string;
  metacriticScore?: number;
  /** false = juego rebajado (chollo); undefined se trata como gratis */
  isFree?: boolean;
  /** Precio rebajado actual en USD (solo chollos) */
  salePrice?: number;
  /** Porcentaje de descuento (solo chollos) */
  discountPct?: number;
  /** Precio original en USD (solo chollos) */
  originalPrice?: number;
}

const DISCORD_HOSTS = [
  "discord.com",
  "discordapp.com",
  "canary.discord.com",
  "ptb.discord.com",
];

/** Discord limita los webhooks: pausa tras cada intento (1 msg/seg) */
const SEND_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** true cuando el juego es un chollo (rebajado), no gratis */
function isDeal(game: DiscordGame): boolean {
  return game.isFree === false && typeof game.salePrice === "number";
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Build the rich embed for a game (free OR discounted).
 * Pure function — exported for unit tests.
 */
export function buildDiscordEmbed(game: DiscordGame): Record<string, unknown> {
  const platformColors: Record<string, number> = {
    steam: 0x1b2838,
    epic: 0x0078f2,
    gog: 0x05c876,
  };

  const platformNames: Record<string, string> = {
    steam: "Steam",
    epic: "Epic Games Store",
    gog: "GOG",
  };

  const deal = isDeal(game);

  const priceValue = deal
    ? `${formatUsd(game.salePrice!)}${
        game.originalPrice ? ` (antes ${formatUsd(game.originalPrice)})` : ""
      }`
    : "GRATIS";

  const embed: Record<string, unknown> = {
    title: game.title,
    url: game.storeUrl,
    color: platformColors[game.platform] || 0xd4ff3f,
    description: game.description,
    thumbnail: game.imageUrl ? { url: game.imageUrl } : undefined,
    fields: [
      {
        name: "Plataforma",
        value: platformNames[game.platform] || game.platform,
        inline: true,
      },
      {
        name: "Precio",
        value: priceValue,
        inline: true,
      },
    ],
    footer: {
      text: `GameAlert — ${new Date().toLocaleDateString("es-ES")}`,
    },
    timestamp: new Date().toISOString(),
  };

  const fields = embed.fields as Array<{ name: string; value: string; inline: boolean }>;

  if (deal && game.discountPct !== undefined) {
    fields.push({ name: "Descuento", value: `-${game.discountPct}%`, inline: true });
  }

  if (game.publisher && game.publisher !== "Various") {
    fields.push({ name: "Editor", value: game.publisher, inline: true });
  }

  if (game.metacriticScore && game.metacriticScore > 0) {
    fields.push({ name: "Metacritic", value: `${game.metacriticScore}/100`, inline: true });
  }

  return embed;
}

/**
 * Returns true only for well-formed, official Discord webhook URLs.
 * Prevents SSRF: users can't make the server POST to arbitrary hosts.
 */
export function isValidDiscordWebhook(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (!DISCORD_HOSTS.includes(parsed.hostname)) return false;
    return /^\/api\/webhooks\/\d+\/[\w-]+$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

/** Discord admite como máximo 10 embeds por mensaje */
export const MAX_EMBEDS_PER_MESSAGE = 10;

export async function sendDiscordNotification(
  game: DiscordGame,
  webhookUrl?: string
): Promise<boolean> {
  const url = webhookUrl || config.notification.discordWebhookUrl;
  if (!url) {
    console.log("[Discord] No webhook configured");
    return false;
  }

  if (!isValidDiscordWebhook(url)) {
    console.error("[Discord] Blocked invalid webhook URL");
    return false;
  }

  const embed = buildDiscordEmbed(game);

  try {
    const response = await axios.post(
      url,
      {
        username: "GameAlert",
        embeds: [embed],
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      }
    );

    if (response.status === 204 || response.status === 200) {
      console.log(`[Discord] Sent: "${game.title}"`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`[Discord] Failed for "${game.title}":`, (error as Error).message);
    return false;
  } finally {
    // Límite de rate: pausa tras cada intento para no ser bloqueados
    await sleep(SEND_DELAY_MS);
  }
}

/**
 * Resumen: todos los juegos en el menor número de mensajes posible
 * (hasta MAX_EMBEDS_PER_MESSAGE embeds cada uno). Devuelve true solo
 * si TODOS los mensajes llegan; si alguno falla, el runner reintenta
 * el lote entero en la próxima pasada (mismo cooldown por juego).
 */
export async function sendDiscordDigest(
  games: DiscordGame[],
  webhookUrl?: string
): Promise<boolean> {
  if (games.length === 0) return true;

  const url = webhookUrl || config.notification.discordWebhookUrl;
  if (!url) {
    console.log("[Discord] No webhook configured");
    return false;
  }

  if (!isValidDiscordWebhook(url)) {
    console.error("[Discord] Blocked invalid webhook URL");
    return false;
  }

  const embeds = games.map(buildDiscordEmbed);
  const chunks = Math.ceil(embeds.length / MAX_EMBEDS_PER_MESSAGE);

  try {
    for (let i = 0; i < embeds.length; i += MAX_EMBEDS_PER_MESSAGE) {
      const response = await axios.post(
        url,
        {
          username: "GameAlert",
          embeds: embeds.slice(i, i + MAX_EMBEDS_PER_MESSAGE),
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        }
      );

      if (response.status !== 204 && response.status !== 200) return false;
      // Límite de rate: pausa tras cada mensaje del resumen
      await sleep(SEND_DELAY_MS);
    }

    console.log(
      `[Discord] Digest sent: ${games.length} games in ${chunks} message(s)`
    );
    return true;
  } catch (error) {
    console.error("[Discord] Digest failed:", (error as Error).message);
    return false;
  }
}
