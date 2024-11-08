# Code Analyzer (Deno Edition)

A powerful code analysis tool built with Deno and TypeScript that provides detailed suggestions using AI models from OpenAI and Anthropic. This is a complete rewrite of the original Python version, focusing on performance, concurrency, and extensibility.

## Features
- 🚀 Concurrent file processing with progress tracking
- 🤖 Support for both OpenAI and Anthropic models
- 📝 Detailed code analysis categories:
  - Code Improvement
  - Performance Optimization
  - Security Analysis
  - Bug Detection
- 🔍 Smart file filtering with .docsignore
- ⚡ Async/Concurrent processing
- 💻 Interactive CLI interface

## Installation

### Prerequisites
```bash
# Install Deno
curl -fsSL https://deno.land/install.sh | sh

# Verify installation
deno --version
```

### Development Setup
```bash
# Clone repository
git clone [repository-url]
cd code-analyzer

# Install VS Code extensions
code --install-extension denoland.vscode-deno
```

## Configuration

### Project Configuration (.codeanalyzerc)
```json
{

}
```

### Ignore Patterns (.docsignore)
```plaintext
venv
node_modules
.vscode
```

## Project Structure
```
code-analyzer/
├── deno.json
└── src/
    ├── main.ts
    ├── config/
    │   └── default.ts
    ├── providers/
    │   ├── openai.ts
    │   └── anthropic.ts
    ├── utils/
    │   ├── processor.ts
    │   ├── scanner.ts
    │   └── ignore.ts
    └── types/
        ├── config.ts
        └── default.ts
```

## File Contents

### ./deno.json
```json
{
    "tasks": {
      "dev": "deno run --allow-read --allow-write --allow-env --allow-net src/main.ts",
      "build": "deno compile --allow-read --allow-write --allow-env --allow-net src/main.ts"
    },
    "imports": {
      "std/": "https://deno.land/std@0.210.0/",
      "cliffy/": "https://deno.land/x/cliffy@v1.0.0-rc.3/",
      "zod": "https://deno.land/x/zod@v3.22.4/mod.ts"
    },
    "compilerOptions": {
      "strict": true,
      "allowJs": false,
      "lib": ["deno.window"]
    },
    "fmt": {
      "semiColons": true,
      "singleQuote": true,
      "indentWidth": 2
    }
  }
```

### ./src/main.ts
```typescript
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
```

### ./src/config/default.ts

```typescript

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

```

### ./src/types/config.ts

```typescript

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

```

### ./src/utils/ignore.ts

```typescript

import { parse as parsePath } from "std/path/mod.ts";
import { globToRegExp } from "std/path/glob.ts";
import { walk } from "std/fs/walk.ts";
import { relative, resolve } from "std/path/mod.ts";

export interface IgnoreOptions {
  ignoreCase?: boolean;
  allowNegation?: boolean;
  useGitignore?: boolean;
  extraPatterns?: string[];
  customIgnoreFile?: string;
}

export class IgnorePattern {
  private patterns: Array<{
    pattern: RegExp;
    negative: boolean;
  }> = [];

  private options: Required<IgnoreOptions>;

  private static readonly DEFAULT_OPTIONS: Required<IgnoreOptions> = {
    ignoreCase: true,
    allowNegation: true,
    useGitignore: true,
    extraPatterns: [],
    customIgnoreFile: '.docsignore',
  };

  constructor(options: IgnoreOptions = {}) {
    this.options = { ...IgnorePattern.DEFAULT_OPTIONS, ...options };
  }

  private normalizePattern(pattern: string): {
    pattern: string;
    negative: boolean;
  } {
    let negative = false;
    
    // Handle negation
    if (this.options.allowNegation && pattern.startsWith('!')) {
      negative = true;
      pattern = pattern.slice(1);
    }

    // Normalize pattern
    pattern = pattern.trim()
      .replace(/\\/g, '/') // Convert windows paths
      .replace(/^\.\/|^\//, '') // Remove leading ./ or /
      .replace(/\/$/, ''); // Remove trailing slash

    return { pattern, negative };
  }

  private addPattern(pattern: string): void {
    const { pattern: normalized, negative } = this.normalizePattern(pattern);
    
    if (!normalized) return;

    // Convert glob to RegExp
    const regexPattern = globToRegExp(normalized, {
      extended: true,
      globstar: true,
      caseInsensitive: this.options.ignoreCase,
    });

    this.patterns.push({ pattern: regexPattern, negative });
  }

  public addPatterns(patterns: string[]): void {
    patterns.forEach(pattern => this.addPattern(pattern));
  }

  public shouldIgnore(path: string): boolean {
    const normalizedPath = this.normalizePattern(path).pattern;
    let ignored = false;

    for (const { pattern, negative } of this.patterns) {
      if (pattern.test(normalizedPath)) {
        ignored = !negative;
      }
    }

    return ignored;
  }

  public static async loadFromFile(
    path: string,
    options: IgnoreOptions = {}
  ): Promise<IgnorePattern> {
    const ignore = new IgnorePattern(options);
    
    // Add extra patterns first
    if (options.extraPatterns) {
      ignore.addPatterns(options.extraPatterns);
    }

    try {
      // Load .docsignore
      const content = await Deno.readTextFile(path);
      const patterns = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      ignore.addPatterns(patterns);

      // Load .gitignore if enabled
      if (options.useGitignore) {
        try {
          const gitignore = await Deno.readTextFile('.gitignore');
          const gitPatterns = gitignore
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
          ignore.addPatterns(gitPatterns);
        } catch {
          // .gitignore not found, ignore error
        }
      }
    } catch {
      // Ignore file not found, use default patterns
    }

    return ignore;
  }

  public async filterFiles(
    dir: string,
    extensions: string[] = []
  ): Promise<string[]> {
    const files: string[] = [];
    const baseDir = resolve(dir);

    for await (const entry of walk(baseDir, {
      includeFiles: true,
      includeDirs: false,
      followSymlinks: false,
    })) {
      const relativePath = relative(baseDir, entry.path);
      
      // Skip ignored files
      if (this.shouldIgnore(relativePath)) {
        continue;
      }

      // Check file extension
      if (extensions.length > 0) {
        const ext = entry.name.split('.').pop()?.toLowerCase() || '';
        if (!extensions.includes(ext)) {
          continue;
        }
      }

      files.push(entry.path);
    }

    return files;
  }
}

export default IgnorePattern;
```

