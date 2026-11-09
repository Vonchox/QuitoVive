const quito = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit',
});
const spanish = new Intl.DateTimeFormat('es-EC', {
  timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
});

export function todayInQuito(now = new Date()) {
  const parts = Object.fromEntries(quito.formatToParts(now).map(({ type, value }) => [type, value]));
  return [parts.year, parts.month, parts.day].join('-');
}

export function weekend(today) {
  const saturday = new Date(today + 'T00:00:00Z');
  const day = saturday.getUTCDay();
  saturday.setUTCDate(saturday.getUTCDate() + (day === 0 ? -1 : 6 - day));
  const start = saturday.toISOString().slice(0, 10);
  saturday.setUTCDate(saturday.getUTCDate() + 1);
  return [start, saturday.toISOString().slice(0, 10)];
}

export function matchesDate(dates, filter, today) {
  if (filter === 'all') return true;
  if (filter === 'today') return dates.includes(today);
  if (filter === 'past') return dates.every(date => date < today);
  if (filter === 'weekend') {
    const [start, end] = weekend(today);
    return dates.some(date => date >= today && date >= start && date <= end);
  }
  return dates.some(date => date >= today);
}

export function formatDate(date) {
  return spanish.format(new Date(date + 'T00:00:00Z'));
}

export function searchKey(value) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
