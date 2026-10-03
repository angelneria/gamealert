const axios = require("axios");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function test() {
  // Test batch appdetails (multiple appids)
  console.log("=== BATCH APPDETAILS ===");
  try {
    const r = await axios.get(
      "https://store.steampowered.com/api/appdetails?appids=1245620,1091500,730",
      { headers: { "User-Agent": UA }, timeout: 15000 }
    );
    for (const [id, data] of Object.entries(r.data)) {
      if (data?.data) {
        console.log(
          `  ${data.data.name} | meta:${data.data.metacritic?.score || "none"} | free:${data.data.is_free} | type:${data.data.type}`
        );
      }
    }
  } catch (e) {
    console.log("Error: " + e.message.substring(0, 60));
  }

  // Check how to detect demos in search
  console.log("\n=== DEMO DETECTION IN SEARCH ===");
  const r = await axios.get(
    "https://store.steampowered.com/search/?specials=1&category1=998",
    { headers: { "User-Agent": UA }, timeout: 20000 }
  );
  const rows = r.data.split('data-ds-appid=');

  // Look for demo indicators
  let demoCount = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const titleMatch = row.match(/<span class="title">([^<]+)<\/span>/);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();

    // Check various demo indicators
    const hasDemoTag = row.includes("Demo");
    const hasDemoInTitle = title.toLowerCase().includes("demo");
    const hasCapSuffix = /demo$/i.test(title);

    // Check for "Free to Play" tag
    const isF2P = row.includes("Free to Play") || row.includes("free_to_play");

    // Check for early access
    const isEarlyAccess = row.includes("Early Access");

    if (hasDemoTag || hasDemoInTitle) {
      demoCount++;
      if (demoCount <= 5) {
        console.log(`  DEMO: ${title} | tag:${hasDemoTag} | title:${hasDemoInTitle} | f2p:${isF2P} | ea:${isEarlyAccess}`);
      }
    }
  }
  console.log("Total demos in specials: " + demoCount);

  // Check what tags/categories are available
  console.log("\n=== CATEGORY/TAG INFO ===");
  const firstRow = rows[1] || "";
  // Look for category tags
  const catMatch = firstRow.match(/class="col search_tags">([\s\S]*?)<\/div>/);
  if (catMatch) {
    const tags = catMatch[1].match(/<span>([^<]+)</g) || [];
    console.log("Tags:", tags.map((t) => t.replace(/<[^>]+>/g, "")).join(", "));
  }
}

test();
