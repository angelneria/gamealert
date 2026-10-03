# GameAlert — Testing Spec

> **Regla de oro:** Cada archivo nuevo, función nueva o cambio de comportamiento
> DEBE venir acompañado de tests. Sin tests, no se hace merge.

---

## 1. Pirámide de tests

```
        ┌─────────────┐
        │   E2E/UI    │  ← Smoke tests de páginas (HTML render, diseño)
        ├─────────────┤
        │ Integración │  ← API routes contra servidor vivo
        ├─────────────┤
        │   Unitarios │  ← Funciones puras (filters, notification-filter)
        └─────────────┘
```

| Capa | Qué prueba | Dónde | Cuándo corre |
|------|-----------|-------|--------------|
| **Unitarias** | Funciones puras, predicados, parsers | `tests/unit/*.test.ts` | Siempre (`npx jest`) |
| **Integración** | API routes, DB, páginas render | `tests/integration/*.test.ts` | Con servidor vivo |
| **Smoke/UI** | HTML contiene diseño + contenido ES | `scripts/test.sh` | Post-cambio de UI |

---

## 2. Convenciones

### Nombramiento
- Archivo: `tests/unit/<modulo>.test.ts` para `src/lib/<modulo>.ts`
- Describe: nombre de la función o regla de negocio
- It: comportamiento observable en español o inglés claro

### Estructura de un test
```ts
describe("nombreFuncion", () => {
  it("acepta el caso feliz", () => { ... });
  it("rechaza el caso límite", () => { ... });
  it("maneja entrada vacía", () => { ... });
});
```

### Cobertura mínima por función
- [ ] Caso feliz
- [ ] Casos límite (0, null, undefined, string vacío)
- [ ] Casos de rechazo (lo que NO debe pasar)
- [ ] Casos borde descubiertos en producción

---

## 3. Reglas por módulo

### `src/lib/filters.ts` — Predicados de scraping
| Función | Tests obligatorios |
|---------|-------------------|
| `isSteam100PercentDiscount` | -100 sí, -99/-70/0 no |
| `isSteamDemo` | título con "demo", marcadores HTML |
| `isSteamF2P` | "Free to Play", "free_to_play" |
| `isSteamTemporarilyFreeGame` | gate completo: -100 + no demo + no F2P |
| `parseSteamRowId/Title/Discount/Image` | extracción de HTML real |
| `isEpicTemporarilyFree` | discountPrice=0 + originalPrice>0 |
| `buildEpicStoreUrl` | pageSlug → URL, fallback hub |
| `isGogExcludedProduct` | DLC/demo/mod/unrated/expansion |
| `isGogFreeGame` | gate completo: no excluido + imagen + gratis |
| `normalizeTitle` | case/puntuación insensible |
| `dedupeGames` | primera ocurrencia gana |
| `passesQualityThreshold` | max(importance, metacritic) >= umbral |
| `cheapsharkStoreToPlatform` | 1→steam, 7→gog, 25→epic, resto → null |
| `parseCheapsharkDeal` | fila válida → chollo con precio/descuento; gratis (salePrice 0) ✗, tienda desconocida ✗, sin título ✗, sin precio ✗, sin enlace ✗ |
| `passesDealPrice` | precio <= tope ✓, centésima sobre el tope ✗, sin precio ✗ (fail-closed), gratis pasa siempre |
| `passesDealDiscount` | descuento >= mínimo ✓, justo por debajo ✗, sin dato ✗ (fail-closed), gratis pasa siempre |

