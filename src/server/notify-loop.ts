import { runNotifications } from "./notify-runner";

/**
 * Local notification loop — the "cron" for development / self-hosting.
 * Runs once immediately, then every SCRAPE_INTERVAL_MINUTES (default 60).
 *
 * Usage: npm run notify:loop
 */
const minutes = Number(process.env.SCRAPE_INTERVAL_MINUTES || 60);
const intervalMs = Math.max(1, minutes) * 60 * 1000;

async function tick() {
  try {
    await runNotifications();
  } catch (err) {
    console.error("[Loop] Notification run failed:", err);
  }
}

console.log(
  `[Loop] GameAlert notifications every ${minutes} min (CTRL+C to stop)`
);
tick();
setInterval(tick, intervalMs);
