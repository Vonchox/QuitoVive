import { todayInQuito, timeInQuito } from './dates.mjs';

const moods = {
  Música: ['Una salida con música', 'Una salida para disfrutar en vivo y seguir conversando después.'],
  Escena: ['Teatro y paseo', 'Una función para compartir y comentar al salir.'],
  Arte: ['Un día entre arte y ciudad', 'Recorran una exposición y descubran rincones de Quito.'],
  Cine: ['Cine y buena compañía', 'Una película para salir de la rutina y conversar luego.'],
  Talleres: ['Crear algo juntos', 'Una actividad para aprender, crear y llevarse un recuerdo.'],
  Patrimonio: ['Quito con otros ojos', 'Caminen por la ciudad y conozcan sus historias.'],
};

const foodSpots = [
  { name: 'OMI Cafetería', url: 'https://maps.app.goo.gl/QvmsqeykSS3MXeFu6', note: 'Una pausa para café o algo ligero; revisa su ubicación y horarios antes de ir.' },
];

export function availablePlanTime(date, times, today = todayInQuito(), time = timeInQuito()) {
  if (date < today) return undefined;
  return [...times].sort().find(start => date > today || start >= time);
}

function prepareEvents(events, today, time) {
  return events
    .filter(event => event.data.status === 'scheduled')
    .flatMap(event => event.data.sessions.flatMap(session => {
      return [...new Set(session.times)].filter(start => availablePlanTime(session.date, [start], today, time))
        .map(start => ({ event, date: session.date, time: start, cost: event.data.access === 'unknown' ? undefined : event.data.access === 'free' ? 0 : event.data.priceAmount }));
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

function makeItinerary(items, date) {
  const first = items[0];
  const category = first.event.data.category;
  const [title, description] = moods[category] ?? ['Un día para descubrir Quito', 'Combina cultura, paseo y buena compañía.'];
  const costs = items.map(item => item.cost);
  const totalCost = costs.some(cost => cost === undefined) ? undefined : costs.reduce((sum, cost) => sum + cost, 0);
  const food = foodSpots[0];
  return {
    id: `${date}-${items.map(item => `${item.event.id}-${item.time}`).join('-')}`,
    title: items.length > 1 ? title : `${title} en Quito`,
    description,
    date,
    items,
    times: [items[0].time],
    time: items[0].time,
    cost: totalCost,
    food,
    venue: items.map(item => item.event.data.venue).join(' · '),
  };
}

export function makePlans(events, today = todayInQuito(), time = timeInQuito()) {
  const prepared = prepareEvents(events, today, time);
  const byDate = Map.groupBy(prepared, item => item.date);
  const plans = [];
  for (const [date, dayItems] of byDate) {
    // Suggest same-day combinations with enough time between activities; keep a single-event plan too.
    for (let start = 0; start < dayItems.length; start++) {
      const group = [dayItems[start]];
      for (let next = start + 1; next < dayItems.length && group.length < 3; next++) {
        const previous = group[group.length - 1];
        const gap = minutes(dayItems[next].time) - minutes(previous.time);
        const candidate = dayItems[next];
        if (gap >= 180 && period(candidate.time) !== period(previous.time)
          && !group.some(item => item.event.id === candidate.event.id)) group.push(candidate);
      }
      plans.push(makeItinerary(group, date));
    }
  }
  return plans.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

function minutes(value) {
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
}

function period(time) { return time < '12:00' ? 'morning' : time < '18:00' ? 'afternoon' : 'night'; }

export function planFits(cost, extras, people, budget) {
  return cost !== undefined && (cost + extras) * people <= budget;
}
