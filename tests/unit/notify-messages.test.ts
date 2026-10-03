/**
 * Notification message builders — gratis vs chollo.
 *
 * Proves that Discord embeds and emails adapt to the game type:
 *  - free games: price "GRATIS", no discount field, CTA "Jugar gratis"
 *  - deals: sale price + original price + discount %, CTA "Ver oferta"
 */
import { buildDiscordEmbed, type DiscordGame } from "@/server/discord";
import {
  buildEmailSubject,
  buildEmailHtml,
  buildEmailText,
  buildDigestSubject,
  buildDigestHtml,
  buildDigestText,
  type EmailGame,
  type DigestItem,
} from "@/server/notemail";

const freeGame: DiscordGame = {
  title: "Juego Gratis",
  platform: "steam",
  storeUrl: "https://store.steampowered.com/app/1/",
  imageUrl: "https://img.example.com/x.jpg",
  description: "Gratis por tiempo limitado",
  publisher: "Editor SA",
  metacriticScore: 84,
};

const dealGame: DiscordGame = {
  ...freeGame,
  title: "Juego Chollo",
  isFree: false,
  salePrice: 4.99,
  originalPrice: 19.99,
  discountPct: 75,
};

function field(embed: Record<string, unknown>, name: string) {
  const fields = embed.fields as Array<{ name: string; value: string }>;
  return fields.find((f) => f.name === name);
}

describe("buildDiscordEmbed", () => {
  describe("juego gratis", () => {
    const embed = buildDiscordEmbed(freeGame);

    it("muestra Precio = GRATIS", () => {
      expect(field(embed, "Precio")?.value).toBe("GRATIS");
    });

    it("NO incluye campo Descuento", () => {
      expect(field(embed, "Descuento")).toBeUndefined();
    });

    it("incluye Plataforma, Metacritic y Editor", () => {
      expect(field(embed, "Plataforma")?.value).toBe("Steam");
      expect(field(embed, "Metacritic")?.value).toBe("84/100");
      expect(field(embed, "Editor")?.value).toBe("Editor SA");
    });
  });

  describe("chollo (rebajado)", () => {
    const embed = buildDiscordEmbed(dealGame);

    it("muestra precio rebajado con el precio original tachado en texto", () => {
      expect(field(embed, "Precio")?.value).toBe("$4.99 (antes $19.99)");
    });

    it("añade el campo Descuento", () => {
      expect(field(embed, "Descuento")?.value).toBe("-75%");
    });

    it("el precio nunca dice GRATIS", () => {
      expect(field(embed, "Precio")?.value).not.toContain("GRATIS");
    });
  });

  it("chollo sin precio original → solo el precio rebajado", () => {
    const embed = buildDiscordEmbed({ ...dealGame, originalPrice: undefined });
    expect(field(embed, "Precio")?.value).toBe("$4.99");
  });

  it("chollo sin porcentaje de descuento → sin campo Descuento", () => {
    const embed = buildDiscordEmbed({ ...dealGame, discountPct: undefined });
    expect(field(embed, "Descuento")).toBeUndefined();
  });

  it("sin editor (publisher vacío o 'Various') → no muestra Editor", () => {
    expect(field(buildDiscordEmbed({ ...freeGame, publisher: "" }), "Editor")).toBeUndefined();
    expect(field(buildDiscordEmbed({ ...freeGame, publisher: "Various" }), "Editor")).toBeUndefined();
  });
});

describe("buildEmailSubject", () => {
  it("gratis → 'Juego Gratis: título en tienda'", () => {
    expect(buildEmailSubject(freeGame)).toBe(
      "Juego Gratis: Juego Gratis en steam"
    );
  });

  it("chollo → 'Chollo: título a precio en tienda (-descuento)'", () => {
    expect(buildEmailSubject(dealGame)).toBe(
      "Chollo: Juego Chollo a $4.99 en steam (-75%)"
    );
  });

  it("chollo sin porcentaje → sin el paréntesis de descuento", () => {
    expect(buildEmailSubject({ ...dealGame, discountPct: undefined })).toBe(
      "Chollo: Juego Chollo a $4.99 en steam"
    );
  });
});

