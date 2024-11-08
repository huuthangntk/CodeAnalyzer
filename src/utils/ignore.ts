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