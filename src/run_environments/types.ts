/**
 * Result of a code execution
 */
export interface ExecutionResult {
  /**
   * Whether the execution was successful
   */
  success: boolean;
  /**
   * Standard output from the execution
   */
  stdout: string;
  /**
   * Standard error from the execution
   */
  stderr: string;
  /**
   * Exit code of the execution (if applicable)
   */
  exitCode?: number;
  /**
   * Execution time in milliseconds
   */
  executionTime?: number;
  /**
   * Any error that occurred during execution
   */
  error?: string;
}

/**
 * Options for code execution
 */
export interface ExecutionOptions {
  /**
   * Working directory for the execution
   */
  cwd?: string;
  /**
   * Environment variables to set
   */
  env?: Record<string, string>;
  /**
   * Timeout in milliseconds
   */
  timeout?: number;
  /**
   * Language/runtime to use (e.g., "python", "node", "bash")
   */
  language?: string;
}

/**
 * Generic interface for all run environment implementations
 */
export interface IRunEnvironment {
  /**
   * Executes code in the environment
   * @param code The code to execute
   * @param options Execution options
   * @returns Result of the execution
   */
  execute(code: string, options?: ExecutionOptions): Promise<ExecutionResult>;

  /**
   * Cleans up the environment (closes connections, removes temp files, etc.)
   */
  cleanup(): Promise<void>;

  /**
   * Checks if the environment is ready to execute code
   * @returns Whether the environment is ready
   */
  isReady(): Promise<boolean>;

  /**
   * Gets the working directory of the environment
   * @returns The working directory path
   */
  getWorkingDirectory(): string;
}

