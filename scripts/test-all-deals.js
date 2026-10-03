const axios = require("axios");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function test() {
  // Get ALL specials (not just 50) using infinite scroll
  console.log("=== ALL STEAM SPECIALS ===");
  let allRows = [];
  let start = 0;
  const count = 100;

  while (start < 500) {
    try {
      const r = await axios.get(
        `https://store.steampowered.com/search/results/?query&start=${start}&count=${count}&dynamic_data=&sort_by=_ASC&snr=1_7_7_7000_7&category1=998&specials=1&infinite=1`,
        { headers: { "User-Agent": UA }, timeout: 20000 }
      );
      const data = r.data;
      if (typeof data === "string") {
        // It's HTML
        const rows = data.split('data-ds-appid=');
        allRows.push(...rows.slice(1));
        console.log(`start=${start}: got ${rows.length - 1} rows (total: ${allRows.length})`);
        if (rows.length - 1 < count) break;
        start += count;
      } else if (data.results_html) {
        // It's JSON with results_html
        const rows = data.results_html.split('data-ds-appid=');
        allRows.push(...rows.slice(1));
        console.log(`start=${start}: got ${rows.length - 1} rows (total: ${allRows.length})`);
        if (rows.length - 1 < count) break;
        start += count;
      } else {
        console.log("start=" + start + ": unknown format, keys:", typeof data === "object" ? Object.keys(data) : "string");
        break;
      }
    } catch (e) {
      console.log("Error at start=" + start + ": " + e.message.substring(0, 60));
      break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("\nTotal rows collected: " + allRows.length);

  // Find 100% discount games
  console.log("\n=== 100% DISCOUNT GAMES ===");
  let freeDeals = 0;
  for (const row of allRows) {
    const titleMatch = row.match(/<span class="title">([^<]+)<\/span>/);
    const idMatch = row.match(/^"(\d+)"/);
    if (!titleMatch || !idMatch) continue;

    const title = titleMatch[1].trim();
    const id = idMatch[1];

    // Discount percentage
    const discMatch = row.match(/discount_pct">(-?\d+)%</);
    const disc = discMatch ? parseInt(discMatch[1]) : 0;

    // Original price
    const origMatch = row.match(/discount_original_price[^>]*>([^<]+)</);
    const orig = origMatch ? origMatch[1].trim() : "";

    // Final price
    const finalMatch = row.match(/discount_final_price[^>]*>([^<]+)</);
    const final = finalMatch ? finalMatch[1].trim() : "";

    // Is it 100% off?
    if (disc === -100 || (orig && final === "Free")) {
      freeDeals++;
      console.log(`  🎮 ${title} (appid:${id}) | orig:"${orig}" → "${final}"`);
    }
  }
  console.log("\nTotal 100% discount deals: " + freeDeals);

  // Also check: games with "Free" final price
  console.log("\n=== GAMES WITH 'Free' FINAL PRICE ===");
  let freePrice = 0;
  for (const row of allRows.slice(0, 50)) {
    const titleMatch = row.match(/<span class="title">([^<]+)<\/span>/);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();
    const finalMatch = row.match(/discount_final_price[^>]*>([^<]+)</);
    const final = finalMatch ? finalMatch[1].trim() : "";
    if (final.toLowerCase() === "free") {
      freePrice++;
      console.log(`  ${title} → "${final}"`);
    }
  }
  console.log("Total with 'Free' price: " + freePrice);
}

test();
