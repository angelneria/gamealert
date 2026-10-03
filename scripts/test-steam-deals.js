const axios = require("axios");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function test() {
  // Test different Steam search strategies for 100% discount deals
  const urls = [
    // specials = games on sale
    "https://store.steampowered.com/search/?specials=1&category1=998&infinite=1",
    // maxprice free
    "https://store.steampowered.com/search/?maxprice=free&category1=998",
  ];

  for (const url of urls) {
    console.log("\n=== " + url.substring(40, 80) + " ===");
    try {
      const r = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 20000 });
      const html = r.data;
      const rows = html.split('data-ds-appid=');
      console.log("Total rows: " + (rows.length - 1));

      let count = 0;
      for (let i = 1; i < rows.length && count < 10; i++) {
        const row = rows[i];
        const idMatch = row.match(/^"(\d+)"/);
        const titleMatch = row.match(/<span class="title">([^<]+)<\/span>/);
        if (!idMatch || !titleMatch) continue;

        const title = titleMatch[1].trim();

        // Look for discount percentage
        const discountMatch = row.match(/discount_pct">(-?\d+)%</);
        const discount = discountMatch ? discountMatch[1] : "0";

        // Look for price info
        const priceMatch = row.match(/search_price[^>]*>([^<]+)/);
        const price = priceMatch ? priceMatch[1].trim() : "";

        // Look for "Free" text
        const isFree = row.includes(">Free<") || row.includes('data-price-final="0"');

        // Look for review count (metacritic proxy)
        const reviewMatch = row.match(/class="search_review_summary[^"]*"/);
        const hasReviews = row.includes("search_review_summary");

        // Check if demo
        const isDemo = title.toLowerCase().includes("demo") || row.includes("Demo");

        // Check for tags
        const tagMatch = row.match(/class="col search_tags">[\\s\\S]*?<span>([^<]+)/);
        const tag = tagMatch ? tagMatch[1].trim() : "";

        console.log(
          `  ${title.substring(0, 35).padEnd(35)} | disc:${discount.padStart(3)}% | free:${isFree ? "Y" : "N"} | demo:${isDemo ? "Y" : "N"} | price:"${price}"`
        );
        count++;
      }
    } catch (e) {
      console.log("Error: " + e.message.substring(0, 60));
    }
  }
}

test();
