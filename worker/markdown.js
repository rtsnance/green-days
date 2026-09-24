/* Markdown for agents — content negotiation on the built pages.

   A request whose Accept header names text/markdown gets a markdown rendering
   of the same page; everyone else gets the HTML, unchanged. This is what
   Cloudflare's zone-level "Markdown for Agents" toggle does, done here instead
   for two reasons:
     1. That toggle is Pro-plan and up.
     2. It stamps `content-signal: ai-train=yes, search=yes, ai-input=yes` on
        every markdown response, which contradicts public/robots.txt
        (search=yes, ai-train=no, ai-input deliberately omitted). Here the
        header is copied from robots.txt's policy, so the two never disagree.
        If robots.txt's Content-Signal line changes, change CONTENT_SIGNAL too.

   The converter is small and dependency-free on purpose: every page it sees is
   one this repo's build scripts wrote (field guide, season, market year, the
   app shell's <noscript>), so the markup is well-formed and uses a handful of
   tags. It is not a general-purpose HTML-to-markdown library. If a build
   script starts emitting a new structural tag (a table, say), add it here.

   The app shell's only real content is its <noscript> nav, so noscript is
   unwrapped rather than dropped: an agent asking for "/" gets the two links
   into the static site, which is the right answer for a reader without JS. */

const CONTENT_SIGNAL = 'search=yes, ai-train=no';

/* ---- negotiation ---- */

// True when the client lists text/markdown with a non-zero q. Same rule as
// Cloudflare's: naming markdown at all is the opt-in. Browsers never send it.
export function wantsMarkdown(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const accept = request.headers.get('accept') || '';
  return accept.split(',').some((part) => {
    const [type, ...params] = part.trim().toLowerCase().split(';').map((s) => s.trim());
    if (type !== 'text/markdown') return false;
    const q = params.find((p) => p.startsWith('q='));
    return !q || parseFloat(q.slice(2)) > 0;
  });
}

// Every HTML page now has two representations, so shared caches must key on
// Accept. Called on the plain HTML path as well as the markdown one.
export function addVaryAccept(headers) {
  const vary = headers.get('vary');
  if (!vary) headers.set('vary', 'Accept');
  else if (!/(^|,)\s*accept\s*(,|$)/i.test(vary)) headers.set('vary', `${vary}, Accept`);
}

/* Serve an ASSETS response in the negotiated form. Non-HTML responses (images,
   css, the sitemap, 404s from the asset binding) pass through untouched. */
export async function negotiate(request, assetResponse) {
  const type = assetResponse.headers.get('content-type') || '';
  if (!type.includes('text/html')) return assetResponse;

  if (!wantsMarkdown(request) || !assetResponse.ok) {
    const out = new Response(assetResponse.body, assetResponse);
    addVaryAccept(out.headers);
    return out;
  }

  const html = await assetResponse.text();
  const md = htmlToMarkdown(html, request.url);
  const headers = new Headers(assetResponse.headers);
  headers.set('content-type', 'text/markdown; charset=utf-8');
  headers.set('x-markdown-tokens', String(estimateTokens(md)));
  headers.set('content-signal', CONTENT_SIGNAL);
  addVaryAccept(headers);
  // The body changed, so the HTML's validators and length no longer describe it.
  for (const h of ['content-length', 'content-encoding', 'etag', 'last-modified']) headers.delete(h);
  return new Response(request.method === 'HEAD' ? null : md, { status: assetResponse.status, headers });
}

// Rough, dependency-free: ~4 characters per token for English prose. It is an
// estimate and says so in no header, but that is what the header means anyway.
const estimateTokens = (s) => Math.ceil(s.length / 4);

