import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { eventSchema } from './lib/event-schema.mjs';

const events = defineCollection({
  loader: file('src/content/events.json'),
  schema: eventSchema,
});

export const collections = { events };
