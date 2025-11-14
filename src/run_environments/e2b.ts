import dotenv from 'dotenv';
import { IRunEnvironment, ExecutionResult, ExecutionOptions } from './types';

// Load environment variables
dotenv.config();

/**
 * E2B execution environment
 * Executes code in a secure cloud sandbox using E2B
 * Requires: npm install @e2b/sdk
 */
export class E2BRunEnvironment implements IRunEnvironment {
  private apiKey: string;
  private sandbox: any = null;
  private defaultTemplate: string;

  constructor(template: string = 'base') {
    const apiKey = process.env.E2B_API_KEY;
    
    if (!apiKey) {
      throw new Error('E2B_API_KEY is not set in environment variables');
    }
    
    this.apiKey = apiKey;
    this.defaultTemplate = template;
  }

  /**
   * Initializes the E2B sandbox
   */
  private async initSandbox(): Promise<void> {
    if (this.sandbox) return;

    try {
      // Dynamic import to avoid requiring e2b/sdk if not used
      // @ts-ignore - E2B SDK is an optional peer dependency
      const { Sandbox } = await import('@e2b/sdk');
      
      this.sandbox = await Sandbox.create({
        apiKey: this.apiKey,
        template: this.defaultTemplate,
      });
    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('Cannot find module')) {
        throw new Error('E2B SDK is not installed. Install it with: npm install @e2b/sdk');
      }
      throw new Error(`Failed to initialize E2B sandbox: ${error.message}`);
    }
  }

  /**
   * Executes code in the E2B sandbox
   */
  async execute(code: string, options?: ExecutionOptions): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      await this.initSandbox();

      if (!this.sandbox) {
        throw new Error('Sandbox not initialized');
      }

      // Determine the command to run based on language
      const language = options?.language || 'bash';
      let command: string;

      switch (language) {
        case 'python':
        case 'python3':
          command = `python3 -c ${JSON.stringify(code)}`;
          break;
        case 'node':
        case 'javascript':
          command = `node -e ${JSON.stringify(code)}`;
          break;
        case 'bash':
        case 'sh':
          command = code;
          break;
        default:
          throw new Error(`Unsupported language: ${language}`);
      }

      // Execute in the sandbox
      const result = await this.sandbox.commands.run(command, {
        timeout: options?.timeout || 30000,
        cwd: options?.cwd,
        envVars: options?.env,
      });

      const executionTime = Date.now() - startTime;

      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        executionTime,
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        stdout: '',
        stderr: error.stderr || '',
        exitCode: 1,
        executionTime,
        error: error.message,
      };
    }
  }

  /**
   * Checks if the E2B environment is ready
   */
  async isReady(): Promise<boolean> {
    try {
      await this.initSandbox();
      return this.sandbox !== null;
    } catch {
      return false;
    }
  }

  /**
   * Cleans up the E2B sandbox
   */
  async cleanup(): Promise<void> {
    if (this.sandbox) {
      try {
        await this.sandbox.close();
        this.sandbox = null;
      } catch (error) {
        console.error('Error cleaning up E2B sandbox:', error);
      }
    }
  }

  /**
   * Gets the working directory of the E2B environment
   */
  getWorkingDirectory(): string {
    // E2B sandboxes typically use /home/user as the working directory
    return '/home/user';
  }
}

