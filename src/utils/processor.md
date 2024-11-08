# FileProcessor Documentation

## Overview

The `FileProcessor` class provides a mechanism to process files concurrently with configurable options such as chunk size, max retries, and progress updates. This is particularly useful for scenarios where you need to read large files or a significant number of files while handling potential errors gracefully.

## Interfaces

### ProcessOptions

```typescript
export interface ProcessOptions {
  maxConcurrent: number; // Maximum files to process concurrently
  chunkSize?: number; // Size of each read operation in bytes (default: 1MB)
  maxRetries?: number; // Number of times to retry processing a file on failure (default: 3)
  retryDelay?: number; // Delay between retries in milliseconds (default: 1000)
  timeout?: number; // Timeout for processing a file in milliseconds (default: 30000)
  skipLargeFiles?: boolean; // Whether to skip files larger than maxFileSize (default: true)
  maxFileSize?: number; // Maximum file size to process in bytes (default: 10MB)
  progressInterval?: number; // Interval to report progress in milliseconds (default: 1000)
}
```

### ProcessStats

```typescript
export interface ProcessStats {
  processed: number; // Number of files processed successfully
  failed: number; // Number of files that failed to process
  skipped: number; // Number of files skipped due to size constraints
  totalSize: number; // Total size of processed files in bytes
  startTime: number; // Start time of the processing in milliseconds
  endTime?: number; // End time of the processing in milliseconds
}
```

### FileError

```typescript
export interface FileError {
  name: string; // Name of the error
  message: string; // Detailed error message
  filePath: string; // Path of the file that caused the error
  retryCount: number; // Number of retries attempted
  cause?: unknown; // Original error that caused the failure
}
```

### FileProgress

```typescript
export interface FileProgress {
  path: string; // Path of the file being processed
  bytesRead: number; // Number of bytes read so far
  totalBytes: number; // Total size of the file in bytes
  percentage: number; // Percentage of the file read
}
```

### ProcessResult

```typescript
export interface ProcessResult {
  path: string; // Path of the processed file
  content: string; // Content of the processed file
}
```

### ProcessUpdate

```typescript
export interface ProcessUpdate {
  type: 'start' | 'progress' | 'complete' | 'error' | 'skip'; // Type of update
  path: string; // Path of the file being updated
  data?: {
    content?: string; // Content of the file (for complete updates)
    error?: FileError; // Error details (for error updates)
    progress?: FileProgress; // Progress details (for progress updates)
    reason?: string; // Reason for skipping (for skip updates)
  };
}
```

## Class: FileProcessor

### Constructor

```typescript
constructor(options: ProcessOptions)
```

- Initializes the `FileProcessor` with the provided options.
- Sets default values for unspecified options and initializes processing statistics.

### Methods

#### `initStats()`

Initializes and returns the processing statistics.

#### `sendUpdate(update: ProcessUpdate)`

Sends progress and error updates through a `BroadcastChannel`.

#### `validateFile(path: string): Promise<void>`

Validates the specified file's existence and checks its size constraints according to the processor options.

#### `readFileWithProgress(path: string, signal: AbortSignal): Promise<string>`

Reads a file in chunks while reporting progress. Returns the entire content of the file as a string.

#### `processFileWithRetry(path: string): Promise<string>`

Processes a file with retry logic built-in. Handles validation, reading, and potential errors by retrying if needed. Throws a `FileError` upon failure after maximum retries.

#### `processFiles(files: string[]): AsyncGenerator<ProcessResult>`

Processes an array of file paths asynchronously. Yields `ProcessResult` for each successfully processed file and handles concurrent processing based on configuration options.

#### `getStats(): ProcessStats`

Returns the current statistics of the processing operation.

#### `writeOutputFile(content: string, outputPath: string, createDir = true): Promise<void>`

Writes the processed content to the specified output path. Optionally creates the directory structure if it doesn't exist.

### Example Usage

```typescript
const processor = new FileProcessor({ maxConcurrent: 3 });

for await (const result of processor.processFiles(['file1.txt', 'file2.txt'])) {
  console.log(`Processed ${result.path}: ${result.content.length} bytes.`);
}

const stats = processor.getStats();
console.log(`Processed ${stats.processed} files.`);
``` 

## Default Options

- `maxConcurrent`: 5
- `chunkSize`: 1MB
- `maxRetries`: 3
- `retryDelay`: 1000 ms
- `timeout`: 30 seconds
- `skipLargeFiles`: true
- `maxFileSize`: 10MB
- `progressInterval`: 1000 ms

## Conclusion

The `FileProcessor` class encapsulates robust file processing logic suitable for handling multiple files with thorough error handling and progress reporting. This is ideal for developers needing an efficient way to process files while managing concurrency and potential issues.