import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { IRunEnvironment, ExecutionResult, ExecutionOptions } from './types';

const execAsync = promisify(exec);

/**
 * Local execution environment
 * Executes code on the local machine
 */
export class LocalRunEnvironment implements IRunEnvironment {
  private workDir: string;
  private tempDir: string | null = null;

  constructor(workDir?: string) {
    this.workDir = workDir || path.join(os.tmpdir(), 'mcp-codemode');
  }

  /**
   * Gets the appropriate file extension and command for a language
   */
  private getLanguageConfig(language: string): { extension: string; command: (file: string) => string } {
    const configs: Record<string, { extension: string; command: (file: string) => string }> = {
      python: {
        extension: '.py',
        command: (file) => `python3 ${file}`,
      },
      python3: {
        extension: '.py',
        command: (file) => `python3 ${file}`,
      },
      node: {
        extension: '.js',
        command: (file) => `node ${file}`,
      },
      javascript: {
        extension: '.js',
        command: (file) => `node ${file}`,
      },
      typescript: {
        extension: '.ts',
        command: (file) => `ts-node ${file}`,
      },
      bash: {
        extension: '.sh',
        command: (file) => `bash ${file}`,
      },
      sh: {
        extension: '.sh',
        command: (file) => `sh ${file}`,
      },
      ruby: {
        extension: '.rb',
        command: (file) => `ruby ${file}`,
      },
    };

    return configs[language] || { extension: '.txt', command: (file) => `cat ${file}` };
  }

  /**
   * Executes code in the local environment
   */
  async execute(code: string, options?: ExecutionOptions): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Determine language and create temp file
      const language = options?.language || 'bash';
      const config = this.getLanguageConfig(language);
      
      // Create working directory if not exists
      await fs.mkdir(this.workDir, { recursive: true });
      
      // Create temp directory for scripts if not exists
      if (!this.tempDir) {
        this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-script-'));
      }

      // Write code to temp file
      const tempFile = path.join(this.tempDir, `script${config.extension}`);
      await fs.writeFile(tempFile, code, 'utf-8');

      // Make executable if shell script
      if (language === 'bash' || language === 'sh') {
        await fs.chmod(tempFile, 0o755);
      }

      // Execute the code in the working directory (not the temp dir)
      const command = config.command(tempFile);
      const execOptions = {
        cwd: options?.cwd || this.workDir,  // Use workDir as default cwd
        env: { ...process.env, ...options?.env },
        timeout: options?.timeout || 30000, // Default 30 seconds
      };

      const { stdout, stderr } = await execAsync(command, execOptions);
      
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
        executionTime,
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.code || 1,
        executionTime,
        error: error.message,
      };
    }
  }

  /**
   * Checks if the local environment is ready
   */
  async isReady(): Promise<boolean> {
    try {
      // Check if we can execute basic commands
      await execAsync('echo "test"');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cleans up temporary files
   */
  async cleanup(): Promise<void> {
    if (this.tempDir) {
      try {
        await fs.rm(this.tempDir, { recursive: true, force: true });
        this.tempDir = null;
      } catch (error) {
        console.error('Error cleaning up temp directory:', error);
      }
    }
  }

  /**
   * Gets the working directory of the local environment
   */
  getWorkingDirectory(): string {
    return this.workDir;
  }
}

