# Run Environments

This folder contains implementations for different code execution environments. Each environment provides a consistent interface for executing code while handling the specifics of different runtime environments.

## Overview

The run environments module provides a unified interface (`IRunEnvironment`) for executing code in different contexts:

- **Local**: Execute code on the local machine
- **E2B**: Execute code in secure cloud sandboxes using E2B

## Interface

All run environments implement the `IRunEnvironment` interface:

```typescript
interface IRunEnvironment {
  execute(code: string, options?: ExecutionOptions): Promise<ExecutionResult>;
  cleanup(): Promise<void>;
  isReady(): Promise<boolean>;
}
```

## Supported Environments

### Local Run Environment

Executes code on the local machine using system interpreters.

**Features:**
- Supports multiple languages (Python, Node.js, Bash, Ruby, TypeScript)
- Automatic temp file management
- Configurable timeout and environment variables
- Safe cleanup of temporary files

**Usage:**

```typescript
import { LocalRunEnvironment } from './run_environments';

const env = new LocalRunEnvironment();

// Execute Python code
const result = await env.execute('print("Hello, World!")', {
  language: 'python',
  timeout: 5000
});

console.log(result.stdout); // "Hello, World!"

// Cleanup
await env.cleanup();
```

**Supported Languages:**
- `python` / `python3` - Python scripts
- `node` / `javascript` - Node.js scripts
- `typescript` - TypeScript scripts (requires ts-node)
- `bash` / `sh` - Shell scripts
- `ruby` - Ruby scripts

### E2B Run Environment

Executes code in secure cloud sandboxes using the E2B platform.

**Features:**
- Isolated execution environment
- Cloud-based sandboxes
- Multiple template support
- Automatic sandbox lifecycle management

**Setup:**

1. Install E2B SDK:
   ```bash
   npm install @e2b/sdk
   ```

2. Set your E2B API key:
   ```bash
   export E2B_API_KEY="your-api-key"
   ```

**Usage:**

```typescript
import { E2BRunEnvironment } from './run_environments';

const env = new E2BRunEnvironment('base'); // or 'nodejs', 'python', etc.

// Execute code
const result = await env.execute('echo "Hello from E2B!"', {
  language: 'bash',
  timeout: 10000
});

console.log(result.stdout); // "Hello from E2B!"

// Cleanup
await env.cleanup();
```

**Supported Languages:**
- `python` / `python3` - Python code
- `node` / `javascript` - Node.js code
- `bash` / `sh` - Shell commands

## Execution Options

All environments support the following options:

```typescript
interface ExecutionOptions {
  cwd?: string;                    // Working directory
  env?: Record<string, string>;    // Environment variables
  timeout?: number;                // Timeout in milliseconds (default: 30000)
  language?: string;               // Language/runtime to use
}
```

## Execution Result

All executions return a consistent result structure:

```typescript
interface ExecutionResult {
  success: boolean;      // Whether execution was successful
  stdout: string;        // Standard output
  stderr: string;        // Standard error
  exitCode?: number;     // Exit code
  executionTime?: number; // Execution time in milliseconds
  error?: string;        // Error message if failed
}
```

## Best Practices

1. **Always cleanup**: Call `cleanup()` when done to release resources
2. **Check readiness**: Use `isReady()` before executing code
3. **Set timeouts**: Prevent hanging by setting appropriate timeouts
4. **Handle errors**: Always check `result.success` and handle errors
5. **Use try-finally**: Ensure cleanup happens even if execution fails

## Example: Safe Execution Pattern

```typescript
import { LocalRunEnvironment } from './run_environments';

async function safeExecute(code: string) {
  const env = new LocalRunEnvironment();
  
  try {
    // Check if environment is ready
    if (!await env.isReady()) {
      throw new Error('Environment not ready');
    }
    
    // Execute code
    const result = await env.execute(code, {
      language: 'python',
      timeout: 5000
    });
    
    if (!result.success) {
      console.error('Execution failed:', result.error);
      console.error('stderr:', result.stderr);
      return null;
    }
    
    return result.stdout;
  } finally {
    // Always cleanup
    await env.cleanup();
  }
}
```

## Adding New Environments

To add a new run environment:

1. Create a new file (e.g., `docker.ts`)
2. Implement the `IRunEnvironment` interface
3. Export the new environment in `index.ts`
4. Update this README with usage instructions

## Environment Variables

- `E2B_API_KEY`: Required for E2B environments

## Security Considerations

- **Local Environment**: Executes code with the same permissions as the process. Use with caution.
- **E2B Environment**: Provides isolated, sandboxed execution. Recommended for untrusted code.

## Future Environments

Potential future environments to add:
- Docker containers
- AWS Lambda
- Google Cloud Functions
- WebAssembly runtime
- Remote SSH execution

