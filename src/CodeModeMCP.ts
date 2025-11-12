import { LLMFunction } from './model_clients/types';
import { IMCPProvider, MCPTool, ToolCatalog } from './mcp_providers/types';
import { IRunEnvironment } from './run_environments/types';
import { getToolByPath, listAllToolPaths } from './mcp_providers/utils';
import { generatePseudocode, filterToolsForQuery, generateToolsCode } from './steps';

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
 * Result of MCP code execution
 */
export interface MCPExecutionResult {
  /**
   * The result type indicating the outcome of the execution
   */
  resultType: 'success' | 'partial' | 'failure';
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

    console.log('Starting MCP code execution with options:', {
      maxToolCalls,
      totalExecutionTimeout,
      toolCallTimeout,
      query: query || 'No query provided',
      maxToolsPerPrompt,
      maxConcurrentThreads
    });

    // Step 1: Generate pseudocode using strategyLLM
    const pseudocodeResult = await generatePseudocode({
      query: query || '',
      catalog: this.tools,
      llmFunction: this.strategyLLM
    });

    // Step 2: Filter tools using tinyLLM with pseudocode guidance
    const filterResult = await filterToolsForQuery({
      query: query || '',
      catalog: this.tools,
      llmFunction: this.tinyLLM,
      pseudocode: pseudocodeResult.pseudocode,
      maxToolsPerPrompt,
      maxConcurrentThreads
    });

    // Step 3: Generate TypeScript code for filtered tools
    if (this.runEnvironment) {
      const generateResult = await generateToolsCode({
        catalog: filterResult.filteredCatalog,
        runEnvironment: this.runEnvironment,
        baseDir: '.'  // Relative to the environment's working directory
      });

      console.log(`\n✅ Code generation complete:`);
      console.log(`   Files generated: ${generateResult.filesGenerated}`);
      console.log(`   Output directory: ${generateResult.outputDir}`);
      console.log(`   Location: ${this.runEnvironment.getWorkingDirectory()}`);
    } else {
      console.log(`\n⚠️  Skipping code generation - no run environment configured`);
    }

    // TODO: Continue with the rest of the execution loop
    // 3. Use strategyLLM to plan the approach
    // 4. Use mainLLM to generate code and orchestrate execution
    // 5. Use runEnvironment to execute code safely
    
    throw new Error('runMCPCode not yet fully implemented');
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