### `src/lib/notification-filter.ts` — Targeting de usuarios
| Función | Tests obligatorios |
|---------|-------------------|
| `matchesPlatforms` | plataforma seleccionada sí, otra no, [] = todas |
| `meetsMetacriticThreshold` | score >= umbral, < umbral, unrated |
| `isOnCooldown` | título normalizado en Set |
| `selectNewGamesForUser` | pipeline completo: platform → quality → **deals (precio+descuento, solo si `dealsEnabled`)** → cooldown. Los gratis NO pasan por las puertas de chollo; los chollos filtrados por precio/descuento NO cuentan como `skipped` (eso es solo cooldown) |
| `limitRunBatch` | tope `MAX_DEALS_PER_RUN`=10 por ejecución: chollos ordenados de mejor a peor, los que sobran cuentan como `deferred`; gratis sin tope y salen primero; tope por parámetro (0 incluido); desempate por descuento; no muta la entrada |
| `shouldSendDiscord` | enabled + webhook |
| `shouldSendEmail` | enabled |
| `channelsForUser` | combinaciones de canales |

### `src/lib/game-list.ts` — Búsqueda, orden e iniciales de la lista
| Función | Tests obligatorios |
|---------|-------------------|
| `filterBySearch` | vacía = intacta (copia), fragmento sin mayúsculas, ignora acentos, sin coincidencias = [], espacios sobrantes |
| `sortGames` | relevancia = orden servidor; descuento/precio/Metacritic/nombre; sin dato al final; empates por importancia; clave desconocida = fail-safe; no muta |
| `initialFiltersFromPrefs` | una plataforma → preseleccionada; varias/ninguna/desconocida → todas; aplica Metacritic y topes; sanea rangos y basura; defectos sin prefs |

### `src/lib/api-client.ts` — Scraping
| Función | Tests obligatorios |
|---------|-------------------|
| `calculateImportance` | max(importance, metacritic), cap 100 |
| `getPlatformDisplayName` | steam/epic/gog + fallback |
| `scrapeAllPlatforms` | (integración) dedup + sort |
| `scrapeDeals` | (integración) una llamada a CheapShark con tope de precio; gratis excluidas; error upstream → `[]` (nunca rompe al caller) |

### `src/server/notify-runner.ts` — Lote de notificaciones
| Regla | Tests obligatorios |
|-------|-------------------|
| Scraping de chollos condicional | `scrapeDeals` SOLO se llama si algún usuario tiene `dealsEnabled`; con nadie interesado no se visita CheapShark |
| Presupuesto del lote | se llama con `max(maxDealPrice)` de los usuarios interesados |
| Dedupe gratis vs chollo | mismo título gratis+rebajado → UNA notificación, y gana la versión **gratis** |
| Chollos en el pipeline | por debajo del presupuesto ✗, por debajo del descuento mínimo ✗, enviado → entra en cooldown igual que los gratis |
| Tope de chollos por ejecución | 15 chollos que cascan → solo 10 envíos en el primer run; los 5 aplazados salen en el siguiente (15 en total, ningún título repetido); los gratis (12) salen todos de golpe sin tope |
| Resumen por canal | 15 chollos → UNA llamada de Discord (no 10/15) con los 10 mejores; el historial sigue registrándose por juego (cooldown intacto); el email sale en un solo envío |
| Mensaje con precio | el `DiscordGame`/`EmailGame` del chollo lleva `isFree=false`, `salePrice`, `discountPct`, `originalPrice` |

### `src/server/discord.ts` + `notemail.ts` — Mensajes
| Función | Tests obligatorios |
|---------|-------------------|
| `buildDiscordEmbed` | gratis → Precio "GRATIS" y SIN campo Descuento; chollo → "$4.99 (antes $19.99)" + "-75%"; sin original → solo precio; sin publisher → sin Editor |
| `sendDiscordDigest` | hasta 10 embeds por mensaje (11 juegos → 2 mensajes de 10+1); vacío → true sin peticiones; un tramo falla → false (reintento entero); URL no oficial → false |
| `buildDigestSubject/Html/Text` | asunto con cuentas (1 gratis + N chollos); HTML con secciones Gratis/Chollos y todos los títulos; solo-chollos sin GRATIS; texto con precios y enlaces |
| `sendDiscordNotification` | espera 1 s tras cada intento (límite de rate, programado con timers); URL no oficial → sin petición y sin pausa |
| `buildEmailSubject` | gratis → "Juego Gratis: …"; chollo → "Chollo: … a $X en tienda (-N%)" |
| `buildEmailHtml` / `buildEmailText` | gratis → GRATIS + CTA "Jugar gratis"; chollo → precios + descuento + CTA "Ver oferta", nunca la palabra GRATIS |