describe("cuerpo del email", () => {
  it("gratis: HTML con GRATIS, CTA 'Jugar gratis' y sin descuentos", () => {
    const html = buildEmailHtml(freeGame, 84);
    expect(html).toContain("GRATIS");
    expect(html).toContain("Jugar gratis");
    expect(html).toContain("Juego gratis detectado");
    expect(html).not.toContain("-75%");
    expect(html).not.toContain("Ver oferta");
  });

  it("chollo: HTML con precios, descuento y CTA 'Ver oferta'", () => {
    const html = buildEmailHtml(dealGame, 84);
    expect(html).toContain("$4.99");
    expect(html).toContain("$19.99");
    expect(html).toContain("-75%");
    expect(html).toContain("Ver oferta");
    expect(html).toContain("Chollo detectado");
    expect(html).not.toContain("GRATIS");
    expect(html).not.toContain("Jugar gratis");
  });

  it("gratis: texto plano con Precio: GRATIS", () => {
    const text = buildEmailText(freeGame, 84);
    expect(text).toContain("Precio: GRATIS");
    expect(text).toContain("Juego gratis detectado");
  });

  it("chollo: texto plano con precio, original y descuento", () => {
    const text = buildEmailText(dealGame, 84);
    expect(text).toContain("Precio: $4.99 (antes $19.99) -75%");
    expect(text).toContain("Chollo detectado");
    expect(text).not.toContain("GRATIS");
  });
});

describe("tipos de mensaje", () => {
  it("EmailGame y DiscordGame comparten la información de precio del chollo", () => {
    const emailGame: EmailGame = dealGame; // estructura compatible
    expect(emailGame.salePrice).toBe(4.99);
    expect(emailGame.discountPct).toBe(75);
    expect(emailGame.isFree).toBe(false);
  });
});

describe("resumen (un email con todo)", () => {
  const freeItem: DigestItem = { game: { ...freeGame }, score: 84 };
  const dealItem: DigestItem = {
    game: { ...dealGame, isFree: false },
    score: 80,
  };
  const mixed = [freeItem, dealItem];

  describe("buildDigestSubject", () => {
    it("mixto: cuenta gratis y chollos por separado", () => {
      expect(buildDigestSubject(mixed)).toBe(
        "GameAlert: 2 novedades (1 gratis + 1 chollo)"
      );
    });

    it("solo chollos: sin mencionar gratis", () => {
      expect(buildDigestSubject([dealItem, dealItem])).toBe(
        "GameAlert: 2 chollos"
      );
    });

    it("solo gratis: sin mencionar chollos", () => {
      expect(buildDigestSubject([freeItem])).toBe("GameAlert: 1 juego gratis");
      expect(buildDigestSubject([freeItem, freeItem])).toBe(
        "GameAlert: 2 juegos gratis"
      );
    });
  });

  describe("buildDigestHtml", () => {
    it("lista todos los títulos con sus secciones y precios", () => {
      const html = buildDigestHtml(mixed);
      expect(html).toContain("Juego Gratis");
      expect(html).toContain("Juego Chollo");
      expect(html).toContain("Gratis");
      expect(html).toContain("Chollos");
      expect(html).toContain("GRATIS");
      expect(html).toContain("$4.99");
      expect(html).toContain("-75%");
      expect(html).toContain("Gestionar preferencias");
    });

    it("resumen solo de chollos: ni rastro de GRATIS", () => {
      const html = buildDigestHtml([dealItem]);
      expect(html).toContain("Juego Chollo");
      expect(html).not.toContain("GRATIS");
    });
  });

  describe("buildDigestText", () => {
    it("texto plano con secciones, precios y enlaces", () => {
      const text = buildDigestText(mixed);
      expect(text).toContain("Resumen: 2 novedades");
      expect(text).toContain("GRATIS:");
      expect(text).toContain("CHOLLOS:");
      expect(text).toContain("Juego Gratis (steam) — GRATIS");
      expect(text).toContain("Juego Chollo (steam) — $4.99 (antes $19.99) -75%");
      expect(text).toContain("https://store.steampowered.com/app/1/");
    });
  });
});
