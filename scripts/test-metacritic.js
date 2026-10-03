const axios = require("axios");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function test() {
  // Check Steam app details API for Metacritic
  // Elden Ring = 1245620, Cyberpunk = 1091500
  const appIds = ["1245620", "1091500", "2078010"]; // Elden Ring, Cyberpunk, Marvel Rivals

  for (const id of appIds) {
    try {
      const r = await axios.get(
        `https://store.steampowered.com/api/appdetails?appids=${id}`,
        { headers: { "User-Agent": UA }, timeout: 10000 }
      );
      const data = r.data[id]?.data;
      if (!data) {
        console.log(id + ": no data");
        continue;
      }
      console.log(`\n${data.name} (${id}):`);
      console.log("  Metacritic:", data.metacritic?.score || "none");
      console.log("  Metacritic URL:", data.metacritic?.url || "none");
      console.log("  Type:", data.type);
      console.log("  Is free:", data.is_free);
      console.log("  Price overview:", data.price_overview?.final_formatted || "none");
      console.log("  Recommendations:", data.recommendations?.total || "none");
      console.log("  Genres:", (data.genres || []).map((g) => g.description).join(", "));
      console.log("  Developers:", (data.developers || []).join(", "));
      console.log("  Publishers:", (data.publishers || []).join(", "));
    } catch (e) {
      console.log(id + ": " + e.message.substring(0, 50));
    }
    await new Promise((r) => setTimeout(r, 500)); // rate limit
  }

  // Check if search results have any quality indicator
  console.log("\n=== SEARCH RESULT QUALITY INDICATORS ===");
  const r = await axios.get(
    "https://store.steampowered.com/search/?specials=1&category1=998",
    { headers: { "User-Agent": UA }, timeout: 20000 }
  );
  const rows = r.data.split('data-ds-appid=');
  const row = rows[1] || "";
  // Look for review summary, recommendations
  console.log("Has search_review_summary:", row.includes("search_review_summary"));
  console.log("Has recommended:", row.includes("recommended"));
  console.log("Has search_price:", row.includes("search_price"));

  // Extract review summary class (positive/mixed/overwhelmingly positive)
  const reviewMatch = row.match(/class="search_review_summary ([^"]+)"/);
  console.log("Review summary class:", reviewMatch ? reviewMatch[1] : "none");

  // Look for review count
  const reviewCountMatch = row.match(/class="search_review_summary[^"]*"[^>]*data-tooltip-html="([^"]+)"/);
  console.log("Review tooltip:", reviewCountMatch ? reviewCountMatch[1].substring(0, 80) : "none");

  // Look for num reviews text
  const numRevMatch = row.match(/class="search_review_summary[^>]*>[\s\S]*?<span class="num_reviews">([^<]+)</);
  console.log("Num reviews:", numRevMatch ? numRevMatch[1] : "none");
}

test();
