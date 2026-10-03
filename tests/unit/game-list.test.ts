/**
 * game-list — búsqueda, orden e iniciales desde Ajustes (lógica pura).
 */
import {
  filterBySearch,
  sortGames,
  initialFiltersFromPrefs,
  type SortableGame,
} from "@/lib/game-list";

function makeGame(
  title: string,
  overrides: Partial<SortableGame> = {}
): SortableGame {
  return { title, importanceScore: 50, ...overrides };
}

describe("filterBySearch", () => {
  const games = [
    makeGame("System Shock 2"),
    makeGame("Disco Elysium - The Final Cut"),
    makeGame("Half-Life 2"),
  ];

  it("consulta vacía devuelve la lista intacta (copia)", () => {
    const out = filterBySearch(games, "   ");
    expect(out.map((g) => g.title)).toEqual(games.map((g) => g.title));
    expect(out).not.toBe(games);
  });

  it("encuentra por fragmento sin importar mayúsculas", () => {
    expect(filterBySearch(games, "shock").map((g) => g.title)).toEqual([
      "System Shock 2",
    ]);
    expect(filterBySearch(games, "HALF").map((g) => g.title)).toEqual([
      "Half-Life 2",
    ]);
  });

  it("ignora acentos en consulta y títulos", () => {
    const withAccent = [...games, makeGame("Pokémon Rojo")];
    expect(filterBySearch(withAccent, "pokemon")).toHaveLength(1);
    expect(filterBySearch(withAccent, "pokémon")).toHaveLength(1);
  });

  it("sin coincidencias devuelve lista vacía", () => {
    expect(filterBySearch(games, "zelda")).toEqual([]);
  });

  it("los espacios sobrantes no rompen la búsqueda", () => {
    expect(filterBySearch(games, "  disco  ")).toHaveLength(1);
  });
});

describe("sortGames", () => {
  const games = [
    makeGame("Charlie", {
      importanceScore: 90,
      metacriticScore: 70,
      salePrice: 9.99,
      discountPct: 50,
    }),
    makeGame("Alpha", {
      importanceScore: 60,
      metacriticScore: 95,
      salePrice: 1.99,
      discountPct: 90,
    }),
    makeGame("Bravo", {
      importanceScore: 80,
      metacriticScore: 85,
      salePrice: 4.99,
      discountPct: 75,
    }),
  ];

  it("relevance mantiene el orden del servidor", () => {
    expect(sortGames(games, "relevance").map((g) => g.title)).toEqual([
      "Charlie",
      "Alpha",
      "Bravo",
    ]);
  });

  it("discount ordena de mayor a menor descuento", () => {
    expect(sortGames(games, "discount").map((g) => g.title)).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
    ]);
  });

  it("priceAsc ordena de menor a mayor precio", () => {
    expect(sortGames(games, "priceAsc").map((g) => g.title)).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
    ]);
  });

  it("metacritic ordena de mayor a menor nota", () => {
    expect(sortGames(games, "metacritic").map((g) => g.title)).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
    ]);
  });

  it("name ordena alfabéticamente (español)", () => {
    expect(sortGames(games, "name").map((g) => g.title)).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
    ]);
  });

  it("los juegos sin dato van al final, no al principio", () => {
    const mixed = [
      makeGame("Sin nota", { importanceScore: 99 }),
      makeGame("Con nota", { importanceScore: 10, metacriticScore: 60 }),
    ];
    expect(sortGames(mixed, "metacritic")[0].title).toBe("Con nota");

    const noPrice = [
      makeGame("Sin precio", { importanceScore: 99, discountPct: 95 }),
      makeGame("Barato", {
        importanceScore: 10,
        salePrice: 0.99,
        discountPct: 90,
      }),
    ];
    expect(sortGames(noPrice, "priceAsc")[0].title).toBe("Barato");
    expect(sortGames(noPrice, "discount")[0].title).toBe("Sin precio");
  });

  it("los empates se rompen por puntuación interna", () => {
    const tied = [
      makeGame("Bajo", { metacriticScore: 80, importanceScore: 40 }),
      makeGame("Alto", { metacriticScore: 80, importanceScore: 95 }),
    ];
    expect(sortGames(tied, "metacritic").map((g) => g.title)).toEqual([
      "Alto",
      "Bajo",
    ]);
  });

  it("clave desconocida = orden del servidor (fail-safe)", () => {
    expect(
      sortGames(games, "whatever" as never).map((g) => g.title)
    ).toEqual(["Charlie", "Alpha", "Bravo"]);
  });

  it("no muta la lista de entrada", () => {
    const before = games.map((g) => g.title);
    sortGames(games, "name");
    sortGames(games, "discount");
    expect(games.map((g) => g.title)).toEqual(before);
  });
});

describe("initialFiltersFromPrefs", () => {
  it("con una sola plataforma guardada la preselecciona", () => {
    const init = initialFiltersFromPrefs({ platforms: "epic" });
    expect(init.platformFilter).toBe("epic");
  });

  it("con varias plataformas, ninguna o texto libre = todas", () => {
    expect(
      initialFiltersFromPrefs({ platforms: "steam,epic,gog" }).platformFilter
    ).toBe("all");
    expect(initialFiltersFromPrefs({}).platformFilter).toBe("all");
    expect(
      initialFiltersFromPrefs({ platforms: ["steam", "gog"] }).platformFilter
    ).toBe("all");
  });

  it("ignora plataformas desconocidas", () => {
    expect(
      initialFiltersFromPrefs({ platforms: "switch,ps5" }).platformFilter
    ).toBe("all");
    expect(
      initialFiltersFromPrefs({ platforms: "steam,switch" }).platformFilter
    ).toBe("steam");
  });

  it("aplica Metacritic y topes de chollo guardados", () => {
    const init = initialFiltersFromPrefs({
      minMetacritic: 80,
      maxDealPrice: 5,
      minDiscountPct: 90,
    });
    expect(init).toEqual({
      platformFilter: "all",
      minMetacritic: 80,
      dealMaxPrice: 5,
      dealMinDiscount: 90,
    });
  });

  it("sanea valores fuera de rango y basura", () => {
    const init = initialFiltersFromPrefs({
      minMetacritic: 500,
      maxDealPrice: -3,
      minDiscountPct: "basura",
    });
    expect(init.minMetacritic).toBe(100);
    expect(init.dealMaxPrice).toBe(1);
    expect(init.dealMinDiscount).toBe(75); // defecto, no basura
  });

  it("sin preferencias usa los valores por defecto", () => {
    const init = initialFiltersFromPrefs({});
    expect(init.minMetacritic).toBe(60);
    expect(init.dealMaxPrice).toBe(10);
    expect(init.dealMinDiscount).toBe(75);
  });
});