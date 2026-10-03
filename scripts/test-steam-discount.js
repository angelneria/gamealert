const axios = require("axios");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function test() {
  // Check what specials=1 returns
  console.log("=== SPECIALS RESPONSE TYPE ===");
  try {
    const r = await axios.get(
      "https://store.steampowered.com/search/?specials=1&category1=998",
      { headers: { "User-Agent": UA }, timeout: 20000 }
    );
    console.log("Type:", typeof r.data);
    console.log("Is array:", Array.isArray(r.data));
    if (typeof r.data === "object") {
      console.log("Keys:", Object.keys(r.data).slice(0, 10));
      console.log("Sample:", JSON.stringify(r.data).substring(0, 300));
    }
  } catch (e) {
    console.log("Error: " + e.message.substring(0, 80));
  }

  // Try with different params to get 100% discount
  console.log("\n=== 100% DISCOUNT SEARCH ===");
  const urls = [
    "https://store.steampowered.com/search/?specials=1&category1=998&min_discount=100",
    "https://store.steampowered.com/search/?specials=1&category1=998&discount=100",
  ];
  for (const url of urls) {
    try {
      const r = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 20000 });
      console.log(url.substring(50, 100) + " → type: " + typeof r.data + " len: " + (typeof r.data === "string" ? r.data.length : "n/a"));
    } catch (e) {
      console.log(url.substring(50, 100) + " → " + e.message.substring(0, 40));
    }
  }

  // Get a known deal page to analyze discount structure
  console.log("\n=== DEAL ROW STRUCTURE ===");
  try {
    const r = await axios.get(
      "https://store.steampowered.com/search/?specials=1&category1=998&infinite=1",
      { headers: { "User-Agent": UA, "Accept": "text/html" }, timeout: 20000 }
    );
    const html = typeof r.data === "string" ? r.data : "";
    if (html) {
      const rows = html.split('data-ds-appid=');
      console.log("Rows: " + (rows.length - 1));
      // Analyze first deal row for discount structure
      for (let i = 1; i < Math.min(6, rows.length); i++) {
        const row = rows[i];
        const titleMatch = row.match(/<span class="title">([^<]+)<\/span>/);
        const title = titleMatch ? titleMatch[1].trim() : "?";

        // Find discount
        const discMatch = row.match(/class="discount_pct">(-?\d+)%</);
        const disc = discMatch ? discMatch[1] : "none";

        // Find original price
        const origMatch = row.match(/discount_original_price[^>]*>([^<]+)</);
        const orig = origMatch ? origMatch[1].trim() : "none";

        // Find final price
        const finalMatch = row.match(/discount_final_price[^>]*>([^<]+)</);
        const final = finalMatch ? finalMatch[1].trim() : "none";

        // Find metacritic
        const metaMatch = row.match(/metacritic_score[^>]*>(\d+)</);
        const meta = metaMatch ? metaMatch[1] : "none";

        console.log(`  ${title.substring(0, 30).padEnd(30)} | disc:${disc}% | orig:"${orig}" → final:"${final}" | meta:${meta}`);
      }
    } else {
      console.log("No HTML returned");
    }
  } catch (e) {
    console.log("Error: " + e.message.substring(0, 60));
  }
}

test();
