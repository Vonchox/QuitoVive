import { z } from 'astro/zod';

const publicUrl = z.url().refine(url => url.startsWith('https://'), 'La fuente debe usar HTTPS');
export const eventSchema = z.object({
  title: z.string().min(1).max(250),
  category: z.enum(['Música', 'Escena', 'Arte', 'Cine', 'Talleres', 'Patrimonio']),
  summary: z.string().min(1).max(700),
  description: z.array(z.string().min(1).max(1200)).max(3).optional(),
  image: z.object({
    url: publicUrl,
    alt: z.string(),
    credit: z.string(),
    source: publicUrl,
  }).optional(),
  venue: z.string().min(1).max(250),
  organizer: z.string().min(1),
  sessions: z.array(z.object({
    date: z.iso.date(),
    times: z.array(z.iso.time({ precision: -1 })).default([]),
  })).min(1),
  artists: z.array(z.string()).default([]),
  access: z.enum(['free', 'paid', 'unknown']),
  price: z.string().optional(),
  priceAmount: z.number().nonnegative().optional(),
  priceSource: publicUrl.optional(),
  capacity: z.number().int().positive().optional(),
  accessNote: z.string().optional(),
  accessibility: z.string().optional(),
  tickets: publicUrl.optional(),
  website: publicUrl.optional(),
  referenceUrl: publicUrl.optional(),
  contentSource: z.object({ name: z.string(), url: publicUrl, checked: z.iso.date() }).optional(),
  source: z.object({ name: z.string(), url: publicUrl, checked: z.iso.date() }),
  status: z.enum(['scheduled', 'cancelled', 'postponed']).default('scheduled'),
  featured: z.boolean().default(false),
  imported: z.enum(['visitquito', 'casamusica', 'teatrosucre']).optional(),
  upstreamIds: z.array(z.string()).optional(),
});
