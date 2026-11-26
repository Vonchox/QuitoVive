import { load } from 'cheerio';
import { eventSchema } from '../src/lib/event-schema.mjs';
import { todayInQuito, timeInQuito } from '../src/lib/dates.mjs';
import { isBookingUrl } from '../src/lib/event-links.mjs';
import { plain, categoryFor } from './scrape-lib.mjs';

export const CASA_URL = 'https://www.casadelamusica.ec/programacion';
export const SUCRE_URL = 'https://teatrosucre.com/';

function absolute(value, page) {
  try {
    const url = new URL(value, page);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

function excerpt(paragraphs) {
  let remaining = 110;
  const result = [];
  for (const paragraph of paragraphs) {
    const text = plain(paragraph);
    if (text.length < 65 || /preventa|descuento|devoluciones|preferimos diners/i.test(text) || /^(valor |sala de )/i.test(text)) continue;
    const words = text.split(/\s+/);
    const part = words.slice(0, remaining).join(' ');
    if (part && !result.includes(part)) result.push(part + (words.length > remaining ? '…' : ''));
    remaining -= Math.min(words.length, remaining);
    if (!remaining || result.length === 2) break;
  }
  return result.length ? result : undefined;
}

function poster(url, page, title, credit) {
  const image = absolute(url, page);
  if (!image || /logo|favicon|logoland/i.test(image) || !/\.(png|jpe?g|webp)(?:\?|$)/i.test(image)) return undefined;
  return { url: image, alt: 'Afiche de ' + title, credit, source: page };
}

function booking($, root, page) {
  return root.find('a[href]').toArray().map(element => ({
    url: absolute($(element).attr('href'), page),
    label: plain($(element).text()),
  })).find(link => isBookingUrl(link.url) && /comprar|entradas?|boletos?|pases?|reservar/i.test(link.label));
}

function pricing(text) {
  const line = plain(text);
  if (/^(gratuito|gratis|entrada libre|acceso libre)$/i.test(line)) return { access: 'free', priceAmount: 0 };
  const prices = [...line.matchAll(/(?:\$|USD\s*)(\d+(?:[.,]\d{1,2})?)/gi)].map(match => Number(match[1].replace(',', '.')));
  if (!prices.length) return { access: 'unknown' };
  const fee = line.match(/\+\s*\$(\d+(?:[.,]\d{1,2})?)\s*(?:de )?tarifa/i);
  const amount = prices.length === 1 ? prices[0] : prices.length === 2 && fee ? prices[0] + Number(fee[1].replace(',', '.')) : undefined;
  return {
    access: amount === 0 ? 'free' : 'paid', price: amount === undefined ? line.replace(/^comprar\s*/i, '').slice(0, 300) : amount === 0 ? undefined : 'USD ' + (Math.round(amount * 100) / 100).toFixed(2) + (fee ? ' (incluye tarifa de servicio)' : ''),
    priceAmount: amount === undefined ? undefined : Math.round(amount * 100) / 100,
  };
}

function upcoming(date, checked) {
  const limit = new Date(checked + 'T12:00:00Z');
  limit.setUTCDate(limit.getUTCDate() + 100);
  return date >= checked && date <= limit.toISOString().slice(0, 10);
}

export function parseCasaMusica(html, checked) {
  const $ = load(html);
  const records = $('.eventlist-event');
  if (!records.length) throw new Error('Casa de la Música cambió su programación.');
  const events = [];
  records.each((_, element) => {
    const root = $(element);
    const date = root.find('time.event-date').attr('datetime');
    if (!date || !upcoming(date, checked)) return;
    const title = plain(root.find('.eventlist-title').text());
    const website = absolute(root.find('.eventlist-title-link').attr('href'), CASA_URL);
    if (!website || !title) return;
    const time = plain(root.find('.event-time-24hr-start').first().text());
    const paragraphs = root.find('.eventlist-description .sqs-html-content p').toArray().map(p => {
      const copy = $(p).clone();
      copy.find('br').replaceWith(' ');
      return copy.text();
    });
    const description = excerpt(paragraphs);
    const priceParagraph = paragraphs.find(p => /valor|precio|entrada libre|acceso libre|gratuito/i.test(p));
    const priceLine = plain(priceParagraph ?? '').split(/PREFERIMOS|\*Descuento|\*No se aceptan/i)[0].replace(/^Sala de Conciertos\s*\d{1,2}h\d{2}\s*/i, '');
    const purchase = booking($, root, website);
    const art = categoryFor({ artist: title, tour: description?.join(' ') ?? '', category: 'concierto o tour' });
    const data = eventSchema.parse({
      title, category: art, summary: (art === 'Escena' ? 'Una función' : art === 'Talleres' ? 'Un encuentro para aprender' : 'Música en vivo') + ' en la Casa de la Música.',
      description, venue: 'Casa de la Música', organizer: 'Casa de la Música',
      sessions: [{ date, times: /^\d{2}:\d{2}$/.test(time) ? [time] : [] }],
      ...pricing(priceLine), priceSource: priceLine ? website : undefined,
      image: poster(root.find('img.eventlist-thumbnail').attr('data-src'), website, title, 'Casa de la Música'),
      tickets: purchase?.url, website,
      source: { name: 'Casa de la Música · Programación', url: CASA_URL, checked },
      contentSource: { name: 'Casa de la Música', url: website, checked },
      imported: 'casamusica',
    });
    events.push({ id: 'casamusica-' + new URL(website).pathname.split('/').filter(Boolean).at(-1), ...data });
  });
  return events;
}

export function structuredEvents(html) {
  const $ = load(html);
  const records = [];
  function visit(value) {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    const types = [value['@type']].flat();
    if (types.some(type => typeof type === 'string' && /Event$/.test(type))) records.push(value);
    if (value['@graph']) visit(value['@graph']);
  }
  $('script[type="application/ld+json"]').each((_, element) => {
    try { visit(JSON.parse($(element).text())); } catch {}
  });
  return records;
}

export function sucreEventLinks(html, checked) {
  const records = structuredEvents(html);
  if (!records.length) throw new Error('Teatro Sucre cambió el formato de su agenda.');
  return [...new Set(records.filter(event =>
    upcoming(String(event.startDate).slice(0, 10), checked) && event.location?.name)
    .map(event => absolute(event.url, SUCRE_URL)).filter(url =>
      url && new URL(url).hostname === 'teatrosucre.com' && new URL(url).pathname.startsWith('/event/')))].slice(0, 20);
}

export function parseSucreEvent(html, page, checked) {
  const event = structuredEvents(html).find(event =>
    absolute(event.url, page)?.replace(/\/$/, '') === page.replace(/\/$/, ''));
  if (!event?.location?.name || !event.startDate) throw new Error('El evento no tiene lugar o fecha estructurada.');
  const stamp = new Date(event.startDate);
  if (!Number.isFinite(stamp.getTime())) throw new Error('Fecha de función inválida.');
  const $ = load(html);
  const root = $('.tribe-events-single').first();
  const descriptionRoot = $('.tribe-events-single-event-description').first();
  const description = excerpt(descriptionRoot.find('p').toArray().map(p => $(p).text()));
  const title = plain(event.name);
  const purchase = booking($, root.length ? root : descriptionRoot.parent(), page);
  const priceText = purchase?.label ?? plain($('.tribe-events-schedule .tribe-events-cost').first().text());
  const category = categoryFor({ artist: title, tour: description?.join(' ') ?? '', category: plain($('.tribe-events-event-categories').text()) });
  const data = eventSchema.parse({
    title, category, summary: category + ' en ' + plain(event.location.name) + '.',
    description, venue: plain(event.location.name), organizer: plain(event.organizer?.name || 'Fundación Teatro Nacional Sucre'),
    sessions: [{ date: todayInQuito(stamp), times: [timeInQuito(stamp)] }],
    ...pricing(priceText), priceSource: page,
    image: poster($('.tribe-events-event-image img').first().attr('src') ?? [event.image].flat()[0], page, title, 'Fundación Teatro Nacional Sucre'),
    tickets: purchase?.url, website: page,
    source: { name: 'Fundación Teatro Nacional Sucre', url: SUCRE_URL, checked },
    contentSource: { name: 'Fundación Teatro Nacional Sucre', url: page, checked },
    status: /EventCancelled/.test(event.eventStatus) ? 'cancelled' : /EventPostponed/.test(event.eventStatus) ? 'postponed' : 'scheduled',
    imported: 'teatrosucre',
  });
  return { id: 'teatrosucre-' + new URL(page).pathname.split('/').filter(Boolean).at(-1), ...data };
}

