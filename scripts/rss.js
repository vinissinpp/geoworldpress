// Leitor de RSS/Atom mínimo, sem dependências
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function clean(s) {
  if (!s) return '';
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&(\w+);/g, (m, e) => ENTITIES[e] ?? m)
    .replace(/<[^>]+>/g, ' ') // tags que vieram escapadas
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block, names) {
  for (const n of names) {
    const m = block.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i'));
    if (m && clean(m[1])) return m[1];
  }
  return '';
}

function link(block) {
  const href = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)
    || block.match(/<link[^>]*href=["']([^"']+)["']/i);
  const text = tag(block, ['link']);
  return clean(text) || (href && href[1].replace(/&amp;/g, '&')) || clean(tag(block, ['guid']));
}

function parse(xml) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map(b => {
    const date = clean(tag(b, ['pubDate', 'published', 'updated', 'dc:date']));
    const t = Date.parse(date);
    return {
      titulo: clean(tag(b, ['title'])),
      link: link(b),
      resumo: clean(tag(b, ['description', 'summary', 'content:encoded', 'content'])).slice(0, 220),
      publicado: isNaN(t) ? null : new Date(t).toISOString(),
    };
  }).filter(i => i.titulo && /^https?:\/\//.test(i.link));
}

async function fetchFeed(url, timeoutMs = 20000) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  // Alguns portais (ex.: Folha) ainda usam ISO-8859-1
  const buf = Buffer.from(await res.arrayBuffer());
  const head = buf.subarray(0, 200).toString('latin1');
  const charset = ((res.headers.get('content-type') || '').match(/charset=([\w-]+)/i)
    || head.match(/encoding=["']([\w-]+)["']/i) || [])[1] || 'utf-8';
  let text;
  try { text = new TextDecoder(charset.toLowerCase()).decode(buf); } catch { text = buf.toString('utf8'); }
  return parse(text);
}

module.exports = { fetchFeed };
