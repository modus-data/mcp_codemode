import { LLMFunction } from './model_clients/types';
import { IMCPProvider, MCPTool, ToolCatalog } from './mcp_providers/types';
import { IRunEnvironment } from './run_environments/types';
import { getToolByPath, listAllToolPaths } from './mcp_providers/utils';
import { generatePseudocode, filterToolsForQuery, generateToolsCode, implementCode, executeCode } from './steps';

/**
 * Configuration for the CodeModeMCP class
 */
export interface CodeModeMCPConfig {
  /**
   * LLM configuration object containing the three LLM functions
   */
  llms: {
    /**
     * Tiny LLM - Used for sorting through massive amounts of options
     * This should be a fast, lightweight model for quick filtering and selection tasks
     */
    tinyLLM: LLMFunction;
    
    /**
     * Main LLM - Used for writing and executing the calling code
     * This should be a capable model for code generation and reasoning
     */
    mainLLM: LLMFunction;
    
    /**
     * Strategy LLM - Used for strategic reasoning and planning
     * This should be the most capable model for high-level decision making
     */
    strategyLLM: LLMFunction;
  };
  
  /**
   * Hierarchical catalog of MCP tools to make available
   */
  tools?: ToolCatalog;
  
  /**
   * Optional MCP provider for accessing tools
   */
  mcpProvider?: IMCPProvider;
  
  /**
   * Optional run environment for executing code
   */
  runEnvironment?: IRunEnvironment;
}

/**
 * Options for running MCP code
 */
export interface RunMCPCodeOptions {
  /**
   * Maximum number of tool calls allowed
   */
  maxToolCalls: number;
  
  /**
   * Total execution timeout in seconds
   */
  totalExecutionTimeout: number;
  
  /**
   * Timeout for individual tool calls in seconds
   */
  toolCallTimeout: number;
  
  /**
   * Optional user query/task to execute
   */
  query?: string;
  
  /**
   * Maximum number of tools to include per LLM prompt for filtering
   * @default 20
   */
  maxToolsPerPrompt?: number;
  
  /**
   * Maximum number of concurrent LLM calls for parallel filtering
   * @default 5
   */
  maxConcurrentThreads?: number;
}

/**
 * Timing information for a step
 */
export interface StepTiming {
  /**
   * Name of the step
   */
  stepName: string;
  
  /**
   * Duration in milliseconds
   */
  durationMs: number;
  
  /**
   * Start timestamp
   */
  startTime: number;
  
  /**
   * End timestamp
   */
  endTime: number;
}

/**
 * Result of MCP code execution
 */
export interface MCPExecutionResult {
  /**
   * The result type indicating the outcome of the execution
   */
  resultType: 'success' | 'partial' | 'failure';
  
  /**
   * Timing information for each step
   */
  timings: StepTiming[];
  
  /**
   * Total execution time in milliseconds
   */
  totalDurationMs: number;
}

/**
 * CodeModeMCP - Main class for orchestrating LLM-powered MCP tool execution
 * 
 * This class coordinates three different LLM models with different specializations:
 * - tinyLLM: Fast filtering and option selection
 * - mainLLM: Code generation and execution
 * - strategyLLM: High-level strategic planning
 */
export class CodeModeMCP {
  private tinyLLM: LLMFunction;
  private mainLLM: LLMFunction;
  private strategyLLM: LLMFunction;
  private tools: ToolCatalog;
  private mcpProvider?: IMCPProvider;
  private runEnvironment?: IRunEnvironment;

  constructor(config: CodeModeMCPConfig) {
    this.tinyLLM = config.llms.tinyLLM;
    this.mainLLM = config.llms.mainLLM;
    this.strategyLLM = config.llms.strategyLLM;
    this.tools = config.tools || {};
    this.mcpProvider = config.mcpProvider;
    this.runEnvironment = config.runEnvironment;
  }

