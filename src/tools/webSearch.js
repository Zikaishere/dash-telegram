const Tool = require('./base');

const SEARCH_URL = 'https://html.duckduckgo.com/html/';

class WebSearchTool extends Tool {
  constructor() {
    super(
      'web_search',
      'Search the web for current information. Use this when the user asks about recent events, facts you are not sure about, or anything that requires up-to-date information from the internet.',
    );
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return (default 5)',
        },
      },
      required: ['query'],
    };
  }

  async execute({ query, max_results = 5 }) {
    const body = new URLSearchParams({ q: query });

    const res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html',
      },
      body: body.toString(),
    });

    if (!res.ok) throw new Error(`Search returned ${res.status}`);

    const html = await res.text();
    const results = this._parseResults(html, max_results);

    if (results.length === 0) return 'No results found.';

    return `Web search results for "${query}":\n\n${results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   ${r.url}`).join('\n\n')}`;
  }

  _parseResults(html, max) {
    const results = [];
    const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

    const links = [];
    let match;
    while ((match = linkRegex.exec(html)) !== null && links.length < max) {
      links.push({ url: match[1], title: this._stripTags(match[2]) });
    }

    const snippets = [];
    while ((match = snippetRegex.exec(html)) !== null && snippets.length < max) {
      snippets.push(this._stripTags(match[1]));
    }

    for (let i = 0; i < Math.min(links.length, max); i++) {
      results.push({
        title: links[i].title,
        url: links[i].url,
        snippet: snippets[i] || '',
      });
    }

    return results;
  }

  _stripTags(str) {
    return str.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
  }
}

module.exports = WebSearchTool;
