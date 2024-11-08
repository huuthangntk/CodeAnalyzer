import { ProjectConfig } from '../types/config.ts';

export const defaultConfig: ProjectConfig = {
  models: [
    {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 2000
    },
    {
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      temperature: 0.3,
      maxTokens: 2000
    }
  ],
  outputDir: './analysis',
  concurrent: 5
};

