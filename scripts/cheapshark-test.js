const axios = require('axios');
const cheerio = require('cheerio');
const UA = 'GameAlert/1.0 (contact@gamealert.app)';

async function test() {
  // 1. CHEAPSHARK with proper User-Agent
  console.log('=== CHEAPSHARK ===');
  try {
    const r = await axios.get('https://www.cheapshark.com/api/1.0/deals?upperPrice=0&pageSize=50', { 
      headers: { 'User-Agent': UA },
      timeout: 10000 
    });
    console.log('  Free deals: ' + r.data.length);
    r.data.forEach(d => {
      console.log('  - ' + d.title + ' | store:' + d.storeID + ' | normal:' + d.normalPrice + ' | sale:' + d.salePrice + ' | meta:' + d.metacriticScore);
    });
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 100));
    if (e.response) console.log('  Body: ' + JSON.stringify(e.response.data).substring(0, 200));
  }

  // 2. CHEAPSHARK stores
  console.log('\n=== CHEAPSHARK STORES ===');
  try {
    const r = await axios.get('https://www.cheapshark.com/api/1.0/stores', { 
      headers: { 'User-Agent': UA },
      timeout: 10000 
    });
    r.data.forEach(s => console.log('  ' + s.storeID + ': ' + s.storeName + ' (' + s.isActive + ')'));
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 80));
  }

  // 3. GOG - raw HTML deep analysis
  console.log('\n=== GOG DEEP HTML ===');
  try {
    const r = await axios.get('https://www.gog.com/en/games/free', { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }, 
      timeout: 15000 
    });
    const html = r.data;
    
    // Find all image URLs in the HTML
    const allUrls = html.match(/https?:\/\/[^"'\s<>]+\.(jpg|png|webp|avif)/g) || [];
    console.log('  All image URLs: ' + allUrls.length);
    
    // Filter for game-related images (not UI elements)
    const gameImgs = allUrls.filter(u => 
      !u.includes('patron_badge') && 
      !u.includes('avatar') && 
      !u.includes('logo') &&
      !u.includes('icon') &&
      !u.includes('menu-static')
    );
    console.log('  Game images: ' + gameImgs.length);
    gameImgs.slice(0, 10).forEach(i => console.log('    ' + i.substring(0, 100)));
    
    // Look for og:image or similar meta tags
    const ogImages = html.match(/property="og:image"\s+content="([^"]+)"/g) || [];
    console.log('  OG images: ' + ogImages.length);
    ogImages.slice(0, 3).forEach(i => console.log('    ' + i.substring(0, 100)));
    
    // Try to find image patterns near game titles
    // Look for data-medium or data-large attributes
    const dataImgs = html.match(/data-(?:medium|large|small|thumb|src)="(https?:\/\/[^"]+)"/g) || [];
    console.log('  data-* images: ' + dataImgs.length);
    dataImgs.slice(0, 5).forEach(i => console.log('    ' + i.substring(0, 100)));
    
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }
}

test();
