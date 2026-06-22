const config = require('../config');

const RSS_URL = 'https://feeds.bbci.co.uk/news/rss.xml';
const TARGET_HOUR = 7;
const TARGET_TZ = 'Africa/Cairo';

let lastSentDate = null;
let interval = null;

function startNewsScheduler(bot) {
  const adminIds = config.adminIds;
  if (adminIds.length === 0) return;

  interval = setInterval(async () => {
    try {
      const cairo = getCairoParts();
      const today = `${cairo.year}-${cairo.month}-${cairo.day}`;

      if (cairo.hour === TARGET_HOUR && cairo.minute === 0 && lastSentDate !== today) {
        lastSentDate = today;

        const news = await fetchNews();
        const msg = `Daily News — ${today}\n\n${news}`;

        for (const id of adminIds) {
          try {
            await bot.sendMessage(id, msg);
          } catch (err) {
            console.error('Failed to send news to admin', id, err);
          }
        }
      }
    } catch (err) {
      console.error('News scheduler error:', err);
    }
  }, 60000);

  console.log('News scheduler started (daily at 07:00 Cairo)');
}

function stopNewsScheduler() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

async function fetchNews() {
  const res = await fetch(RSS_URL);
  const xml = await res.text();

  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && items.length < 8) {
    const item = match[1];
    const title = extractTag(item, 'title');
    const link = extractTag(item, 'link');

    if (title) {
      items.push(`${title}\n  ${link}`);
    }
  }

  if (items.length === 0) return 'No headlines available today.';

  return items.join('\n\n');
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = regex.exec(xml);
  if (!match) return '';
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .trim();
}

function getCairoParts() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TARGET_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type) => parseInt(parts.find((p) => p.type === type).value, 10);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

module.exports = { startNewsScheduler, stopNewsScheduler };
