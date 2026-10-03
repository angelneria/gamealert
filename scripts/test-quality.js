const axios = require("axios");
const UA = "GameAlert/1.0 (contact@gamealert.app)";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function test() {
  // 1. CheapShark free deals with Metacritic
  console.log("=== CHEAPSHARK FREE DEALS ===");
  try {
    const r = await axios.get(
      "https://www.cheapshark.com/api/1.0/deals?upperPrice=0&pageSize=50",
      { headers: { "User-Agent": UA }, timeout: 15000 }
    );
    console.log("Free deals: " + r.data.length);
    const storeNames = { "1": "Steam", "7": "GOG", "11": "Humble", "21": "Humble", "25": "Epic", "13": "Ubisoft", "15": "GreenMan", "23": "GreenMan", "27": "GreenMan", "28": "GreenMan", "30": "GreenMan", "35": "GreenMan" };
    r.data.forEach((d) => {
      const store = storeNames[d.storeID] || "Store#" + d.storeID;
      console.log(
        `  ${d.title.substring(0, 30).padEnd(30)} | ${store.padEnd(10)} | meta:${d.metacriticScore || "none"} | normal:$${d.normalPrice} | steamAppID:${d.steamAppID || "none"}`
      );
    });
  } catch (e) {
    console.log("Error: " + e.message.substring(0, 60));
  }

  // 2. GOG reviewsRating field
  console.log("\n=== GOG QUALITY FIELDS ===");
  try {
    const r = await axios.get("https://www.gog.com/en/games/free", {
      headers: { "User-Agent": BROWSER_UA },
      timeout: 20000,
    });
    const html = r.data;
    const prodIdx = html.indexOf('"products":[');
    if (prodIdx >= 0) {
      let start = html.indexOf("[", prodIdx);
      let depth = 0;
      let end = start;
      for (let i = start; i < html.length; i++) {
        if (html[i] === "[") depth++;
        if (html[i] === "]") depth--;
        if (depth === 0) { end = i + 1; break; }
      }
      const products = JSON.parse(html.substring(start, end));
      // Show quality fields for each product
      products.slice(0, 8).forEach((p) => {
        console.log(
          `  ${(p.title || "?").substring(0, 30).padEnd(30)} | reviewsRating:${p.reviewsRating || "none"} | reviewsCount:${p.reviewsCount || "none"} | price:${JSON.stringify(p.price?.finalAmount ?? "?")}`
        );
      });
    }
  } catch (e) {
    console.log("Error: " + e.message.substring(0, 60));
  }

  // 3. Check Epic - can we get metacritic from the promotion API?
  console.log("\n=== EPIC QUALITY FIELDS ===");
  try {
    const r = await axios.get(
      "https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US",
      { headers: { "User-Agent": BROWSER_UA, Accept: "application/json" }, timeout: 15000 }
    );
    const elements = r.data?.data?.Catalog?.searchStore?.elements || [];
    const free = elements.filter((g) => g.price?.totalPrice?.discountPrice === 0);
    free.forEach((g) => {
      console.log(
        `  ${g.title.substring(0, 30).padEnd(30)} | effectiveDate:${g.effectiveDate || "none"} | seller:${g.seller?.name || "none"}`
      );
      // Check for any rating fields
      const ratingKeys = Object.keys(g).filter((k) =>
        k.toLowerCase().includes("rating") || k.toLowerCase().includes("score") || k.toLowerCase().includes("review")
      );
      if (ratingKeys.length > 0) {
        console.log("    rating fields:", ratingKeys.join(", "));
      }
    });
  } catch (e) {
    console.log("Error: " + e.message.substring(0, 60));
  }
}

test();
