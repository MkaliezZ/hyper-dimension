import { z, defineCollection } from "astro:content";
const common = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.string().optional(),
  heroImage: z.string().optional(),
  badge: z.string().optional(),
  tags: z.array(z.string()).refine((items) => new Set(items).size === items.length, { message: "tags must be unique" }).optional(),
});
const projectsSchema = common;
export type BlogSchema = z.infer<typeof common>;
export type ProjectsSchema = z.infer<typeof projectsSchema>;
export const collections = {
  blog: defineCollection({ schema: common }),
  projects: defineCollection({ schema: projectsSchema }),
};
