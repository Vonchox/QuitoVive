import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVisitQuito, parsePriceTable, enrichPrice, mergeEvents } from '../scripts/scrape-lib.mjs';
import { makePlans, planFits, availablePlanTime } from '../src/lib/plans.mjs';

const record = {
  id: 'evt-2026-0279', date: '2026-11-27', endDate: '2026-11-27', time: '17:00-20:00',
  artist: 'Resonancia 8.0', tour: 'Encuentro artístico y cultural.',
  venue: 'Centro Cultural Metropolitano', category: 'actividad cultural',
  source: 'https://ecuadorchequea.com/que-actividades-puedes-hacer-en-quito-en-noviembre/',
};
const document = items => '<script>window.QT_AGENDA_DATA = ' + JSON.stringify(items) + ';</script>';
const parse = items => parseVisitQuito(document(items), '2026-11-25').events;

test('scraping extracts data without executing source scripts or treating an end time as a second function', () => {
  const html = document([record]) + '<script>throw new Error("Do not execute");</script>';
  const event = parseVisitQuito(html, '2026-11-25').events[0];
  assert.deepEqual(event.sessions, [{ date: '2026-11-27', times: ['17:00'] }]);
  assert.equal(event.access, 'unknown');
  assert.equal(event.capacity, undefined);
});

test('a changed or empty source and invalid dates cannot replace the catalog', () => {
  assert.throws(() => parseVisitQuito('<h1>Unavailable</h1>', '2026-11-25'));
  assert.throws(() => parse([]));
  assert.throws(() => parse([{ ...record, date: '2026-02-31' }]));
});

test('a date range is held back rather than inventing daily performances', () => {
  const data = [record, { ...record, id: 'multi', endDate: '2026-11-29' }];
  assert.deepEqual(parseVisitQuito(document(data), '2026-11-25').skipped, ['multi']);
});

test('price extraction requires matching title, date and article month/year', () => {
  const html = '<article><h1>Agenda noviembre 2026</h1><table><tr><td>Vie. 27</td><td>17:00</td><td>Resonancia 8.0. Centro Cultural Metropolitano</td><td>Gratis</td></tr></table></article>';
  const event = parse([record])[0];
  const rows = parsePriceTable(html, '2026-11-27');
  assert.equal(enrichPrice(event, rows, record.source).priceAmount, 0);
  assert.equal(enrichPrice({ ...event, title: 'Otro evento' }, rows, record.source).access, 'unknown');
  assert.equal(parsePriceTable(html, '2026-12-27').length, 0);
});

test('merging preserves editorial changes, older URLs and makes repeated imports idempotent', () => {
  const incoming = parse([record])[0];
  const manual = { ...incoming, id: 'editorial', imported: undefined, summary: 'Texto revisado', priceAmount: 0, access: 'free' };
  assert.deepEqual(mergeEvents([manual], [incoming]), [manual]);
  const once = mergeEvents([], [incoming]);
  assert.equal(JSON.stringify(mergeEvents(once, [incoming])), JSON.stringify(once));
  assert.deepEqual(mergeEvents(once, []), once);
});

test('plans exclude cancelled and past events and treat unconfirmed cost as unknown', () => {
  const data = parse([record])[0];
  const events = [
    { id: 'active', data },
    { id: 'cancelled', data: { ...data, status: 'cancelled' } },
    { id: 'past', data: { ...data, sessions: [{ date: '2026-11-01', times: ['17:00'] }] } },
  ];
  const plans = makePlans(events, '2026-11-25');
  assert.equal(plans.length, 1);
  assert.equal(plans[0].cost, undefined);
  assert.equal(planFits(undefined, 0, 2, 100), false);
  assert.equal(planFits(4, 3, 2, 14), true);
  assert.equal(planFits(4, 3, 2, 13), false);
});

test('a plan selects the next session and hides sessions that already started today', () => {
  assert.equal(availablePlanTime('2026-11-25', ['11:00', '15:00'], '2026-11-25', '13:00'), '15:00');
  assert.equal(availablePlanTime('2026-11-25', ['11:00'], '2026-11-25', '13:00'), undefined);
});
