import assert from 'node:assert/strict';
import { test } from 'node:test';
import { todayInQuito, weekend, matchesDate, searchKey } from '../src/lib/dates.mjs';

test('the agenda follows the Quito calendar around UTC midnight', () => {
  assert.equal(todayInQuito(new Date('2026-11-09T04:59:00Z')), '2026-11-08');
  assert.equal(todayInQuito(new Date('2026-11-09T05:00:00Z')), '2026-11-09');
});

test('weekend filters respect Sunday and check individual sessions', () => {
  assert.deepEqual(weekend('2026-11-09'), ['2026-11-14', '2026-11-15']);
  assert.deepEqual(weekend('2026-11-15'), ['2026-11-14', '2026-11-15']);
  assert.equal(matchesDate(['2026-11-13', '2026-11-28'], 'weekend', '2026-11-09'), false);
  assert.equal(matchesDate(['2026-11-14'], 'weekend', '2026-11-15'), false);
  assert.equal(matchesDate(['2026-11-15'], 'weekend', '2026-11-15'), true);
  assert.equal(matchesDate(['2026-11-14', '2026-11-28'], 'past', '2026-11-15'), false);
});

test('artist and venue searches ignore accents and case', () => {
  assert.equal(searchKey('Paola Navarrete · Nicolás Dávila'), 'paola navarrete · nicolas davila');
});
