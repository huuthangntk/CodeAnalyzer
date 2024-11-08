import { z } from 'zod';

export const ModelConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic']),
  model: z.string(),
  temperature: z.number().min(0).max(1).default(0.3),
  maxTokens: z.number().positive().default(2000)
});

export const ProjectConfigSchema = z.object({
  models: z.array(ModelConfigSchema),
  outputDir: z.string().default('./analysis'),
  concurrent: z.number().positive().default(5)
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