### ./src/utils/processor.ts

```typescript

import { delay } from 'std/async/delay.ts';
import { basename, dirname } from 'std/path/mod.ts';
import { ensureDir } from 'std/fs/ensure_dir.ts';
export interface ProcessOptions {
  maxConcurrent: number;
  chunkSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  skipLargeFiles?: boolean;
  maxFileSize?: number;
  progressInterval?: number;
}

export interface ProcessStats {
  processed: number;
  failed: number;
  skipped: number;
  totalSize: number;
  startTime: number;
  endTime?: number;
}

export interface FileError {
  name: string;
  message: string;
  filePath: string;
  retryCount: number;
  cause?: unknown;
}

export interface FileProgress {
  path: string;
  bytesRead: number;
  totalBytes: number;
  percentage: number;
}

export interface ProcessResult {
  path: string;
  content: string;
}

export interface ProcessUpdate {
  type: 'start' | 'progress' | 'complete' | 'error' | 'skip';
  path: string;
  data?: {
    content?: string;
    error?: FileError;
    progress?: FileProgress;
    reason?: string;
  };
}

export class FileProcessor {
  private options: Required<ProcessOptions>;
  private stats: ProcessStats;
  private updateChannel: typeof BroadcastChannel;

  private static readonly DEFAULT_OPTIONS: Required<ProcessOptions> = {
    maxConcurrent: 5,
    chunkSize: 1024 * 1024, // 1MB
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000,
    skipLargeFiles: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    progressInterval: 1000,
  };

  constructor(options: ProcessOptions) {
    this.options = { ...FileProcessor.DEFAULT_OPTIONS, ...options };
    this.stats = this.initStats();
    this.updateChannel = new BroadcastChannel('file-processor-updates');
  }

  private initStats(): ProcessStats {
    return {
      processed: 0,
      failed: 0,
      skipped: 0,
      totalSize: 0,
      startTime: Date.now(),
    };
  }

  private sendUpdate(update: ProcessUpdate): void {
    this.updateChannel.postMessage(update);
  }

  private async validateFile(path: string): Promise<void> {
    try {
      const stat = await Deno.stat(path);

      if (!stat.isFile) {
        throw new Error(`Not a file: ${path}`);
      }

      if (this.options.skipLargeFiles && stat.size > this.options.maxFileSize) {
        throw new Error(`File too large: ${stat.size} bytes`);
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error(`File not found: ${path}`);
      }
      throw error;
    }
  }

  private async readFileWithProgress(
    path: string,
    signal: AbortSignal,
  ): Promise<string> {
    const file = await Deno.open(path);
    const stat = await file.stat();
    const decoder = new TextDecoder();
    let content = '';
    let bytesRead = 0;
    let lastProgress = Date.now();

    try {
      const buffer = new Uint8Array(this.options.chunkSize);

      while (true) {
        if (signal.aborted) {
          throw new Error('Operation aborted');
        }

        const chunk = await file.read(buffer);
        if (chunk === null) break;

        bytesRead += chunk;
        content += decoder.decode(buffer.subarray(0, chunk), { stream: true });

        const now = Date.now();
        if (now - lastProgress >= this.options.progressInterval) {
          this.sendUpdate({
            type: 'progress',
            path,
            data: {
              progress: {
                path,
                bytesRead,
                totalBytes: stat.size,
                percentage: (bytesRead / stat.size) * 100,
              },
            },
          });
          lastProgress = now;
        }
      }

      return content;
    } finally {
      file.close();
    }
  }

  private async processFileWithRetry(path: string): Promise<string> {
    let retryCount = 0;
    let lastError: unknown = null;

    while (retryCount <= this.options.maxRetries) {
      try {
        await this.validateFile(path);

        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.options.timeout,
        );

        this.sendUpdate({ type: 'start', path });
        const content = await this.readFileWithProgress(
          path,
          controller.signal,
        );
        clearTimeout(timeoutId);

        this.stats.processed++;
        this.sendUpdate({ type: 'complete', path, data: { content } });
        return content;
      } catch (error) {
        lastError = error;
        retryCount++;

        if (retryCount <= this.options.maxRetries) {
          await delay(this.options.retryDelay * retryCount);
        }
      }
    }

    const fileError: FileError = {
      name: 'FileProcessError',
      message: lastError instanceof Error ? lastError.message : 'Unknown error',
      filePath: path,
      retryCount,
      cause: lastError,
    };

    this.stats.failed++;
    this.sendUpdate({ type: 'error', path, data: { error: fileError } });
    throw fileError;
  }

  public async *processFiles(files: string[]): AsyncGenerator<ProcessResult> {
    const inProgress = new Map<string, Promise<string>>();
    const queue = [...files];

    try {
      while (queue.length > 0 || inProgress.size > 0) {
        // Start new tasks up to maxConcurrent
        while (
          queue.length > 0 && inProgress.size < this.options.maxConcurrent
        ) {
          const path = queue.shift()!;
          inProgress.set(path, this.processFileWithRetry(path));
        }

        if (inProgress.size > 0) {
          const [path, promise] = [...inProgress.entries()][0];
          try {
            const content = await promise;
            inProgress.delete(path);
            yield { path, content };
          } catch (error) {
            inProgress.delete(path);
            // Error already handled in processFileWithRetry
          }
        }
      }
    } finally {
      this.stats.endTime = Date.now();
      this.updateChannel.close();
    }
  }

  public getStats(): ProcessStats {
    return { ...this.stats };
  }

  public async writeOutputFile(
    content: string,
    outputPath: string,
    createDir = true,
  ): Promise<void> {
    if (createDir) {
      await ensureDir(dirname(outputPath));
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    await Deno.writeFile(outputPath, data);
  }
}

export default FileProcessor;
```

