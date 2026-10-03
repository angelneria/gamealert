import { z } from "zod";
import { config } from "@/config";

/**
 * Centralized input validation schemas.
 * Every API route validates its input against these before touching the DB
 * or external services. This is the first line of defense.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email no válido")
  .max(254, "Email demasiado largo");

export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(128, "Contraseña demasiado larga");

export const platformSchema = z.enum(["steam", "epic", "gog"]);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  platforms: z.array(platformSchema).min(1, "Selecciona al menos una plataforma").max(3),
  discordWebhookUrl: z
    .string()
    .trim()
    .url("URL no válida")
    .refine(
      (url) => url.startsWith("https://discord.com/api/webhooks/"),
      "Debe ser un webhook de Discord válido"
    )
    .optional()
    .or(z.literal("")),
});

export const loginSchema = z.object({
  email: emailSchema,
  // Login: no filtrar la política de contraseñas en el error
  password: z.string().min(1, "Contraseña requerida").max(128),
});

export const preferencesSchema = z.object({
  // La identidad viene de la sesión; el email es opcional y se ignora
  email: emailSchema.optional(),
  platforms: z.array(platformSchema).min(1).max(3).optional(),
  discordWebhookUrl: z
    .string()
    .trim()
    .url("URL no válida")
    .refine(
      (url) => url.startsWith("https://discord.com/api/webhooks/"),
      "Debe ser un webhook de Discord válido"
    )
    .optional()
    .or(z.literal("")),
  minMetacritic: z.number().int().min(0).max(100).optional(),
  cooldownHours: z.number().int().min(1).max(168).optional(),
  emailEnabled: z.boolean().optional(),
  discordEnabled: z.boolean().optional(),
  // Chollos (juegos rebajados)
  dealsEnabled: z.boolean().optional(),
  maxDealPrice: z.number().int().min(1).max(config.deals.maxPriceCap).optional(),
  minDiscountPct: z.number().int().min(0).max(99).optional(),
});

export const gamesQuerySchema = z.object({
  platform: z.enum(["steam", "epic", "gog", "all"]).optional(),
  minMetacritic: z.coerce.number().int().min(0).max(100).optional(),
});

export const dealsQuerySchema = z.object({
  platform: z.enum(["steam", "epic", "gog", "all"]).optional(),
  minMetacritic: z.coerce.number().int().min(0).max(100).optional(),
  // Precio máximo en USD (permite decimales: 2.5)
  maxPrice: z.coerce.number().min(1).max(config.deals.maxPriceCap).optional(),
  minDiscount: z.coerce.number().int().min(0).max(99).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
export type GamesQuery = z.infer<typeof gamesQuerySchema>;
export type DealsQuery = z.infer<typeof dealsQuerySchema>;
