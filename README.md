# QuitoVive

Agenda cultural independiente de Quito con planes para compartir un día y calcular el presupuesto del grupo. Incluye scraping semanal, transiciones entre páginas y una portada ilustrada en movimiento.

[Ver la demo pública de QuitoVive en GitHub Pages](https://vonchox.github.io/QuitoVive/)

## Desarrollo

Requiere Node.js 22.23.4 o superior. El despliegue utiliza Node.js 24.

```sh
npm ci
npm run dev
npm test
npm run build
```

Astro genera el sitio en `dist/`. `npm run preview` sirve esa compilación localmente en `/QuitoVive/`. Las fichas tienen rutas estáticas y la agenda comparte sus filtros en la URL. Los filtros usan la fecha local de Quito y las sesiones individuales de cada evento. El movimiento respeta la preferencia de movimiento reducido y se puede pausar desde la portada.

GitHub Actions publica en GitHub Pages cuando cambian el código, el contenido o la configuración en `main`. El resultado de cada publicación aparece en el [flujo de publicación](https://github.com/Vonchox/QuitoVive/actions/workflows/pages.yml).

## Scraping semanal

El flujo de publicación ejecuta `npm run scrape` cada jueves a las 07:17 de Quito (12:17 UTC), con posible retraso de GitHub Actions. También se puede ejecutar desde **Actions → Publicar QuitoVive → Run workflow**. Tras las pruebas y la compilación, guarda los cambios y despliega en el mismo flujo.

El scraper consulta el HTML público de [Visit Quito](https://visitquito.ec/es/eventos/), [Casa de la Música](https://www.casadelamusica.ec/programacion) y [Fundación Teatro Nacional Sucre](https://teatrosucre.com/). Lee las páginas individuales del Sucre y la programación de Casa de la Música para obtener descripciones, afiches, precios y enlaces de boletería. Consulta robots.txt, se identifica, limita las solicitudes y valida los datos sin ejecutar JavaScript externo.

Los botones de las fichas dirigen a una boletería reconocida o a la web oficial del organizador. La procedencia de la programación, los precios y las imágenes se conserva en **Fuentes → Datos y créditos por evento**. Las imágenes se cargan desde el sitio de su titular y vuelven a la ilustración de categoría si fallan. Los extractos descriptivos se limitan a 110 palabras por publicación.

Para Visit Quito, también se contrastan precios en artículos de Ecuador Chequea enlazados por la agenda y cuyo mes y año coincidan. Los rangos de precios permanecen como texto. Solo se calcula un total por persona cuando la tarifa es inequívoca, sumando los cargos de servicio explícitos.

Las fechas múltiples ambiguas, los registros incompletos y las actividades fuera del catálogo se omiten. Los precios ausentes permanecen pendientes. Si falla una agenda, las demás pueden actualizarse conservando los datos anteriores de la fuente que falló. Las fichas editoriales conservan su texto y sus fechas al recibir imágenes o enlaces oficiales. Las funciones con diferentes horarios se mantienen separadas y se conservan las URLs existentes. El resultado aparece en `src/content/scrape-status.json` y en **Fuentes**.

GitHub puede desactivar tareas programadas en repositorios públicos tras 60 días sin actividad. Revisa el flujo si la fecha de última consulta deja de avanzar.

## Edición y planes

1. Agrega o actualiza una ficha en `src/content/events.json`. Usa un identificador estable y registra cada fecha con sus horarios publicados.
2. Añade el enlace de la fuente y el día de verificación. Deja ausente el aforo si la fuente no publica la capacidad. Conserva el estado del evento si se cancela o aplaza.
3. Usa `priceAmount` solo para un precio publicado en USD por persona. Los planes se generan desde los eventos vigentes con horario conocido. Los precios pendientes se excluyen de los filtros con tope de presupuesto.
4. Ejecuta las pruebas y recompila para publicar una edición nueva. Los eventos concluidos siguen disponibles en el filtro **Pasados**.

Las ilustraciones son de categoría. Las reservas y las entradas se consultan con los organizadores.