/* ---- a tiny HTML parser ---- */

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const DROP = new Set(['script', 'style', 'template', 'svg', 'button', 'form', 'iframe', 'head', 'canvas', 'video', 'audio', 'select', 'textarea']);
const RAW = new Set(['script', 'style', 'textarea']);

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  middot: '·', mdash: '—', ndash: '–', hellip: '…', rarr: '→', larr: '←',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', times: '×', deg: '°',
  eacute: 'é', egrave: 'è', aacute: 'á', agrave: 'à', oacute: 'ó', uacute: 'ú',
  iacute: 'í', ccedil: 'ç', atilde: 'ã', otilde: 'õ', ntilde: 'ñ', copy: '©',
};
export function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(cp); } catch { return m; }
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function parseAttrs(src) {
  const attrs = {};
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(src))) attrs[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}

function parse(html) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+|<)/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) { top().children.push({ text: m[4] }); continue; }
    if (m[1]) {
      const name = m[1].toLowerCase();
      const i = stack.map((n) => n.tag).lastIndexOf(name);
      if (i > 0) stack.length = i; // close it and anything left open inside
      continue;
    }
    if (!m[2]) continue; // comment or doctype
    const tag = m[2].toLowerCase();
    // Implicitly close a sibling <li>/<p>/<dt>/<dd> the way browsers do.
    const cur = top().tag;
    if ((tag === 'li' && cur === 'li') || (tag === 'p' && cur === 'p') ||
        ((tag === 'dt' || tag === 'dd') && (cur === 'dt' || cur === 'dd'))) stack.pop();
    const node = { tag, attrs: parseAttrs(m[3] || ''), children: [] };
    top().children.push(node);
    if (RAW.has(tag)) {
      const end = html.toLowerCase().indexOf(`</${tag}`, re.lastIndex);
      re.lastIndex = end === -1 ? html.length : html.indexOf('>', end) + 1;
      continue;
    }
    if (!VOID.has(tag) && !/\/\s*$/.test(m[3] || '')) stack.push(node);
  }
  return root;
}

const find = (node, pred) => {
  if (pred(node)) return node;
  for (const c of node.children || []) { const f = find(c, pred); if (f) return f; }
  return null;
};
const findAll = (node, pred, out = []) => {
  if (pred(node)) out.push(node);
  for (const c of node.children || []) findAll(c, pred, out);
  return out;
};

/* ---- rendering ---- */

const BLOCK = new Set(['p', 'div', 'main', 'article', 'section', 'header', 'footer', 'nav', 'aside',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'blockquote', 'pre',
  'figure', 'figcaption', 'hr', 'table', 'noscript', 'body', '#root']);

const escapeMd = (s) => s.replace(/([\\`*_[\]])/g, '\\$1');

function absolute(href, base) {
  try {
    const u = new URL(href, base);
    return /^(https?|mailto):$/.test(u.protocol) ? u.href : null;
  } catch { return null; }
}

// Inline content → a single line with collapsed whitespace.
function inline(node, base) {
  if (node.text !== undefined) return escapeMd(decode(node.text).replace(/\s+/g, ' '));
  if (DROP.has(node.tag)) return '';
  const inner = () => node.children.map((c) => inline(c, base)).join('');
  switch (node.tag) {
    case 'br': return '\n';
    case 'img': {
      const alt = (node.attrs.alt || '').trim();
      const src = absolute(node.attrs.src || '', base);
      return alt && src ? `![${escapeMd(alt)}](${src})` : '';
    }
    case 'a': {
      const text = inner().replace(/\s+/g, ' ').trim();
      const href = absolute(node.attrs.href || '', base);
      if (!text) return '';
      return href ? `[${text}](${href})` : text;
    }
    case 'strong': case 'b': { const t = inner().trim(); return t ? `**${t}**` : ''; }
    case 'em': case 'i': { const t = inner().trim(); return t ? `*${t}*` : ''; }
    case 'code': { const t = decode(textOf(node)); return t ? `\`${t}\`` : ''; }
    default: {
      // A block tag met inside inline flow (a <p> inside an <li>, say): keep it
      // on the line, separated by a space.
      const t = inner();
      return BLOCK.has(node.tag) ? ` ${t} ` : t;
    }
  }
}
const textOf = (n) => (n.text !== undefined ? n.text : (n.children || []).map(textOf).join(''));
const tidy = (s) => s.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n').trim();

