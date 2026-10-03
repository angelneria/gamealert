const axios = require('axios');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function test() {
  // 1. Epic Games
  console.log('=== EPIC GAMES ===');
  const epicUrls = [
    'https://store-content.ak.epicgames.com/api/en-US/freeGames',
    'https://store.epicgames.com/free-games',
  ];
  for (const url of epicUrls) {
    try {
      const r = await axios.get(url, { headers: { 'User-Agent': UA }, timeout: 8000 });
      console.log('  ' + url.substring(0, 60) + ' → ' + r.status + ' (' + typeof r.data + ')');
    } catch (e) {
      console.log('  ' + url.substring(0, 60) + ' → ' + e.message.substring(0, 50));
    }
  }

  // 2. GOG - look for embedded JSON data
  console.log('\n=== GOG ===');
  try {
    const r = await axios.get('https://www.gog.com/en/games/free', { headers: { 'User-Agent': UA }, timeout: 10000 });
    const html = r.data;
    // Look for game links with images
    const links = html.match(/href="\/game\/[a-z0-9\-]+"/g) || [];
    const imgs = html.match(/src="(https:[^"]*media[^"]+)"/g) || [];
    console.log('  Game links: ' + links.length);
    console.log('  Images: ' + imgs.length);
    if (imgs.length > 0) console.log('  Sample img: ' + imgs[0].substring(0, 120));
    // Look for JSON embedded data
    const jsonMatch = html.match(/gog\.com\(window\.__NEXT_DATA__\s*=\s*(\{[\s\S]*?\})\s*\)/);
    if (jsonMatch) console.log('  Found NEXT_DATA JSON');
    // Check for product data
    const prodMatch = html.match(/"gameUrl"\s*:\s*"([^"]+)"/g) || [];
    console.log('  gameUrl matches: ' + prodMatch.length);
    prodMatch.slice(0, 3).forEach(m => console.log('    ' + m.substring(0, 80)));
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 3. CheapShark - FREE games (price = 0)
  console.log('\n=== CHEAPSHARK ===');
  try {
    const r = await axios.get('https://www.cheapshark.com/api/1.0/deals?upperPrice=0&pageSize=30', { timeout: 10000 });
    console.log('  Free deals: ' + r.data.length);
    const storeMap = { '1': 'Steam', '7': 'GOG', '21': 'Humble', '23': 'Epic', '25': 'Ubisoft', '28': 'CDKeys', '31': 'Amazon', '34': 'Epic2' };
    r.data.slice(0, 8).forEach(d => {
      const store = storeMap[d.storeID] || 'Store#' + d.storeID;
      console.log('  - ' + d.title + ' (' + store + ')');
    });
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 4. SteamSpy free games
  console.log('\n=== STEAMSPY ===');
  try {
    const r = await axios.get('https://steamspy.com/api.php?request=genre&genre=Free%20to%20Play', { timeout: 10000 });
    const games = Object.values(r.data).slice(0, 5);
    console.log('  Free to Play games: ' + Object.keys(r.data).length);
    games.forEach(g => console.log('  - ' + g.name + ' | owners: ' + g.owners));
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 5. Itch.io free games API
  console.log('\n=== ITCH.IO ===');
  try {
    const r = await axios.get('https://itch.io/games/free', { headers: { 'User-Agent': UA }, timeout: 10000 });
    const html = r.data;
    const titles = html.match(/class="title">([^<]+)<\/span>/g) || [];
    const gameLinks = html.match(/href="(\/game\/[^"]+)"/g) || [];
    console.log('  Titles: ' + titles.length);
    console.log('  Links: ' + gameLinks.length);
    titles.slice(0, 3).forEach(t => console.log('  - ' + t.replace(/<[^>]+>/g, '')));
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }
}

test();
