import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const news = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    // Owner-approved display title (emoji removed, ALL-CAPS normalized). The raw
    // `title` stays verbatim in the article body & data. Awaiting owner approval.
    displayTitle: z.string().optional(),
    // Clean cover image key (cropped, no embedded ad text) for cards.
    cover: z.string().optional(),
    seoTitle: z.string(),
    seoDescription: z.string(),
    date: z.string(),
    displayDate: z.string(),
    excerpt: z.string(),
    images: z.array(z.string()),
    legacyUrl: z.string().optional(),
  }),
});

export const collections = { news };
