const hosts = new Set(['visitquito.ec', 'ecuadorchequea.com', 'teatrosucre.com', 'www.teatrosucre.com', 'www.casadelamusica.ec', 'casadelamusica.ec']);
const agent = 'QuitoVive/1.0 (+https://github.com/Vonchox/QuitoVive)';

export function robotsAllows(text, url) {
  const groups = [];
  let group = { agents: [], rules: [] };
  let hasRules = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const split = line.indexOf(':');
    if (split < 0) continue;
    const field = line.slice(0, split).toLowerCase();
    const value = line.slice(split + 1).trim();
    if (field === 'user-agent') {
      if (hasRules) { groups.push(group); group = { agents: [], rules: [] }; hasRules = false; }
      group.agents.push(value.toLowerCase());
    } else if (['allow', 'disallow'].includes(field)) {
      hasRules = true;
      if (value) group.rules.push({ allow: field === 'allow', path: value });
    }
  }
  groups.push(group);
  const specific = groups.filter(group => group.agents.includes('quitovive'));
  const effective = specific.length ? specific : groups.filter(group => group.agents.includes('*'));
  const rules = effective.flatMap(group => group.rules).filter(rule => {
    const escaped = rule.path.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + escaped).test(url.pathname + url.search);
  }).sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return !rules.length || rules[0].allow;
}

export function sourceFetcher() {
  const robots = new Map();
  const pages = new Map();
  const lastRequest = new Map();
  let requests = 0;

  function allowed(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.port || url.username || url.password || !hosts.has(url.hostname)) {
      throw new Error('Fuente fuera del catálogo autorizado.');
    }
    return url;
  }

  async function request(value) {
    const url = allowed(value);
    if (++requests > 55) throw new Error('Se alcanzó el límite de consultas de esta ejecución.');
    const wait = 400 - (Date.now() - (lastRequest.get(url.origin) ?? 0));
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    lastRequest.set(url.origin, Date.now());
    return fetch(url, {
      headers: { 'User-Agent': agent, Accept: 'text/html,text/plain' },
      signal: AbortSignal.timeout(15000), redirect: 'manual',
    });
  }

  async function body(response, url) {
    if (!response.ok) throw new Error('HTTP ' + response.status + ' en ' + url);
    const text = await response.text();
    if (text.length > 4_000_000) throw new Error('La página supera el tamaño esperado.');
    return text;
  }

  async function robotText(origin) {
    if (robots.has(origin)) return robots.get(origin);
    let url = origin + '/robots.txt';
    let response = await request(url);
    if ([301, 302, 307, 308].includes(response.status)) {
      url = allowed(new URL(response.headers.get('location'), url).href).href;
      if (new URL(url).pathname !== '/robots.txt') throw new Error('Redirección de robots.txt inesperada.');
      response = await request(url);
    }
    const text = response.status === 404 ? '' : await body(response, url);
    robots.set(origin, text);
    return text;
  }

  async function get(value, redirects = 0) {
    const url = allowed(value);
    if (!robotsAllows(await robotText(url.origin), url)) throw new Error('robots.txt excluye ' + url);
    const response = await request(url);
    if ([301, 302, 307, 308].includes(response.status)) {
      if (redirects >= 2) throw new Error('Demasiadas redirecciones de la fuente.');
      return get(allowed(new URL(response.headers.get('location'), url).href).href, redirects + 1);
    }
    return body(response, url);
  }

  return value => {
    if (!pages.has(value)) pages.set(value, get(value));
    return pages.get(value);
  };
}
