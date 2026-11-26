import { readFile, writeFile, rename } from 'node:fs/promises';
import { AGENDA_URL, parseVisitQuito, parsePriceTable, enrichPrice, mergeEvents } from './scrape-lib.mjs';
import { todayInQuito } from '../src/lib/dates.mjs';

const eventFile = new URL('../src/content/events.json', import.meta.url);
const statusFile = new URL('../src/content/scrape-status.json', import.meta.url);
const userAgent = 'QuitoVive/1.0 (+https://github.com/Vonchox/QuitoVive)';
const cache = new Map();

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': userAgent, Accept: 'text/html,text/plain' },
    signal: AbortSignal.timeout(25000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('HTTP ' + response.status + ' en ' + url);
  const body = await response.text();
  if (body.length > 4_000_000) throw new Error('La página supera el tamaño esperado.');
  return body;
}

async function allowedHtml(url) {
  const target = new URL(url);
  if (!['visitquito.ec', 'ecuadorchequea.com'].includes(target.hostname)) {
    throw new Error('La fuente no está autorizada en el scraper.');
  }
  if (!cache.has(target.origin)) {
    const robots = await fetchText(target.origin + '/robots.txt');
    let applies = false;
    const rules = [];
    for (const raw of robots.split(/\r?\n/)) {
      const line = raw.replace(/#.*$/, '').trim();
      const split = line.indexOf(':');
      if (split < 0) continue;
      const field = line.slice(0, split).toLowerCase();
      const value = line.slice(split + 1).trim();
      if (field === 'user-agent') {
        applies = value === '*' || value.toLowerCase() === 'quitovive';
      } else if (applies && ['allow', 'disallow'].includes(field) && value) {
        rules.push({ allow: field === 'allow', path: value });
      }
    }
    cache.set(target.origin, rules);
  }
  const rules = cache.get(target.origin).filter(rule => {
    const escaped = rule.path.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + escaped).test(target.pathname + target.search);
  }).sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  if (rules.length && !rules[0].allow) throw new Error('robots.txt excluye ' + url);
  return fetchText(url);
}

async function atomicJson(url, value) {
  const temporary = new URL(url.href + '.tmp');
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
  await rename(temporary, url);
}

const checked = todayInQuito();
let previous = {};
try { previous = JSON.parse(await readFile(statusFile, 'utf8')); } catch {}
const report = { lastAttempt: checked, lastSuccess: previous.lastSuccess ?? null, status: 'failed', source: AGENDA_URL };
try {
  const existing = JSON.parse(await readFile(eventFile, 'utf8'));
  const { events, skipped, total } = parseVisitQuito(await allowedHtml(AGENDA_URL), checked);
  const pricePages = [...new Set(events.map(event => event.tickets).filter(url =>
    url?.startsWith('https://ecuadorchequea.com/') && !new URL(url).search))].slice(0, 3);
  const prices = new Map();
  const warnings = [];
  for (const url of pricePages) {
    try {
      const html = await allowedHtml(url);
      prices.set(url, html);
    } catch (error) { warnings.push(error.message); }
  }
  const enriched = events.map(event => {
    const html = prices.get(event.tickets);
    return html ? enrichPrice(event, parsePriceTable(html, event.sessions[0].date), event.tickets) : event;
  });
  const merged = mergeEvents(existing, enriched);
  await atomicJson(eventFile, merged);
  Object.assign(report, { lastSuccess: checked, status: warnings.length ? 'partial' : 'ok', discovered: total, accepted: events.length, skipped, warnings });
  await atomicJson(statusFile, report);
  console.log(`Agenda actualizada: ${events.length} registros leídos, ${merged.length} fichas conservadas.`);
} catch (error) {
  await atomicJson(statusFile, { ...report, message: error.message });
  console.error('Se conserva el catálogo anterior. ' + error.message);
  process.exitCode = 1;
}
