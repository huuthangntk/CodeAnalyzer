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
