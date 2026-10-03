# GameAlert — Despliegue en Producción (0€)

## Opciones de despliegue gratuito

### 1. Vercel (Recomendado)
```bash
npm i -g vercel
vercel --prod
```
- Next.js nativo, zero-config
- HTTPS automático
- Edge network global
- Gratis: 100GB bandwidth/mes

### 2. Cloudflare Pages
```bash
npm i -g wrangler
wrangler pages deploy .next
```
- Gratis: 500 builds/mes, bandwidth ilimitado
- CDN global

### 3. Render
- Conectar repo GitHub → auto-deploy
- Gratis: 750 horas/mes

---

## Variables de entorno para producción

```bash
# App
APP_URL=https://tudominio.com
NODE_ENV=production

# Database — PRODUCCIÓN: Turso (SQLite remoto, plan gratis).
# El SQLite local NO persiste en Vercel (disco efímero): sin esto se
# pierden usuarios e historial en cada despliegue. Pasos (una vez):
#   1. Instala el CLI: brew install tursodatabase/tap/turso (o curl -sSf https://get.tur.so/install.sh | bash)
#   2. turso auth login && turso db create gamealert
#   3. turso db show gamealert --url        → DATABASE_URL (libsql://...)
#      turso db tokens create gamealert     → TURSO_AUTH_TOKEN
#   4. Crea las tablas en remoto: DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npx prisma db push
# En Vercel: añade DATABASE_URL + TURSO_AUTH_TOKEN en Environment Variables.
# En local no toques nada: con file:./dev.db sigue usando SQLite local.
DATABASE_URL="libsql://gamealert-xxx.turso.io"
TURSO_AUTH_TOKEN=tu_token_de_turso

# Email — SendGrid (gratis: 100 emails/día)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=tu_api_key_sendgrid

# O Gmail con App Password
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=tu@gmail.com
# SMTP_PASS=xxxx xxxx xxxx xxxx

# Seguridad (genera ambos con: openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
NEXTAUTH_SECRET=$(openssl rand -hex 32)

# Automatización de alertas (secreto del cron)
# Vercel lo envía solo como `Authorization: Bearer ${CRON_SECRET}` en los crons
CRON_SECRET=$(openssl rand -hex 32)
```

---

## Alertas automáticas (sin darle al botón)

Las notificaciones se disparan **solas** por tres vías:

1. **Vercel Cron (plan Hobby gratis)** — `vercel.json` define
   `GET /api/cron/notify` con schedule `0 18 * * *` (**una vez al día, 18:00 UTC**,
   justo después del drop de Epic del jueves a 17:00 UTC). Vercel añade solo la
   cabecera `Authorization: Bearer ${CRON_SECRET}`; sin ese secreto la ruta responde 401.
   > ⚠️ **Límite importante de Vercel Hobby:** los cron solo pueden ejecutarse
   > **una vez al día**. Expresiones horarias (`0 * * * *`) **hacen fallar el
   > despliegue** con "Hobby accounts are limited to daily cron jobs".
2. **Cadencia horaria gratis en Vercel (opcional)** — usa un programador externo
   gratuito como [cron-job.org](https://cron-job.org):
   - **URL:** `https://tudominio.com/api/cron/notify`
   - **Frecuencia:** cada 60 minutos
   - **Headers:** `Authorization: Bearer $CRON_SECRET` (secreto de `.env`)
   - Sin ese encabezado la ruta responde 401, así que sigue protegida.
3. **Bucle local / auto-hospedado** — `npm run notify:loop` repite el chequeo al
   arrancar y luego cada `SCRAPE_INTERVAL_MINUTES` (por defecto 60). Sin límites.

El botón "Buscar ahora" del panel es solo un chequeo inmediato opcional y también
requiere sesión iniciada.

---

## Checklist pre-producción

- [ ] `npm run build` sin errores
- [ ] `npx tsc --noEmit` limpio
- [ ] `npx jest` todos verdes
- [ ] SMTP configurado (SendGrid gratis)
- [ ] `APP_URL` con dominio real
- [ ] `SESSION_SECRET` aleatorio (mínimo 32 bytes hex)
- [ ] `NEXTAUTH_SECRET` aleatorio
- [ ] `CRON_SECRET` aleatorio (protege `/api/cron/notify`)
- [ ] `vercel.json` con cron diario (`0 18 * * *`) — Vercel Hobby rechaza crons más frecuentes
- [ ] (Opcional) cron-job.org programado cada hora con `Authorization: Bearer $CRON_SECRET`
- [ ] `NODE_ENV=production`
- [ ] HTTPS activo (automático en Vercel/Cloudflare)
- [ ] `robots.xml` y `sitemap.xml` accesibles
- [ ] JSON-LD validado en Google Rich Results

---

## SEO — Checklist para top 1 "juegos gratis"

- [x] Título único por página con keyword principal
- [x] Meta description con keyword + CTA
- [x] Open Graph + Twitter Cards
- [x] JSON-LD (WebApplication schema)
- [x] sitemap.xml dinámico
- [x] robots.txt
- [x] HTML semántico (h1 único, h2 jerárquicos)
- [x] lang="es"
- [x] Canonical URL
- [x] Core Web Vitals optimizados (Next.js Image, fuentes display=swap)
- [x] Contenido en español
- [x] Datos estructurados de aplicación

---

## Monitoreo gratuito

- **UptimeRobot** — 50 monitores gratis, checks cada 5 min
- **Vercel Analytics** — incluido en plan gratis
- **Google Search Console** — indexación y keywords
