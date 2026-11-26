const bookingHosts = new Set([
  'tickets.teatrosucre.com', 'boletos.casadelamusica.ec',
  'tienda.fundacionmuseosquito.gob.ec', 'www.buenplan.com.ec', 'buenplan.com.ec',
  'www.ticketshow.com.ec', 'ticketshow.com.ec', 'www.ticketmas.com.ec',
  'ticketmas.com.ec', 'redtickets.ec', 'www.redtickets.ec',
]);
const organizerHosts = new Set([
  'teatrosucre.com', 'www.teatrosucre.com', 'www.casadelamusica.ec',
  'casadelamusica.ec', 'fundacionmuseosquito.gob.ec', 'cultura.quito.gob.ec',
  'pasaporte.visitquito.ec',
]);

export function isBookingUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && bookingHosts.has(url.hostname);
  } catch { return false; }
}

export function isOrganizerUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && organizerHosts.has(url.hostname);
  } catch { return false; }
}

export function venueWebsite(venue) {
  if (/sucre|variedades|teatro m[eé]xico/i.test(venue)) return 'https://teatrosucre.com/';
  if (/casa de la m[uú]sica/i.test(venue)) return 'https://www.casadelamusica.ec/programacion';
  const museums = [
    [/yaku/i, 'yaku-parque-museo-del-agua'],
    [/museo de la ciudad/i, 'museo-de-la-ciudad'],
    [/carmen alto/i, 'museo-del-carmen-alto'],
    [/interactivo de ciencia/i, 'museo-interactivo-de-ciencia'],
    [/arte contempor[aá]neo/i, 'centro-de-arte-contemporaneo'],
  ];
  const museum = museums.find(([pattern]) => pattern.test(venue));
  return museum ? 'https://fundacionmuseosquito.gob.ec/' + museum[1] + '/' : undefined;
}

export function eventAction(event) {
  if (isBookingUrl(event.tickets)) {
    const path = new URL(event.tickets).pathname;
    return { url: event.tickets, label: path === '/' ? 'Ver boletería' : 'Consultar entradas' };
  }
  const website = isOrganizerUrl(event.website) ? event.website : venueWebsite(event.venue);
  if (!website) return undefined;
  const path = new URL(website).pathname;
  return { url: website, label: path === '/' || /programacion\/?$/.test(path) ? 'Ver programación oficial' : 'Visitar web oficial' };
}
