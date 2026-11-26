import { readFile, writeFile, rename } from 'node:fs/promises';
import { AGENDA_URL, parseVisitQuito, parsePriceTable, enrichPrice, mergeEvents } from './scrape-lib.mjs';
import { CASA_URL, SUCRE_URL, parseCasaMusica, sucreEventLinks, parseSucreEvent } from './scrape-sources.mjs';
import { sourceFetcher } from './fetch-source.mjs';
import { todayInQuito } from '../src/lib/dates.mjs';
import { isBookingUrl, isOrganizerUrl, venueWebsite } from '../src/lib/event-links.mjs';

const eventFile = new URL('../src/content/events.json', import.meta.url);
const statusFile = new URL('../src/content/scrape-status.json', import.meta.url);
const get = sourceFetcher();
const checked = todayInQuito();
const warnings = [];
const sources = [];
let previous = {};
try { previous = JSON.parse(await readFile(statusFile, 'utf8')); } catch {}

async function atomicJson(url, value) {
  const temporary = new URL(url.href + '.tmp');
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
  await rename(temporary, url);
}

async function visitEvents() {
  const result = parseVisitQuito(await get(AGENDA_URL), checked);
  const pages = [...new Set(result.events.map(event => event.referenceUrl)
    .filter(url => url?.startsWith('https://ecuadorchequea.com/') && !new URL(url).search))].slice(0, 3);
  const prices = new Map();
  for (const url of pages) {
    try { prices.set(url, await get(url)); } catch (error) { warnings.push(error.message); }
  }
  return result.events.map(event => {
    const html = prices.get(event.referenceUrl);
    return html ? enrichPrice(event, parsePriceTable(html, event.sessions[0].date), event.referenceUrl) : event;
  });
}

async function sucreEvents() {
  const links = sucreEventLinks(await get(SUCRE_URL), checked);
  const events = [];
  for (const url of links) {
    try { events.push(parseSucreEvent(await get(url), url, checked)); }
    catch (error) { warnings.push(error.message); }
  }
  if (links.length && !events.length) throw new Error('No se pudo consultar ninguna ficha del Teatro Sucre.');
  return events;
}

function directActions(event) {
  const oldLink = event.tickets;
  return {
    ...event,
    tickets: isBookingUrl(oldLink) ? oldLink : undefined,
    website: isOrganizerUrl(event.website) ? event.website : isOrganizerUrl(oldLink) ? oldLink : venueWebsite(event.venue),
    referenceUrl: event.referenceUrl ?? (oldLink && !isBookingUrl(oldLink) && !isOrganizerUrl(oldLink) ? oldLink : undefined),
  };
}

try {
  const existing = JSON.parse(await readFile(eventFile, 'utf8'));
  const incoming = [];
  const providers = [
    { id: 'visitquito', name: 'Visit Quito', url: AGENDA_URL, read: visitEvents },
    { id: 'casamusica', name: 'Casa de la Música', url: CASA_URL, read: async () => parseCasaMusica(await get(CASA_URL), checked) },
    { id: 'teatrosucre', name: 'Fundación Teatro Nacional Sucre', url: SUCRE_URL, read: sucreEvents },
  ];
  for (const provider of providers) {
    const prior = previous.sources?.find(source => source.id === provider.id);
    try {
      const warningCount = warnings.length;
      const events = await provider.read();
      incoming.push(...events);
      sources.push({ id: provider.id, name: provider.name, url: provider.url, status: warnings.length > warningCount ? 'partial' : 'ok', count: events.length, lastSuccess: checked });
    } catch (error) {
      warnings.push(error.message);
      sources.push({ id: provider.id, name: provider.name, url: provider.url, status: 'failed', count: 0, lastSuccess: prior?.lastSuccess ?? null });
    }
  }
  if (sources.every(source => source.status === 'failed')) throw new Error('No respondió ninguna agenda.');
  const merged = mergeEvents(existing, incoming).map(directActions);
  await atomicJson(eventFile, merged);
  await atomicJson(statusFile, {
    lastAttempt: checked, lastSuccess: checked, status: warnings.length ? 'partial' : 'ok',
    source: AGENDA_URL, sources, discovered: incoming.length,
    withImages: merged.filter(event => event.image).length,
    withDescriptions: merged.filter(event => event.description?.length).length,
    warnings,
  });
  console.log('Agenda actualizada: ' + incoming.length + ' registros leídos, ' + merged.length + ' fichas conservadas.');
  for (const source of sources) console.log(source.name + ': ' + source.status + ', ' + source.count + ' eventos.');
} catch (error) {
  await atomicJson(statusFile, {
    ...previous, lastAttempt: checked, status: 'failed', sources,
    message: error.message, warnings,
  });
  console.error('Se conserva el catálogo anterior. ' + error.message);
  process.exitCode = 1;
}
