import { load } from 'cheerio';
import { eventSchema } from '../src/lib/event-schema.mjs';
import { searchKey } from '../src/lib/dates.mjs';
import { isBookingUrl, isOrganizerUrl, venueWebsite } from '../src/lib/event-links.mjs';

export const AGENDA_URL = 'https://visitquito.ec/es/eventos/';

export function plain(value) {
  return load(String(value ?? ''), null, false).text().replace(/\s+/g, ' ').trim();
}

export function key(value) {
  return searchKey(value).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function categoryFor(item) {
  const words = key(item.artist + ' ' + item.tour);
  if (/cine|pelicula|documental/.test(words)) return 'Cine';
  if (/taller|origami|tejido|clase magistral/.test(words)) return 'Talleres';
  if (/exposicion|galeria/.test(words)) return 'Arte';
  if (/danza|ballet|cascanueces|opera|presentacion escenica/.test(words)) return 'Escena';
  if (/concierto|coro |musica|rock|jazz|concierto o tour/.test(words + ' ' + item.category)) return 'Música';
  if (/teatro|escen/.test(words + ' ' + item.category)) return 'Escena';
  return /patrimonio|recorrido|ruta|desfile/.test(words) ? 'Patrimonio' : 'Arte';
}

export function parseVisitQuito(html, checked) {
  const $ = load(html);
  const script = $('script').toArray().map(element => $(element).text())
    .find(text => text.includes('window.QT_AGENDA_DATA'));
  const match = script?.match(/window\.QT_AGENDA_DATA\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error('Visit Quito cambió el formato de la agenda.');
  // Parse data only. Source scripts are never executed.
  const items = JSON.parse(match[1]);
  if (!Array.isArray(items) || items.length === 0 || items.length > 1000) {
    throw new Error('La agenda está vacía o fuera del tamaño esperado.');
  }
  const events = [];
  const skipped = [];
  for (const item of items) {
    const words = key([item.artist, item.venue, item.tour].join(' '));
    if (!/concierto|cultural|escen|festival|feria|ruta|taller|exposici|cine/.test(key(item.category))
      || /cerveceria|restobar|\bbar\b|canelazo|discoteca|fiesta electronica|cuarentazo|apuesta|\brun\b|maraton/.test(words)
      || !item.venue || key(item.venue) === 'quito'
      || (item.endDate && item.endDate !== item.date)) {
      skipped.push(item.id);
      continue;
    }
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(item.id)) throw new Error('ID de evento inválido.');
    const start = String(item.time ?? '').match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    const data = eventSchema.parse({
      title: plain(item.artist),
      summary: plain(item.tour || item.artist).slice(0, 600),
      category: categoryFor(item),
      venue: plain(item.venue),
      organizer: 'Por confirmar',
      sessions: [{ date: item.date, times: start ? [start[1].padStart(2, '0') + ':' + start[2]] : [] }],
      artists: [],
      access: 'unknown',
      accessNote: 'Consulta precios, edad de ingreso y disponibilidad en la publicación original.',
      source: { name: 'Visit Quito · Agenda de eventos', url: AGENDA_URL, checked },
      referenceUrl: typeof item.source === 'string' && item.source.startsWith('https://') ? item.source : undefined,
      tickets: isBookingUrl(item.source) ? item.source : undefined,
      website: isOrganizerUrl(item.source) ? item.source : venueWebsite(plain(item.venue)),
      imported: 'visitquito',
    });
    events.push({ id: 'visitquito-' + item.id, ...data });
  }
  if (!events.length) throw new Error('La fuente no contiene eventos culturales utilizables.');
  return { events, skipped, total: items.length };
}

export function parsePriceTable(html, date) {
  const $ = load(html);
  // Only use a table when the article explicitly identifies the agenda month/year.
  const heading = key($('h1').text() + ' ' + $('article').text().slice(0, 2500));
  const month = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][Number(date.slice(5, 7)) - 1];
  if (!heading.includes(month) || !heading.includes(date.slice(0, 4))) return [];
  const rows = [];
  $('table tr').each((_, row) => {
    const cells = $(row).find('td').toArray().map(cell => plain($(cell).text()));
    if (cells.length !== 4 || !/\d/.test(cells[0])) return;
    const day = cells[0].match(/\d{1,2}/)?.[0].padStart(2, '0');
    const amount = cells[3].match(/USD\s*(\d+(?:[.,]\d{1,2})?)/i);
    const free = /^gratis\b/i.test(cells[3]);
    if (!free && !amount) return;
    rows.push({
      date: date.slice(0, 8) + day,
      titleAndVenue: key(cells[2]),
      amount: free ? 0 : Number(amount[1].replace(',', '.')),
      note: cells[3],
    });
  });
  return rows;
}

export function enrichPrice(event, rows, sourceUrl) {
  const title = key(event.title).replace(/ segunda funcion$/, '');
  const venue = key(event.venue).replace(/ ernesto alban$/, '');
  const row = rows.find(row => row.date === event.sessions[0].date
    && row.titleAndVenue.includes(title) && row.titleAndVenue.includes(venue));
  if (!row) return event;
  return {
    ...event, access: row.amount === 0 ? 'free' : 'paid',
    price: row.amount === 0 ? undefined : 'USD ' + row.amount,
    priceAmount: row.amount, priceSource: sourceUrl,
    accessNote: row.note,
  };
}

function overlaps(a, b) {
  const normalizeName = value => key(value).replace(/^(primera|segunda|tercera|cuarta) funcion\s+/, '').replace(/\s+(primera|segunda|tercera|cuarta) funcion$/, '');
  const normalizeVenue = value => key(value).replace(/ ernesto alban$/, '').replace(/^teatro sucre$/, 'teatro nacional sucre');
  const nameA = normalizeName(a.title);
  const nameB = normalizeName(b.title);
  const sameName = nameA === nameB;
  const sameDetail = a.tickets && a.tickets === b.tickets && /\/(event|evento)\//.test(a.tickets);
  return (sameName || sameDetail)
    && normalizeVenue(a.venue) === normalizeVenue(b.venue)
    && a.sessions.some(session => b.sessions.some(other => other.date === session.date
      && (!session.times.length || !other.times.length || session.times.some(time => other.times.includes(time)))));
}

export function mergeEvents(existing, incoming) {
  const result = [...existing];
  const rank = event => event.imported === 'visitquito' ? 1 : event.imported ? 2 : 3;
  for (const event of incoming) {
    const index = result.findIndex(other => other.id === event.id || other.upstreamIds?.includes(event.id) || overlaps(other, event));
    if (index < 0) { result.push(event); continue; }
    const previous = result[index];
    if (!previous.imported) {
      // Add official media and actions while preserving editorial text and dates.
      if (event.contentSource && rank(event) === 2) result[index] = {
        ...previous,
        description: previous.description ?? event.description,
        image: previous.image ?? event.image,
        tickets: event.tickets ?? previous.tickets,
        website: event.website ?? previous.website,
        contentSource: event.contentSource,
      };
      continue;
    }
    if (rank(previous) > rank(event)) continue;
    const upstreamIds = [...new Set([...(previous.upstreamIds ?? []), event.id])].filter(id => id !== previous.id);
    result[index] = {
      ...previous, ...event, id: previous.id,
      upstreamIds: upstreamIds.length ? upstreamIds : undefined,
    };
  }
  const ids = result.map(event => event.id);
  if (new Set(ids).size !== ids.length) throw new Error('Hay IDs duplicados.');
  for (const event of result) eventSchema.parse(event);
  return result;
}
