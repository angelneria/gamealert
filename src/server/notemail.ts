import nodemailer, { type Transporter } from "nodemailer";
import { config } from "@/config";

/**
 * Email notification service using Nodemailer.
 *
 * Setup for production:
 *   1. Gmail: enable "App Passwords" → SMTP_USER=you@gmail.com SMTP_PASS=xxxx
 *   2. SendGrid: SMTP_HOST=smtp.sendgrid.net SMTP_PORT=587 SMTP_USER=apikey SMTP_PASS=<key>
 *   3. Mailgun: SMTP_HOST=smtp.mailgun.org SMTP_PORT=587 SMTP_USER=postmaster@... SMTP_PASS=<key>
 *
 * Without credentials the service runs in dry-run mode (logs only).
 */

export interface EmailGame {
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

/** true cuando el juego es un chollo (rebajado), no gratis */
function isDeal(game: EmailGame): boolean {
  return game.isFree === false && typeof game.salePrice === "number";
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user
        ? { user: config.smtp.user, pass: config.smtp.pass }
        : undefined,
      tls: {
        rejectUnauthorized: true,
        minVersion: "TLSv1.2",
      },
      pool: true,
      maxConnections: 3,
    });
  }
  return transporter;
}

export function isEmailConfigured(): boolean {
  return Boolean(config.smtp.user && config.smtp.pass);
}

/** Asunto del email: gratis vs chollo (rebajado). Exportado para tests. */
export function buildEmailSubject(game: EmailGame): string {
  if (isDeal(game)) {
    const pct = game.discountPct !== undefined ? ` (-${game.discountPct}%)` : "";
    return `Chollo: ${game.title} a $${game.salePrice!.toFixed(2)} en ${game.platform}${pct}`;
  }
  return `Juego Gratis: ${game.title} en ${game.platform}`;
}

/**
 * Send email notification to a single user.
 * Returns true if sent (or dry-run accepted), false on failure.
 */
export async function sendEmailNotification(
  email: string,
  game: EmailGame,
  importanceScore: number
): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.log(
      `📧 [dry-run] Email to ${email}: "${game.title}" (SMTP not configured)`
    );
    return false;
  }

  try {
    const t = getTransporter();
    const subject = buildEmailSubject(game);
    const html = buildEmailHtml(game, importanceScore);
    const text = buildEmailText(game, importanceScore);

    const info = await t.sendMail({
      from: config.resend.from,
      to: email,
      subject,
      html,
      text,
      headers: {
        "X-Priority": "1",
        "X-Mailer": "GameAlert/1.0",
      },
    });

    console.log(`📧 Email sent to ${email} for "${game.title}" (ID: ${info.messageId})`);
    return true;
  } catch (error) {
    console.error("Email notification failed:", error);
    return false;
  }
}

