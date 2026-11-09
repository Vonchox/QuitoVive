# QuitoVive

Agenda cultural independiente de Quito y blog editorial. La primera edición reúne 15 eventos de noviembre de 2026 y tres artículos. La interfaz toma el color y la escala tipográfica de la referencia visual y usa ilustraciones vectoriales propias del Pichincha y la cartelería cultural.

[Ver la demo pública de QuitoVive en GitHub Pages](https://vonchox.github.io/QuitoVive/)

## Desarrollo

Requiere Node.js 22.12 o superior.

```sh
npm ci
npm run dev
npm test
npm run build
```

Astro genera el sitio en `dist/`. `npm run preview` sirve esa compilación localmente. Las fichas y los artículos tienen rutas estáticas, y la agenda comparte sus filtros en la URL. Los filtros usan la fecha local de Quito y las sesiones individuales de cada evento.

GitHub Actions publica en GitHub Pages cuando cambian el código, el contenido o la configuración en `main`. El resultado de cada publicación aparece en el [flujo de publicación](https://github.com/Vonchox/QuitoVive/actions/workflows/pages.yml).

## Actualizar la agenda

1. Agrega o actualiza una ficha en `src/content/events.json`. Usa un identificador estable y registra cada fecha con sus horarios publicados.
2. Añade el enlace de la fuente y el día de verificación. Deja ausente el aforo si la fuente no publica la capacidad. Conserva el estado del evento si se cancela o aplaza.
3. Los artículos viven en `src/content/blog/` como Markdown y pueden enlazar a las fichas.
4. Ejecuta las pruebas y recompila para publicar una edición nueva. Los eventos concluidos siguen disponibles en el filtro **Pasados**.

Las ilustraciones son de categoría. Las reservas y las entradas se consultan con los organizadores.
