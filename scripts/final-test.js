const axios = require('axios');
const cheerio = require('cheerio');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function final() {
  // 1. GOG - look at picture elements properly
  console.log('=== GOG PICTURE ELEMENTS ===');
  try {
    const r = await axios.get('https://www.gog.com/en/games/free', { 
      headers: { 'User-Agent': UA }, timeout: 15000 
    });
    const $ = cheerio.load(r.data);
    
    // Each product tile has a picture element
    $('a[href*="/game/"]').slice(0, 10).each((i, el) => {
      const href = $(el).attr('href');
      const picture = $(el).find('picture').first();
      const source = picture.find('source').first();
      const img = picture.find('img').first();
      
      const srcset = source.attr('srcset') || '';
      const imgSrc = img.attr('src') || img.attr('data-src') || '';
      
      // Get all attributes of source
      const sourceAttrs = {};
      const sourceEl = source[0];
      if (sourceEl) {
        for (const attr of sourceEl.attribs) {
          sourceAttrs[attr] = sourceEl.attribs[attr];
        }
      }
      
      console.log('  ' + href);
      console.log('    source attrs: ' + JSON.stringify(sourceAttrs).substring(0, 200));
      console.log('    img src: ' + imgSrc.substring(0, 80));
    });
    
    // Try to find images in raw HTML using regex
    const rawImgs = r.data.match(/https?:\/\/[^"'\s>]*(?:gog-statics|cdn)[^"'\s>]*\.(jpg|png|webp)/g) || [];
    console.log('\n  Raw CDN images: ' + rawImgs.length);
    rawImgs.slice(0, 5).forEach(i => console.log('    ' + i.substring(0, 100)));
    
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 2. Try GOG API for game details
  console.log('\n=== GOG GAME API ===');
  try {
    // Try fetching a known free game's data
    const r = await axios.get('https://api.gog.com/v2/games/knytt-classic', { timeout: 10000 });
    console.log('  Status: ' + r.status);
    console.log('  Images: ' + JSON.stringify(r.data?.images).substring(0, 200));
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 3. CheapShark - try correct endpoint
  console.log('\n=== CHEAPSHARK FIXED ===');
  try {
    // The API uses storeID: 1=Steam, 7=GOG, 21=Humble, 23=Epic, 25=Ubisoft, 31=Amazon
    const r = await axios.get('https://www.cheapshark.com/api/1.0/deals?upperPrice=0&pageSize=50', { 
      timeout: 10000 
    });
    console.log('  Status: ' + r.status + ' | Type: ' + typeof r.data + ' | IsArray: ' + Array.isArray(r.data));
    if (typeof r.data === 'string') {
      console.log('  Response (first 300): ' + r.data.substring(0, 300));
    } else {
      console.log('  Count: ' + (r.data?.length || 'N/A'));
    }
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 100));
    if (e.response) {
      console.log('  Response data: ' + JSON.stringify(e.response.data).substring(0, 200));
    }
  }

  // 4. Try CheapShark stores endpoint
  console.log('\n=== CHEAPSHARK STORES ===');
  try {
    const r = await axios.get('https://www.cheapshark.com/api/1.0/stores', { timeout: 10000 });
    console.log('  Stores: ' + r.data.length);
    r.data.forEach(s => console.log('  - ' + s.storeID + ': ' + s.storeName));
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 80));
  }

  // 5. Try rawg.io with free key
  console.log('\n=== RAWG.IO ===');
  try {
    // Free tier key
    const r = await axios.get('https://api.rawg.io/api/games?is_free=true&platforms=4&ordering=-metacritic&page_size=20&key=1234567890', { timeout: 10000 });
    console.log('  Status: ' + r.status + ' | Count: ' + r.data?.count);
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }
}

final();