### ./src/utils/scanner.ts

```typescript

import { walk } from "std/fs/walk.ts";
import { IgnorePattern } from "./ignore.ts";
import { resolve, relative } from "std/path/mod.ts";

export interface ScanOptions {
  concurrent?: number;
  extensions?: string[];
  ignorePath?: string;
}

export interface ScannedFile {
  path: string;
  relativePath: string;
  size: number;
  extension: string;
}

export async function scanDirectory(
  dir: string,
  options: ScanOptions = {}
): Promise<ScannedFile[]> {
  const {
    concurrent = 5,
    extensions = [],
    ignorePath = '.docsignore'
  } = options;

  const ignorePattern = await IgnorePattern.loadFromFile(ignorePath);
  const files: ScannedFile[] = [];
  const baseDir = resolve(dir);

  for await (const entry of walk(baseDir, {
    includeFiles: true,
    includeDirs: false,
    followSymlinks: false,
  })) {
    const relativePath = relative(baseDir, entry.path);
    
    // Skip ignored files
    if (ignorePattern.shouldIgnore(relativePath)) {
      continue;
    }

    // Check file extension
    const ext = entry.name.split('.').pop()?.toLowerCase() || '';
    if (extensions.length > 0 && !extensions.includes(ext)) {
      continue;
    }

    const stat = await Deno.stat(entry.path);
    files.push({
      path: entry.path,
      relativePath,
      size: stat.size,
      extension: ext,
    });
  }

  return files;
}
```

## Usage Examples

### Basic Analysis
```bash
# Start analysis
deno task dev

# Configure settings
deno task dev --config
```

### Advanced Usage
```bash
[Advanced usage examples placeholder]
```

## Development

### Running Locally
```bash
# Development mode
deno task dev

# Build executable
deno task build
```

### Environment Setup
Create a `.env` file:
```env
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

## Architecture
- **File Processing**: Concurrent processing with streaming support
- **AI Integration**: Modular provider system for multiple AI models
- **Output Management**: Categorized suggestions with file-specific organization
- **Configuration**: Flexible project and ignore settings

## Contributing
[Contributing guidelines placeholder]