  /**
   * Run MCP code with the specified options
   * @param options Configuration for the execution run
   * @returns Promise that resolves with the execution result
   */
  async runMCPCode(options: RunMCPCodeOptions): Promise<MCPExecutionResult> {
    const {
      maxToolCalls,
      totalExecutionTimeout,
      toolCallTimeout,
      query,
      maxToolsPerPrompt = 20,
      maxConcurrentThreads = 8
    } = options;

    const overallStartTime = Date.now();
    const timings: StepTiming[] = [];

    console.log('Starting MCP code execution with options:', {
      maxToolCalls,
      totalExecutionTimeout,
      toolCallTimeout,
      query: query || 'No query provided',
      maxToolsPerPrompt,
      maxConcurrentThreads
    });

    // Step 1: Generate pseudocode using strategyLLM
    let startTime = Date.now();
    const pseudocodeResult = await generatePseudocode({
      query: query || '',
      catalog: this.tools,
      llmFunction: this.strategyLLM
    });
    let endTime = Date.now();
    timings.push({
      stepName: 'Generate Pseudocode (strategyLLM)',
      durationMs: endTime - startTime,
      startTime,
      endTime
    });

    // Step 2: Filter tools using tinyLLM with pseudocode guidance
    startTime = Date.now();
    const filterResult = await filterToolsForQuery({
      query: query || '',
      catalog: this.tools,
      llmFunction: this.tinyLLM,
      pseudocode: pseudocodeResult.pseudocode,
      maxToolsPerPrompt,
      maxConcurrentThreads
    });
    endTime = Date.now();
    timings.push({
      stepName: 'Filter Tools (tinyLLM)',
      durationMs: endTime - startTime,
      startTime,
      endTime
    });

    // Step 3: Generate TypeScript interfaces (in memory, no file I/O)
    startTime = Date.now();
    let interfacesCode = '';
    if (this.runEnvironment) {
      const generateResult = await generateToolsCode({
        catalog: filterResult.filteredCatalog,
        runEnvironment: this.runEnvironment,
        baseDir: '.'
      });

      interfacesCode = generateResult.interfacesCode;
      console.log(`\n✅ Interface generation complete:`);
      console.log(`   Interfaces generated: ${generateResult.filesGenerated}`);
      console.log(`   Total code size: ${interfacesCode.length} characters`);
    } else {
      console.log(`\n⚠️  Skipping code generation - no run environment configured`);
      throw new Error('Run environment is required for code generation');
    }
    endTime = Date.now();
    timings.push({
      stepName: 'Generate TypeScript Interfaces',
      durationMs: endTime - startTime,
      startTime,
      endTime
    });

    // Step 4: Use mainLLM to generate implementation based on pseudocode and interfaces
    startTime = Date.now();
    const implementResult = await implementCode({
      query: query || '',
      pseudocode: pseudocodeResult.pseudocode,
      interfacesCode,
      llmFunction: this.mainLLM
    });
    endTime = Date.now();
    timings.push({
      stepName: 'Implement Code (mainLLM)',
      durationMs: endTime - startTime,
      startTime,
      endTime
    });

    // Step 5: Verify TypeScript compilation (already done in implementCode, but track separately)
    startTime = Date.now();
    // (Compilation is done inside implementCode, so this is essentially instant)
    endTime = Date.now();
    timings.push({
      stepName: 'Verify TypeScript Compilation',
      durationMs: implementResult.compilesSuccessfully ? endTime - startTime : 0,
      startTime,
      endTime
    });

    // Print the output
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📝 GENERATED CODE:`);
    console.log(`${'='.repeat(80)}\n`);
    console.log(implementResult.fullProgram);
    console.log(`\n${'='.repeat(80)}`);
    
    if (implementResult.compilesSuccessfully) {
      console.log(`✅ Code compiles successfully!`);
    } else {
      console.log(`❌ Code has compilation errors:`);
      implementResult.compilationErrors.forEach(error => console.log(`   ${error}`));
    }
    console.log(`${'='.repeat(80)}\n`);

    // If compilation failed, return early
    if (!implementResult.compilesSuccessfully) {
      const totalDurationMs = Date.now() - overallStartTime;
      this.printTimingReport(timings, totalDurationMs);
      return {
        resultType: 'failure',
        timings,
        totalDurationMs
      };
    }

    // Step 6: Wire MCP tools and execute the code
    startTime = Date.now();
    const executeResult = await executeCode({
      mainCode: implementResult.fullProgram,
      catalog: filterResult.filteredCatalog,
      runEnvironment: this.runEnvironment!,
      baseDir: '.'
    });
    endTime = Date.now();
    timings.push({
      stepName: 'Wire and Execute Code',
      durationMs: endTime - startTime,
      startTime,
      endTime
    });

    // Calculate total duration
    const totalDurationMs = Date.now() - overallStartTime;

    // Print timing report
    this.printTimingReport(timings, totalDurationMs);

    // Return result based on execution success
    return {
      resultType: executeResult.success ? 'success' : 'failure',
      timings,
      totalDurationMs
    };
  }

  /**
   * Print a formatted timing report
   */
  private printTimingReport(timings: StepTiming[], totalDurationMs: number): void {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`⏱️  TIMING REPORT`);
    console.log(`${'='.repeat(80)}\n`);

    // Find the longest step name for alignment
    const maxNameLength = Math.max(...timings.map(t => t.stepName.length));

    // Print each step
    timings.forEach((timing, index) => {
      const paddedName = timing.stepName.padEnd(maxNameLength);
      const durationSec = (timing.durationMs / 1000).toFixed(2);
      const percentage = ((timing.durationMs / totalDurationMs) * 100).toFixed(1);
      const bar = this.createProgressBar(timing.durationMs, totalDurationMs, 30);
      
      console.log(`${index + 1}. ${paddedName}  ${durationSec}s  (${percentage}%)  ${bar}`);
    });

    console.log(`\n${'─'.repeat(80)}`);
    const totalSec = (totalDurationMs / 1000).toFixed(2);
    console.log(`   ${'TOTAL'.padEnd(maxNameLength)}  ${totalSec}s  (100.0%)\n`);
    console.log(`${'='.repeat(80)}\n`);
  }

  /**
   * Create a visual progress bar
   */
  private createProgressBar(value: number, max: number, width: number): string {
    const percentage = value / max;
    const filled = Math.round(percentage * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Get a response from the tiny LLM (for quick filtering tasks)
   */
  async useTinyLLM(message: string): Promise<string> {
    return this.tinyLLM(message);
  }

  /**
   * Get a response from the main LLM (for code generation)
   */
  async useMainLLM(message: string): Promise<string> {
    return this.mainLLM(message);
  }

  /**
   * Get a response from the strategy LLM (for high-level planning)
   */
  async useStrategyLLM(message: string): Promise<string> {
    return this.strategyLLM(message);
  }

  /**
   * Set or update the MCP provider
   */
  setMCPProvider(provider: IMCPProvider): void {
    this.mcpProvider = provider;
  }

  /**
   * Set or update the run environment
   */
  setRunEnvironment(environment: IRunEnvironment): void {
    this.runEnvironment = environment;
  }

  /**
   * Get the current MCP provider
   */
  getMCPProvider(): IMCPProvider | undefined {
    return this.mcpProvider;
  }

  /**
   * Get the current run environment
   */
  getRunEnvironment(): IRunEnvironment | undefined {
    return this.runEnvironment;
  }

  /**
   * Get the tool catalog
   */
  getToolCatalog(): ToolCatalog {
    return this.tools;
  }

  /**
   * Get a specific tool by path (e.g., 'slack.message.send')
   */
  getTool(path: string): MCPTool | null {
    return getToolByPath(this.tools, path);
  }

  /**
   * List all available tool paths
   */
  listToolPaths(): string[] {
    return listAllToolPaths(this.tools);
  }

  /**
   * Set/replace the tool catalog
   */
  setToolCatalog(catalog: ToolCatalog): void {
    this.tools = catalog;
  }
}