// Block content → an array of markdown blocks, joined later by blank lines.
function blocks(node, base, depth = 0) {
  const out = [];
  let run = [];
  const flush = () => {
    // A <br> survives as a newline; give it markdown's hard-break so the lines
    // do not rejoin into one paragraph.
    const t = tidy(run.map((c) => inline(c, base)).join(''));
    if (t) out.push(t.replace(/\n/g, '  \n'));
    run = [];
  };
  for (const c of node.children) {
    if (c.text !== undefined || !BLOCK.has(c.tag)) { run.push(c); continue; }
    flush();
    out.push(...block(c, base, depth));
  }
  flush();
  return out;
}

function block(node, base, depth) {
  const t = node.tag;
  if (/^h[1-6]$/.test(t)) {
    const text = tidy(inline({ tag: 'span', children: node.children }, base));
    return text ? [`${'#'.repeat(+t[1])} ${text}`] : [];
  }
  if (t === 'hr') return ['---'];
  if (t === 'ul' || t === 'ol') {
    const items = node.children.filter((c) => c.tag === 'li');
    const lines = items.map((li, i) => {
      const marker = t === 'ol' ? `${i + 1}.` : '-';
      const body = blocks(li, base, depth + 1).join('\n');
      const pad = ' '.repeat(marker.length + 1);
      return `${marker} ${body.split('\n').join(`\n${pad}`)}`;
    }).filter((l) => l.trim().length > 2);
    return lines.length ? [lines.join('\n')] : [];
  }
  if (t === 'dl') {
    const lines = [];
    for (const c of node.children) {
      if (c.tag === 'dt') lines.push(`**${tidy(inline({ tag: 'span', children: c.children }, base))}**`);
      else if (c.tag === 'dd') {
        const v = tidy(inline({ tag: 'span', children: c.children }, base));
        if (lines.length && lines[lines.length - 1].startsWith('**') && !lines[lines.length - 1].includes(':'))
          lines[lines.length - 1] += `: ${v}`;
        else lines.push(v);
      }
    }
    return lines.length ? [lines.map((l) => `- ${l}`).join('\n')] : [];
  }
  if (t === 'blockquote') return blocks(node, base, depth).map((b) => b.replace(/^/gm, '> '));
  if (t === 'pre') return ['```\n' + decode(textOf(node)).replace(/\n$/, '') + '\n```'];
  if (DROP.has(t)) return [];
  return blocks(node, base, depth);
}

const yamlString = (s) => JSON.stringify(s); // JSON strings are valid YAML scalars

export function htmlToMarkdown(html, url) {
  const doc = parse(html);
  const meta = (name) => {
    const n = find(doc, (x) => x.tag === 'meta' && (x.attrs.name === name || x.attrs.property === name));
    return n ? n.attrs.content : '';
  };
  const titleNode = find(doc, (x) => x.tag === 'title');
  const title = titleNode ? decode(textOf(titleNode)).trim() : '';
  const canon = find(doc, (x) => x.tag === 'link' && (x.attrs.rel || '').split(/\s+/).includes('canonical'));
  const source = (canon && canon.attrs.href) || url;

  const front = ['---'];
  if (title) front.push(`title: ${yamlString(title)}`);
  const description = meta('description');
  if (description) front.push(`description: ${yamlString(description)}`);
  front.push(`url: ${yamlString(source)}`);
  front.push('---');

  const body = find(doc, (x) => x.tag === 'body') || doc;
  // The home-link logo sits above every static page; it is chrome, not content.
  for (const back of findAll(body, (x) => x.tag === 'a' && /\bfg-back\b/.test(x.attrs.class || ''))) back.children = [];

  const md = blocks(body, source).join('\n\n');
  return `${front.join('\n')}\n\n${md}\n`;
}
