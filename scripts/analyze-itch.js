const axios = require('axios');
const cheerio = require('cheerio');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function analyze() {
  const r = await axios.get('https://itch.io/games/free', { headers: { 'User-Agent': UA }, timeout: 15000 });
  const $ = cheerio.load(r.data);
  
  // Get each game_cell and examine its structure
  const cells = $('.game_cell');
  console.log('Game cells:', cells.length);
  
  cells.slice(0, 10).each((i, el) => {
    const link = $(el).find('a.game_link, a[href*="itch.io"]').first();
    const url = link.attr('href') || '';
    const title = $(el).find('.title').text().trim();
    const img = $(el).find('img').attr('data-lazy_src') || $(el).find('img').attr('src') || '';
    
    console.log('\n--- Cell', i, '---');
    console.log('  URL:', url);
    console.log('  Title from .title:', title);
    console.log('  Image:', img.substring(0, 60));
    
    // Check if the title class is inside or outside the link
    const titleEl = $(el).find('.title');
    const titleParent = titleEl.parent();
    console.log('  Title parent tag:', titleParent.prop('tagName'));
    console.log('  Title parent class:', titleParent.attr('class'));
  });
}

analyze();
