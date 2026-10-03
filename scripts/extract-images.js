const axios = require('axios');
const cheerio = require('cheerio');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function extractImages() {
  // 1. GOG - Find images
  console.log('=== GOG IMAGES ===');
  try {
    const r = await axios.get('https://www.gog.com/en/games/free', { 
      headers: { 'User-Agent': UA }, timeout: 15000 
    });
    const $ = cheerio.load(r.data);
    
    // Check for data-src (lazy loaded images)
    const lazyImgs = [];
    $('img[data-src]').each((i, el) => {
      const src = $(el).attr('data-src');
      if (src && (src.includes('gog') || src.includes('media'))) {
        lazyImgs.push(src);
      }
    });
    console.log('  Lazy images (data-src): ' + lazyImgs.length);
    lazyImgs.slice(0, 3).forEach(i => console.log('    ' + i.substring(0, 80)));
    
    // Check srcset
    const srcsets = [];
    $('img[srcset]').each((i, el) => {
      const srcset = $(el).attr('srcset');
      if (srcset && srcset.includes('gog')) srcsets.push(srcset);
    });
    console.log('  Srcsets with gog: ' + srcsets.length);
    
    // Check all image sources
    const allImgs = [];
    $('img').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (src.includes('media') || src.includes('gog') || src.includes('cover')) {
        allImgs.push(src.substring(0, 100));
      }
    });
    console.log('  All relevant imgs: ' + allImgs.length);
    allImgs.slice(0, 5).forEach(i => console.log('    ' + i));
    
    // Look for picture elements
    const pictures = $('picture source');
    console.log('  Picture sources: ' + pictures.length);
    pictures.slice(0, 3).each((i, el) => {
      console.log('    ' + ($(el).attr('srcset') || '').substring(0, 80));
    });
    
    // Find game-specific images in the HTML
    const mediaImgs = r.data.match(/https?:\/\/[^"'\s]*media[^"'\s]*\.(jpg|png|webp)/g) || [];
    console.log('  Media URLs in HTML: ' + mediaImgs.length);
    mediaImgs.slice(0, 5).forEach(i => console.log('    ' + i.substring(0, 80)));
    
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 2. ITCH.IO - Find images
  console.log('\n=== ITCH.IO IMAGES ===');
  try {
    const r = await axios.get('https://itch.io/games/free', { 
      headers: { 'User-Agent': UA }, timeout: 15000 
    });
    const $ = cheerio.load(r.data);
    
    const cells = $('.game_cell');
    cells.slice(0, 5).each((i, el) => {
      const title = $(el).find('.title').text().trim();
      const img = $(el).find('img').attr('data-lazy_src') || $(el).find('img').attr('src') || '';
      const link = $(el).find('a').attr('href');
      console.log('  - ' + title);
      console.log('    img: ' + img.substring(0, 80));
      console.log('    link: ' + link);
    });
    
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 3. Try SteamDB free games
  console.log('\n=== STEAMDB ===');
  try {
    const r = await axios.get('https://steamdb.info/sales/?min_discount=100&min_rating=0', { 
      headers: { 'User-Agent': UA }, timeout: 10000 
    });
    console.log('  Status: ' + r.status + ' | Length: ' + r.data.length);
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }

  // 4. Try isthereanydeal.com
  console.log('\n=== ITAD ===');
  try {
    const r = await axios.get('https://isthereanydeal.com/feeds/api/v2/deals/list?key=placeholder&price=0', { timeout: 10000 });
    console.log('  Status: ' + r.status);
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 50));
  }
  
  // 5. Try cheapshark with correct params
  console.log('\n=== CHEAPSHARK CORRECT ===');
  try {
    const r = await axios.get('https://www.cheapshark.com/api/1.0/deals?upperPrice=0&pageSize=30&sortBy=Deal%20Rating&desc=0', { timeout: 10000 });
    console.log('  Status: ' + r.status + ' | Count: ' + r.data?.length);
    if (Array.isArray(r.data)) {
      r.data.slice(0, 5).forEach(d => {
        console.log('  - ' + d.title + ' | store:' + d.storeID + ' | price:' + d.salePrice + ' | meta:' + d.metacriticScore);
      });
    }
  } catch (e) {
    console.log('  Error: ' + e.message.substring(0, 80));
  }
}

extractImages();
