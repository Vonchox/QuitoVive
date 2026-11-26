import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCasaMusica, parseSucreEvent, sucreEventLinks } from '../scripts/scrape-sources.mjs';
import { mergeEvents } from '../scripts/scrape-lib.mjs';
import { eventAction } from '../src/lib/event-links.mjs';
import { robotsAllows } from '../scripts/fetch-source.mjs';

const page = 'https://teatrosucre.com/event/coro-vozandes/';
const record = {
  '@type': 'Event', name: 'Coro Vozandes', startDate: '2026-11-27T15:30:00-05:00',
  url: page, location: { name: 'Teatro Nacional Sucre' },
};
const json = value => '<script type="application/ld+json">' + JSON.stringify(value) + '</script>';
const html = json([record]) + `
  <div class="tribe-events-single">
    <div class="tribe-events-single-event-description">
      <p>Después de la compra no se aceptan cambios ni devoluciones.</p>
      <p>El Coro Vozandes presenta un recorrido por la música coral y las canciones tradicionales de Quito para compartir una tarde de concierto.</p>
    </div>
    <div class="tribe-events-event-image"><img src="https://cdn.teatrosucre.com/afiche.png" /></div>
    <a href="https://tickets.teatrosucre.com/ev/coro-vozandes">Comprar $20</a>
  </div>`;

test('official event extraction gets the performance time, description, poster and actual ticket link', () => {
  const event = parseSucreEvent(html, page, '2026-11-25');
  assert.equal(event.sessions[0].times[0], '15:30');
  assert.equal(event.priceAmount, 20);
  assert.match(event.description[0], /^El Coro/);
  assert.equal(event.description.length, 1);
  assert.equal(event.image.url, 'https://cdn.teatrosucre.com/afiche.png');
  assert.equal(eventAction(event).url, 'https://tickets.teatrosucre.com/ev/coro-vozandes');
  assert.throws(() => parseSucreEvent('<h1>Unavailable</h1>', page, '2026-11-25'));
  assert.deepEqual(sucreEventLinks(json([record]), '2026-11-25'), [page]);
});

test('the venue agenda preserves explicit service charges and excludes expired dates', () => {
  const card = date => `<article class="eventlist-event">
    <h1 class="eventlist-title">Concierto de Navidad</h1>
    <a class="eventlist-title-link" href="/programacion/navidad"></a>
    <time class="event-date" datetime="${date}"></time>
    <time class="event-time-24hr-start">19:00</time>
    <div class="eventlist-description"><div class="sqs-html-content">
      <p>Un concierto para compartir en familia con músicos invitados y un repertorio que recorre diferentes tradiciones de la temporada.</p>
      <p>Valor $15 + $1,75 de tarifa de servicio</p>
    </div><a href="https://boletos.casadelamusica.ec/ev/navidad">comprar</a></div>
    <img class="eventlist-thumbnail" data-src="https://images.squarespace-cdn.com/afiche.jpg">
  </article>`;
  const events = parseCasaMusica(card('2026-12-12') + card('2026-10-01'), '2026-11-25');
  assert.equal(events.length, 1);
  assert.equal(events[0].priceAmount, 16.75);
  assert.match(events[0].tickets, /boletos.casadelamusica/);
  assert.equal(events[0].image.credit, 'Casa de la Música');
  const separatedPrice = card('2026-12-12').replace('Valor $15 + $1,75 de tarifa de servicio', '<strong>Valor $25</strong><br><strong>20h00</strong>');
  assert.equal(parseCasaMusica(separatedPrice, '2026-11-25')[0].priceAmount, 25);
});

test('sources and news articles are never presented as a ticket purchase action', () => {
  const reporter = 'https://ecuadorchequea.com/agenda/';
  assert.equal(eventAction({ tickets: reporter, venue: 'Teatro Nacional Sucre' }).url, 'https://teatrosucre.com/');
  assert.equal(eventAction({ tickets: reporter, venue: 'Lugar por confirmar' }), undefined);
});

test('official enrichment retains the original URL and keeps separate performances on the same date', () => {
  const first = parseSucreEvent(html, page, '2026-11-25');
  const legacy = { ...first, id: 'original', imported: 'visitquito', image: undefined, description: undefined };
  const second = { ...first, id: 'second', sessions: [{ date: '2026-11-27', times: ['18:30'] }], tickets: first.tickets + '-2' };
  const merged = mergeEvents([legacy], [first, second]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, 'original');
  assert.ok(merged[0].image);
  assert.equal(merged[0].imported, 'teatrosucre');
  const moved = { ...first, sessions: [{ date: '2026-11-29', times: ['15:30'] }] };
  const updated = mergeEvents([merged[0]], [moved]);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].id, 'original');
  assert.equal(updated[0].sessions[0].date, '2026-11-29');
});

test('robots rules honor grouped user agents and source-specific exclusions', () => {
  assert.equal(robotsAllows('User-agent: SomeBot\nUser-agent: *\nDisallow: /api/\n', new URL('https://example.com/api/events')), false);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /\nUser-agent: QuitoVive\nAllow: /events/\n', new URL('https://example.com/events/')), true);
});
