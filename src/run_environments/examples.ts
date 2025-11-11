/**
 * Example usage of run environments
 * This file demonstrates how to use the LocalRunEnvironment and E2BRunEnvironment
 */

import { LocalRunEnvironment, E2BRunEnvironment } from './index.js';

/**
 * Example: Using LocalRunEnvironment
 */
async function localExample() {
  console.log('=== Local Run Environment Example ===\n');
  
  const env = new LocalRunEnvironment();
  
  try {
    // Check if environment is ready
    const isReady = await env.isReady();
    console.log(`Environment ready: ${isReady}\n`);
    
    // Example 1: Execute Python code
    console.log('Example 1: Python execution');
    const pythonResult = await env.execute(
      'print("Hello from Python!")\nprint("2 + 2 =", 2 + 2)',
      { language: 'python', timeout: 5000 }
    );
    console.log('Success:', pythonResult.success);
    console.log('Output:', pythonResult.stdout);
    console.log('Execution time:', pythonResult.executionTime, 'ms\n');
    
    // Example 2: Execute Node.js code
    console.log('Example 2: Node.js execution');
    const nodeResult = await env.execute(
      'console.log("Hello from Node.js!"); console.log("Process version:", process.version);',
      { language: 'node', timeout: 5000 }
    );
    console.log('Success:', nodeResult.success);
    console.log('Output:', nodeResult.stdout);
    console.log('Execution time:', nodeResult.executionTime, 'ms\n');
    
    // Example 3: Execute Bash script
    console.log('Example 3: Bash execution');
    const bashResult = await env.execute(
      'echo "Current directory: $(pwd)"\necho "Date: $(date)"',
      { language: 'bash', timeout: 5000 }
    );
    console.log('Success:', bashResult.success);
    console.log('Output:', bashResult.stdout);
    console.log('Execution time:', bashResult.executionTime, 'ms\n');
    
    // Example 4: Handle error
    console.log('Example 4: Error handling');
    const errorResult = await env.execute(
      'print(undefined_variable)',
      { language: 'python', timeout: 5000 }
    );
    console.log('Success:', errorResult.success);
    console.log('Error:', errorResult.error);
    console.log('Stderr:', errorResult.stderr, '\n');
    
  } finally {
    // Always cleanup
    await env.cleanup();
    console.log('Environment cleaned up\n');
  }
}

/**
 * Example: Using E2BRunEnvironment
 */
async function e2bExample() {
  console.log('=== E2B Run Environment Example ===\n');
  
  // Check if E2B_API_KEY is set
  if (!process.env.E2B_API_KEY) {
    console.log('⚠ E2B_API_KEY is not set. Skipping E2B example.');
    console.log('To use E2B, set E2B_API_KEY in your environment variables.\n');
    return;
  }
  
  const env = new E2BRunEnvironment('base');
  
  try {
    // Check if environment is ready
    const isReady = await env.isReady();
    console.log(`Environment ready: ${isReady}\n`);
    
    // Example 1: Execute Python code in cloud sandbox
    console.log('Example 1: Python in E2B sandbox');
    const pythonResult = await env.execute(
      'print("Hello from E2B!")\nprint("Running in a secure sandbox")',
      { language: 'python', timeout: 10000 }
    );
    console.log('Success:', pythonResult.success);
    console.log('Output:', pythonResult.stdout);
    console.log('Execution time:', pythonResult.executionTime, 'ms\n');
    
    // Example 2: Execute Bash commands
    console.log('Example 2: Bash in E2B sandbox');
    const bashResult = await env.execute(
      'uname -a && echo "---" && df -h',
      { language: 'bash', timeout: 10000 }
    );
    console.log('Success:', bashResult.success);
    console.log('Output:', bashResult.stdout);
    console.log('Execution time:', bashResult.executionTime, 'ms\n');
    
  } catch (error: any) {
    console.error('E2B Error:', error.message);
    if (error.message.includes('not installed')) {
      console.log('Install E2B SDK with: npm install @e2b/sdk\n');
    }
  } finally {
    // Always cleanup
    await env.cleanup();
    console.log('Environment cleaned up\n');
  }
}

/**
 * Main function to run all examples
 */
async function main() {
  console.log('========================================');
  console.log('Run Environments Examples');
  console.log('========================================\n');
  
  // Run local example
  await localExample();
  
  // Run E2B example (if API key is available)
  await e2bExample();
  
  console.log('========================================');
  console.log('Examples completed!');
  console.log('========================================');
}

// Uncomment to run the examples
// main().catch(console.error);

export { localExample, e2bExample };