### `src/lib/security.ts` — Rate limiting y cabeceras
| Función | Tests obligatorios |
|---------|-------------------|
| `isValidDiscordWebhook` (en `discord.ts`) | dominios oficiales sí, http no, localhost/IPs internos no, path webhook requerido, URL malformada no |
| `rateLimit` | (integración) 429 con `Retry-After` al superar presupuesto; loopback exento en dev |
| `securityHeaders` | (integración) CSP, X-Frame-Options, HSTS, nosniff presentes |

### `src/lib/validation.ts` — Esquemas Zod
| Esquema | Tests obligatorios |
|---------|-------------------|
| `registerSchema` | email se normaliza (trim+lowercase), **password ≥8 obligatorio**, plataformas solo PC, vacío/malformado/webhook no-Discord rechazados, email >254 chars rechazado |
| `loginSchema` | email+password, **NO impone política de 8 chars** (sin leak de información) |
| `preferencesSchema` | minMetacritic 0–100, cooldownHours 1–168, fuera de rango rechazado, email opcional (la identidad viene de la sesión), chollos: `maxDealPrice` 1–30 entero, `minDiscountPct` 0–99, `dealsEnabled` booleano |
| `gamesQuerySchema` | coerce de strings de query, plataforma desconocida rechazada, rango rechazado |
| `dealsQuerySchema` | coerce (maxPrice admite decimales), maxPrice 1–cap, minDiscount 0–99, plataforma desconocida rechazada, objeto vacío válido (defaults en la ruta) |

### `src/lib/password.ts` — Hash de contraseñas (scrypt)
| Función | Tests obligatorios |
|---------|-------------------|
| `hashPassword` | roundtrip con `verifyPassword`, salt único por usuario, nunca contiene la contraseña en claro, formato `scrypt:salt:hash` |
| `verifyPassword` | contraseña correcta ✓, incorrecta ✗, hash vacío/tamperado/malformado ✗ |
| `verifyPasswordOrDummy` | usuarios legacy sin passwordHash siempre ✗ (timing uniforme) |

### `src/lib/session.ts` + `session-core.ts` + `session-edge.ts` — Sesiones firmadas
| Función | Tests obligatorios |
|---------|-------------------|
| `createSessionToken` | formato `uid.exp.sig`, expiración futura |
| `verifySessionToken` | roundtrip ✓, userId alterado ✗, expiración extendida ✗, firma alterada ✗, token caducado ✗, basura ✗ |
| `parseToken` | estructura inválida → null |
| Edge (`session-edge.ts`) | misma verificación con Web Crypto (integración: /dashboard con cookie → 200, sin cookie → redirect) |

