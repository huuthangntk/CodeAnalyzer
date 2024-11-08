import { parse } from 'std/flags/mod.ts';
import { Select } from 'cliffy/prompt/select.ts';
import { ProjectConfig } from './types/config.ts';
import { defaultConfig } from './config/default.ts';

async function main() {
  let config: ProjectConfig = defaultConfig;

  // Load project config if exists
  try {
    const configFile = await Deno.readTextFile('./.codeanalyzerc');
    config = JSON.parse(configFile);
  } catch {
    // Use default config if no config file exists
  }

  const action = await Select.prompt({
    message: 'What would you like to do?',
    options: [
      { name: 'Analyze Repository', value: 'analyze' },
      { name: 'Configure Settings', value: 'settings' },
      { name: 'Exit', value: 'exit' }
    ],
  });

  switch (action) {
    case 'analyze':
      console.log('Analysis feature coming soon...');
      break;
    case 'settings':
      console.log('Settings configuration coming soon...');
      break;
    case 'exit':
      Deno.exit(0);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}