/** Exportado para tests: construye el HTML del email (gratis o chollo). */
export function buildEmailHtml(game: EmailGame, score: number): string {
  const scoreColor = score >= 70 ? "#d4ff3f" : score >= 50 ? "#eab308" : "#ff5c38";
  const scoreLabel = score >= 70 ? "Importante" : score >= 50 ? "Interesante" : "Destacado";
  const deal = isDeal(game);

  const headerSubtitle = deal ? "Chollo detectado" : "Juego gratis detectado";

  const priceRow = deal
    ? `<span style="color:#8a8578;font-size:13px;">Precio:</span> <span style="color:#d4ff3f;font-weight:700;font-size:13px;">$${game.salePrice!.toFixed(2)}</span>${game.originalPrice ? ` <span style="color:#8a8578;font-size:13px;text-decoration:line-through;">$${game.originalPrice.toFixed(2)}</span>` : ""}${game.discountPct !== undefined ? ` <span style="color:#ff5c38;font-weight:700;font-size:13px;">-${game.discountPct}%</span>` : ""}`
    : `<span style="color:#8a8578;font-size:13px;">Precio:</span> <span style="color:#d4ff3f;font-weight:700;font-size:13px;">GRATIS</span>`;

  const ctaLabel = deal ? "Ver oferta" : "Jugar gratis";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a09;color:#ece9e2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a09;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#131311;border:1px solid #26261f;">
        <tr>
          <td style="padding:32px 40px;border-bottom:1px solid #26261f;">
            <p style="margin:0;font-size:14px;font-weight:700;letter-spacing:2px;color:#d4ff3f;text-transform:uppercase;">GameAlert</p>
            <p style="margin:8px 0 0;font-size:12px;color:#8a8578;">${headerSubtitle}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 40px;text-align:center;">
            ${game.imageUrl ? `<img src="${game.imageUrl}" alt="${game.title}" style="max-width:100%;margin-bottom:20px;border:1px solid #26261f;">` : ""}
            <h2 style="margin:0 0 8px;font-size:28px;color:#ece9e2;">${game.title}</h2>
            <p style="margin:0;font-size:14px;color:#8a8578;text-transform:uppercase;letter-spacing:1px;">${game.platform}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 24px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr><td style="background:${scoreColor};padding:10px 28px;">
                <p style="margin:0;font-size:16px;font-weight:700;color:#0a0a09;">${scoreLabel}: ${Math.round(score)}/100</p>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${game.publisher && game.publisher !== "Various" ? `<tr><td style="padding:8px 0;border-bottom:1px solid #26261f;"><span style="color:#8a8578;font-size:13px;">Editor:</span> <span style="color:#ece9e2;font-size:13px;">${game.publisher}</span></td></tr>` : ""}
              ${game.metacriticScore ? `<tr><td style="padding:8px 0;border-bottom:1px solid #26261f;"><span style="color:#8a8578;font-size:13px;">Metacritic:</span> <span style="color:#ece9e2;font-size:13px;">${game.metacriticScore}/100</span></td></tr>` : ""}
              <tr><td style="padding:8px 0;">${priceRow}</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 32px;text-align:center;">
            <a href="${game.storeUrl}" target="_blank" style="display:inline-block;background:#d4ff3f;color:#0a0a09;text-decoration:none;padding:14px 36px;font-size:15px;font-weight:700;text-transform:uppercase;">${ctaLabel}</a>
          </td>
        </tr>
        <tr>
          <td style="background:#0a0a09;padding:20px 40px;text-align:center;border-top:1px solid #26261f;">
            <p style="margin:0;font-size:11px;color:#555;">
              Recibes esto porque te registraste en GameAlert.<br>
              <a href="${config.app.url}/dashboard/settings" style="color:#8a8578;">Gestionar preferencias</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Exportado para tests: versión en texto plano del email. */
export function buildEmailText(game: EmailGame, score: number): string {
  const scoreLabel = score >= 70 ? "Importante" : score >= 50 ? "Interesante" : "Destacado";
  const deal = isDeal(game);
  const header = deal ? "Chollo detectado" : "Juego gratis detectado";
  const priceLine = deal
    ? `Precio: $${game.salePrice!.toFixed(2)}${game.originalPrice ? ` (antes $${game.originalPrice.toFixed(2)})` : ""}${game.discountPct !== undefined ? ` -${game.discountPct}%` : ""}`
    : "Precio: GRATIS";
  let text = `GAMEALERT — ${header}\n\n${game.title}\nPlataforma: ${game.platform}\nImportancia: ${Math.round(score)}/100 (${scoreLabel})\n${priceLine}\n`;
  if (game.publisher && game.publisher !== "Various") text += `Editor: ${game.publisher}\n`;
  if (game.storeUrl) text += `Link: ${game.storeUrl}\n`;
  text += `\nGestionar preferencias: ${config.app.url}/dashboard/settings`;
  return text;
}

/** Un item del resumen con su puntuación (para el color/etiqueta) */
export interface DigestItem {
  game: EmailGame;
  score: number;
}

/**
 * Asunto del resumen: cuenta gratis y chollos por separado para que
 * el usuario sepa qué hay dentro sin abrirlo.
 */
export function buildDigestSubject(items: DigestItem[]): string {
  const free = items.filter((i) => !isDeal(i.game)).length;
  const deals = items.length - free;
  if (free > 0 && deals > 0) {
    return `GameAlert: ${items.length} novedades (${free} gratis + ${deals} ${deals === 1 ? "chollo" : "chollos"})`;
  }
  if (deals > 0) {
    return `GameAlert: ${deals} ${deals === 1 ? "chollo" : "chollos"}`;
  }
  return `GameAlert: ${free} ${free === 1 ? "juego gratis" : "juegos gratis"}`;
}

function digestPriceLine(game: EmailGame): string {
  if (isDeal(game)) {
    return `$${game.salePrice!.toFixed(2)}${game.originalPrice ? ` (antes $${game.originalPrice.toFixed(2)})` : ""}${game.discountPct !== undefined ? ` -${game.discountPct}%` : ""}`;
  }
  return "GRATIS";
}

/** Fila compacta de un juego dentro del resumen (HTML). */
function buildDigestRow(item: DigestItem): string {
  const { game, score } = item;
  const deal = isDeal(game);
  const badge = deal
    ? `<span style="color:#ff5c38;font-weight:700;font-size:13px;">CHOLLO ${digestPriceLine(game)}</span>`
    : `<span style="color:#d4ff3f;font-weight:700;font-size:13px;">GRATIS</span>`;
  return `<tr><td style="padding:16px 0;border-bottom:1px solid #26261f;">
    <a href="${game.storeUrl}" target="_blank" style="margin:0 0 4px;font-size:18px;font-weight:700;color:#ece9e2;text-decoration:none;">${game.title}</a>
    <p style="margin:6px 0;font-size:13px;color:#8a8578;text-transform:uppercase;letter-spacing:1px;">${game.platform}${game.metacriticScore ? ` · Metacritic ${game.metacriticScore}/100` : ""} · ${Math.round(score)}/100</p>
    <p style="margin:6px 0 0;font-size:13px;">${badge}</p>
  </td></tr>`;
}

/** Resumen HTML: una sección de gratis y otra de chollos. */
export function buildDigestHtml(items: DigestItem[]): string {
  const free = items.filter((i) => !isDeal(i.game));
  const deals = items.filter((i) => isDeal(i.game));

  const section = (title: string, list: DigestItem[]) =>
    list.length === 0
      ? ""
      : `<tr><td style="padding:24px 40px 0;">
           <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:2px;color:#8a8578;text-transform:uppercase;">${title}</p>
         </td></tr>
         <tr><td style="padding:0 40px;">
           <table width="100%" cellpadding="0" cellspacing="0">
             ${list.map(buildDigestRow).join("")}
           </table>
         </td></tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a09;color:#ece9e2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a09;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#131311;border:1px solid #26261f;">
        <tr>
          <td style="padding:32px 40px;border-bottom:1px solid #26261f;">
            <p style="margin:0;font-size:14px;font-weight:700;letter-spacing:2px;color:#d4ff3f;text-transform:uppercase;">GameAlert</p>
            <p style="margin:8px 0 0;font-size:12px;color:#8a8578;">Resumen: ${items.length} ${items.length === 1 ? "novedad" : "novedades"}</p>
          </td>
        </tr>
        ${section("Gratis", free)}
        ${section("Chollos", deals)}
        <tr>
          <td style="background:#0a0a09;padding:20px 40px;text-align:center;border-top:1px solid #26261f;">
            <p style="margin:0;font-size:11px;color:#555;">
              Recibes esto porque te registraste en GameAlert.<br>
              <a href="${config.app.url}/dashboard/settings" style="color:#8a8578;">Gestionar preferencias</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Resumen en texto plano: secciones Gratis y Chollos con enlaces. */
export function buildDigestText(items: DigestItem[]): string {
  const free = items.filter((i) => !isDeal(i.game));
  const deals = items.filter((i) => isDeal(i.game));

  const lines = (list: DigestItem[]) =>
    list.map(
      (i) =>
        `- ${i.game.title} (${i.game.platform}) — ${digestPriceLine(i.game)}\n  ${i.game.storeUrl}`
    );

  let text = `GAMEALERT — Resumen: ${items.length} ${items.length === 1 ? "novedad" : "novedades"}\n`;
  if (free.length > 0) text += `\nGRATIS:\n${lines(free).join("\n")}\n`;
  if (deals.length > 0) text += `\nCHOLLOS:\n${lines(deals).join("\n")}\n`;
  text += `\nGestionar preferencias: ${config.app.url}/dashboard/settings`;
  return text;
}

/**
 * Un solo email con todos los juegos de la pasada.
 * Devuelve true si sale (o dry-run aceptado), false si falla.
 */
export async function sendDigestEmail(
  email: string,
  items: DigestItem[]
): Promise<boolean> {
  if (items.length === 0) return true;
  if (!isEmailConfigured()) {
    console.log(
      `📧 [dry-run] Digest to ${email}: ${items.length} games (SMTP not configured)`
    );
    return false;
  }

  try {
    const t = getTransporter();
    const info = await t.sendMail({
      from: config.resend.from,
      to: email,
      subject: buildDigestSubject(items),
      html: buildDigestHtml(items),
      text: buildDigestText(items),
      headers: {
        "X-Priority": "1",
        "X-Mailer": "GameAlert/1.0",
      },
    });

    console.log(
      `📧 Digest sent to ${email}: ${items.length} games (ID: ${info.messageId})`
    );
    return true;
  } catch (error) {
    console.error("Digest email failed:", error);
    return false;
  }
}
