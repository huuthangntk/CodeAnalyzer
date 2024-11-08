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