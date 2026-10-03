const axios = require("axios");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function test() {
  // Analyze specials=1 response
  const r = await axios.get(
    "https://store.steampowered.com/search/?specials=1&category1=998",
    { headers: { "User-Agent": UA }, timeout: 20000 }
  );
  const html = r.data;
  const rows = html.split('data-ds-appid=');
  console.log("Specials rows: " + (rows.length - 1));

  console.log("\n=== DEAL ROWS (specials=1) ===");
  let freeCount = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const idMatch = row.match(/^"(\d+)"/);
    const titleMatch = row.match(/<span class="title">([^<]+)<\/span>/);
    if (!idMatch || !titleMatch) continue;

    const title = titleMatch[1].trim();

    // Discount
    const discMatch = row.match(/discount_pct">(-?\d+)%</);
    const disc = discMatch ? parseInt(discMatch[1]) : 0;

    // Original price
    const origMatch = row.match(/discount_original_price[^>]*>([^<]+)</);
    const orig = origMatch ? origMatch[1].trim() : "";

    // Final price
    const finalMatch = row.match(/discount_final_price[^>]*>([^<]+)</);
    const final = finalMatch ? finalMatch[1].trim() : "";

    // Metacritic
    const metaMatch = row.match(/metacritic_score[^>]*>(\d+)</);
    const meta = metaMatch ? metaMatch[1] : "none";

    // Is demo
    const isDemo = title.toLowerCase().includes("demo");

    // Only show 100% discount or free
    if (disc >= 100 || final.toLowerCase() === "free" || orig === "") {
      freeCount++;
      console.log(
        `  ${title.substring(0, 35).padEnd(35)} | disc:${disc}% | orig:"${orig}" → final:"${final}" | meta:${meta} | demo:${isDemo ? "Y" : "N"}`
      );
    }
  }
  console.log("\nTotal 100% discount or free: " + freeCount);

  // Also test min_discount=100
  console.log("\n=== min_discount=100 ===");
  const r2 = await axios.get(
    "https://store.steampowered.com/search/?specials=1&category1=998&min_discount=100",
    { headers: { "User-Agent": UA }, timeout: 20000 }
  );
  const rows2 = r2.data.split('data-ds-appid=');
  console.log("Rows: " + (rows2.length - 1));
  for (let i = 1; i < Math.min(15, rows2.length); i++) {
    const row = rows2[i];
    const titleMatch = row.match(/<span class="title">([^<]+)<\/span>/);
    const discMatch = row.match(/discount_pct">(-?\d+)%</);
    const metaMatch = row.match(/metacritic_score[^>]*>(\d+)</);
    const title = titleMatch ? titleMatch[1].trim() : "?";
    const disc = discMatch ? discMatch[1] : "0";
    const meta = metaMatch ? metaMatch[1] : "none";
    const isDemo = title.toLowerCase().includes("demo");
    console.log(
      `  ${title.substring(0, 35).padEnd(35)} | disc:${disc}% | meta:${meta} | demo:${isDemo ? "Y" : "N"}`
    );
  }
}

test();
