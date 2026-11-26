import { todayInQuito, timeInQuito } from './dates.mjs';

const moods = {
  Música: ['Una cita con banda sonora', 'Escuchar algo juntos y dejar que la conversación siga después.'],
  Escena: ['Teatro y conversación', 'Una función para compartir y una pausa para comentar lo que más les gustó.'],
  Arte: ['Mirar sin apuro', 'Un encuentro con el arte para descubrir qué le llama la atención a cada quien.'],
  Cine: ['Una película, mil temas', 'Cine para salir de la rutina y quedarse conversando un rato más.'],
  Talleres: ['Hacer algo juntos', 'Manos a la obra. Un plan para aprender, crear y llevarse un recuerdo.'],
  Patrimonio: ['Redescubrir la ciudad', 'Caminar, escuchar historias y mirar Quito con otros ojos.'],
};

export function availablePlanTime(date, times, today = todayInQuito(), time = timeInQuito()) {
  if (date < today) return undefined;
  return [...times].sort().find(start => date > today || start >= time);
}

export function makePlans(events, today = todayInQuito(), time = timeInQuito()) {
  return events
    .filter(event => event.data.status === 'scheduled')
    .flatMap(event => event.data.sessions
      .filter(session => availablePlanTime(session.date, session.times, today, time))
      .map(session => {
        const cost = event.data.access === 'free' ? 0 : event.data.priceAmount;
        const [title, description] = moods[event.data.category];
        return {
          event, date: session.date, times: session.times,
          time: availablePlanTime(session.date, session.times, today, time),
          cost: event.data.access === 'unknown' ? undefined : cost,
          title, description,
        };
      }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

export function planFits(cost, extras, people, budget) {
  return cost !== undefined && (cost + extras) * people <= budget;
}
