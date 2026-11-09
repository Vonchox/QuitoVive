import { getCollection, type CollectionEntry } from 'astro:content';

export const categories = ['Música', 'Escena', 'Arte', 'Cine', 'Talleres', 'Patrimonio'];
export const accessLabel = { free: 'Gratis', paid: 'Con entrada', unknown: 'Acceso por confirmar' };
export const statusLabel = { scheduled: 'Programado', cancelled: 'Cancelado', postponed: 'Pospuesto' };

export function orderedSessions(event: CollectionEntry<'events'>) {
  return event.data.sessions.toSorted((a, b) => a.date.localeCompare(b.date));
}

export async function eventList() {
  return (await getCollection('events')).sort((a, b) =>
    orderedSessions(a)[0].date.localeCompare(orderedSessions(b)[0].date));
}

export async function postList() {
  return (await getCollection('posts')).sort((a, b) => b.data.date.localeCompare(a.data.date));
}