### API Routes
| Endpoint | Tests obligatorios |
|----------|-------------------|
| `POST /api/auth` | 201 + cookie sesión, 400 email inválido, 400 platforms vacío, 400 password <8, 409 email duplicado, 400 webhook no-Discord |
| `POST /api/auth/login` | 200 + cookie, 401 genérico con password errónea, **mismo 401 con email inexistente** (sin enumeración) |
| `POST /api/auth/logout` | 200 + `Max-Age=0` en la cookie |
| `GET /api/auth` | 200 con sesión, 401 sin sesión (sin lookup arbitrario por email) |
| `PUT /api/auth/preferences` | 200 con sesión + persistencia, 401 sin sesión, 400 fuera de rango (incl. campos de chollos) |
| `GET /api/games` | 200, games array, total number |
| `GET /api/games?minMetacritic=N` | filtro calidad |
| `GET /api/games?platform=X` | filtro plataforma |
| `GET /api/deals` | 200 con deals array; cada chollo: `isFree=false`, `0 < salePrice <= maxPrice`, `discountPct >= minDiscount`, plataforma PC, URL https, Metacritic 0–100; `minDiscount`/`maxPrice`/`minMetacritic` respetados; 400 con parámetros fuera de rango |
| `GET /api/notifications` | 401 sin sesión, 200 solo el historial propio, limit clampado a 100 |
| `POST /api/notify` | 401 sin sesión (nunca ejecuta el batch) |
| `POST /api/notify/test` | 200 solo al webhook propio, 400 sin webhook, 400 webhook no-Discord (no toca preferencias) |
| `POST /api/cron/notify` | 401 sin Bearer, 401 con Bearer erróneo, 503 si `CRON_SECRET` no configurado |
| CSRF (middleware) | 403 con Origin cross-origin en mutaciones POST/PUT |
| Rate limit (middleware) | 429 con `Retry-After` al superar presupuesto; loopback exento en dev |
| Security headers (middleware) | CSP, X-Frame-Options, HSTS, nosniff presentes |

### SEO / Estáticos
| Recurso | Tests obligatorios |
|---------|-------------------|
| `/sitemap.xml` | 200, `<urlset>`, `<loc>` |
| `/robots.txt` | 200, User-agent, sitemap |
| `/manifest.webmanifest` | 200, name GameAlert, display standalone |

### Páginas
| Página | Tests obligatorios |
|--------|-------------------|
| `/` | 200, lang="es", "GameAlert", panel, text-outline, countdown Epic |
| `/register` | 200, formulario con **campo contraseña**, plataformas |
| `/login` | 200, campo `type="password"`, sin auth por localStorage |
| `/dashboard` | 200 **con sesión**; sin sesión → redirect a `/login?next=...` |
| `/dashboard/games` | 200 con sesión, slider Metacritic, filtros, modal de detalles, **pestañas GRATIS/CHOLLOS** |
| `/dashboard/settings` | 200 con sesión, toggles `[role=switch]` con clase `.checked` (fondo lima), sliders, cooldown con explicación, **sección chollos (toggle + precio máximo + descuento mínimo)** |

---

## 4. Template para tests nuevos

```ts
import { funcionNueva } from "@/lib/modulo";

describe("funcionNueva", () => {
  // 1. Caso feliz
  it("acepta entrada válida", () => {
    expect(funcionNueva(validInput)).toBe(expected);
  });

  // 2. Casos límite
  it("maneja entrada vacía", () => {
    expect(funcionNueva("")).toBe(defaultValue);
  });

  // 3. Rechazo
  it("rechaza entrada inválida", () => {
    expect(funcionNueva(badInput)).toBe(false);
  });

  // 4. Caso borde real
  it("caso borde: <descripción>", () => {
    expect(funcionNueva(edgeCase)).toBe(edgeExpected);
  });
});
```

---

## 5. Regla de creación de tests

**Cuando se cree algo nuevo (función, ruta, componente):**

1. **Antes de escribir código:** Define qué debe hacer y qué NO debe hacer
2. **Escribe el test primero** (TDD) o inmediatamente después
3. **Mínimo 3 tests por función:** feliz, límite, rechazo
4. **Si es un predicado de filtrado:** testea TODAS las condiciones del gate
5. **Si es una API route:** testea 200/400/404 + persistencia
6. **Si es una página:** testea 200 + contenido clave + diseño

**Checklist post-cambio:**
- [ ] `npx tsc --noEmit` pasa
- [ ] `npx jest` pasa (unitarias)
- [ ] `npx jest tests/integration` pasa (con servidor)
- [ ] `scripts/test.sh` pasa (smoke + UI)
- [ ] Tests nuevos añadidos para la funcionalidad nueva
- [ ] Tests actualizados si cambió comportamiento

---

## 6. Registro de casos de prueba

