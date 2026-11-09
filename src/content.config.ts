import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const events = defineCollection({
  loader: file('src/content/events.json'),
  schema: z.object({
    title: z.string(),
    category: z.enum(['Música', 'Escena', 'Arte', 'Cine', 'Talleres', 'Patrimonio']),
    summary: z.string(),
    venue: z.string(),
    organizer: z.string(),
    sessions: z.array(z.object({
      date: z.iso.date(),
      times: z.array(z.iso.time({ precision: -1 })).default([]),
    })).min(1),
    artists: z.array(z.string()).default([]),
    access: z.enum(['free', 'paid', 'unknown']),
    price: z.string().optional(),
    capacity: z.number().int().positive().optional(),
    accessNote: z.string().optional(),
    accessibility: z.string().optional(),
    tickets: z.url().optional(),
    source: z.object({ name: z.string(), url: z.url(), checked: z.iso.date() }),
    status: z.enum(['scheduled', 'cancelled', 'postponed']).default('scheduled'),
    featured: z.boolean().default(false),
  }),
});

const posts = defineCollection({
  loader: glob({ pattern: '*.md', base: 'src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    label: z.string(),
    date: z.iso.date(),
    art: z.enum(['Música', 'Arte', 'Patrimonio']),
  }),
});

export const collections = { events, posts };