### Unitarios (277 tests)
| Suite | Tests | Cobertura |
|-------|-------|-----------|
| `filters.test.ts` | 91 | Steam/Epic/GOG/shared + chollos (CheapShark: tiendas, parseo, precio, descuento) |
| `security.test.ts` | 36 | SSRF webhook, esquemas Zod (incl. password + chollos), isLoopbackIp |
| `notification-filter.test.ts` | 33 | targeting usuarios + puertas de chollo (precio/descuento, fail-closed) + tope de chollos por ejecución |
| `notify-messages.test.ts` | 23 | mensajes Discord/email: gratis vs chollo (asunto, precios, CTAs) + resumen (asunto con cuentas, HTML/texto con secciones, sin GRATIS en solo-chollos) |
| `discord-send.test.ts` | 7 | pausa de 1 s tras cada envío (rate limit) y URL no oficial sin petición + digest (corte en 10 embeds, vacío, fallo parcial, URL mala) |
| `notify-runner.test.ts` | 18 | garantía "solo juegos nuevos" + flujo de chollos (scrape condicional, presupuesto, dedupe gratis>chollo, cooldown) + tope por ejecución + UN resumen por canal y pasada (historial sigue por juego) |
| `auth.test.ts` | 21 | scrypt, sesiones HMAC, loginSchema |
| `game-list.test.ts` | 20 | búsqueda (acentos, vacía), orden (5 claves, sin-dato al final, no muta), iniciales desde Ajustes |
| `db-config.test.ts` | 6 | selector local vs Turso, fail-closed sin token |
| `api-client.test.ts` | 9 | importance, platform, config |
| `deploy.test.ts` | 13 | vercel.json cumple límite Hobby (cron diario), secretos documentados en .env.example, proveedor sqlite, adapter libsql instalado, .gitignore cubre *.db, build regenera Prisma, .npmrc con legacy peers |

### Integración (52 tests)
| Suite | Tests | Cobertura |
|-------|-------|-----------|
| `api.test.ts` | 52 | registro+sesión, login/logout, preferencias (incl. chollos), /api/games, /api/deals, notificaciones, cron, CSRF, páginas protegidas, SEO |

**Total: 329 tests**

### Smoke/UI (test.sh)
| Check | Qué verifica |
|-------|-------------|
| TypeScript | `tsc --noEmit` sin errores |
| Server boot | puerto 3000 responde 200 |
| API /api/games | JSON válido, juegos con imagen/URL, todos gratis, plataformas PC, Metacritic 0–100, filtro calidad |
| API /api/deals | JSON válido, chollos NO gratis, precio ≤ tope, descuento ≥ mínimo, plataformas PC, filtro `minDiscount=90`, `maxPrice` fuera de rango → 400 |
| Páginas | 5 páginas → 200 |
| Diseño | panel, text-outline, lang="es" |
| Contenido ES | "Juegos", "GameAlert" |
| Chollos UI | pestaña "Chollos" en juegos; sección "Precio máximo a pagar" en ajustes |
| Buscador y orden | caja "Buscar por nombre" y selector con "Relevancia" en la lista de juegos |
| Portada con sesión | CTAs con `data-home-auth` (versión invitado en SSR; "Panel" al hidratar con sesión) |
| SEO portada | sección "Dudas razonables" + JSON-LD `FAQPage` (misma fuente de datos), tarjeta `opengraph-image` (PNG 1200×630), keywords de chollos en metadata |
| Responsive | viewport meta; nav secundaria oculta en móvil; títulos con `break-words`; modal y headers sin overflow |
| Copy Ajustes | sin párrafos largos de explicación (regresión de texto) |
| Countdown | "Próximo drop de Epic" |
| Sin emojis | ningún pictograma U+1F000–U+1FAFF en UI |

---

## 7. Comandos

```bash
# Unitarias (siempre)
npx jest tests/unit

# Integración (requiere servidor)
npm run dev &  # en otra terminal
npx jest tests/integration

# Suite completa (tsc + unit + server + smoke)
./scripts/test.sh

# Coverage
npx jest --coverage
```
