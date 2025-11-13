import { ToolCatalog, MCPTool } from '../mcp_providers/types';
import { IRunEnvironment } from '../run_environments/types';
import { getToolByPath, listAllToolPaths } from '../mcp_providers/utils';
import * as ts from 'typescript';

/**
 * Options for code execution
 */
export interface ExecuteCodeOptions {
  /**
   * The generated main code that imports and uses the tool functions
   */
  mainCode: string;
  
  /**
   * The filtered tool catalog with actual MCP tools
   */
  catalog: ToolCatalog;
  
  /**
   * The run environment to execute code in
   */
  runEnvironment: IRunEnvironment;
  
  /**
   * Base directory for the execution
   */
  baseDir?: string;
}

/**
 * Result of code execution
 */
export interface ExecuteCodeResult {
  /**
   * Whether the execution was successful
   */
  success: boolean;
  
  /**
   * Output from the execution
   */
  output: string;
  
  /**
   * Error message if execution failed
   */
  error?: string;
  
  /**
   * Number of tools wired
   */
  toolsWired: number;
}

/**
 * Execute generated code by wiring MCP tools to function stubs
 * 
 * This function:
 * 1. Creates a tool registry from the catalog
 * 2. Generates runtime code that wires tool stubs to actual MCP tool executions
 * 3. Executes the complete program
 * 
 * @param options Execution options
 * @returns Promise that resolves with the execution result
 */
export async function executeCode(
  options: ExecuteCodeOptions
): Promise<ExecuteCodeResult> {
  const {
    mainCode,
    catalog,
    runEnvironment,
    baseDir = '.'
  } = options;
  
  console.log(`\n🔌 Wiring MCP Tools to Generated Code:`);
  
  // Get all tool paths from the catalog
  const allToolPaths = listAllToolPaths(catalog);
  console.log(`   Tools available: ${allToolPaths.length}`);
  
  if (allToolPaths.length === 0) {
    return {
      success: false,
      output: '',
      error: 'No tools available in catalog',
      toolsWired: 0
    };
  }
  
  // Build the tool functions object
  const toolFunctions = buildToolFunctions(catalog, allToolPaths);
  
  // Compile TypeScript to JavaScript
  const runnableCode = compileTypeScriptToJavaScript(mainCode);
  
  console.log(`   ✅ Wired ${allToolPaths.length} tools to execution environment`);
  console.log(`\n🚀 Executing generated code in-process...\n`);
  
  // Execute the code in-process with access to real tools
  try {
    const result = await executeInProcess(runnableCode, toolFunctions);
    
    console.log(`\n✅ Execution completed successfully`);
    console.log(`\n📤 Result:`);
    console.log(`${'─'.repeat(80)}`);
    console.log(JSON.stringify(result, null, 2));
    console.log(`${'─'.repeat(80)}\n`);
    
    return {
      success: true,
      output: JSON.stringify(result),
      toolsWired: allToolPaths.length
    };
  } catch (error: any) {
    console.error(`\n❌ Execution failed:`, error.message);
    console.error(error.stack);
    return {
      success: false,
      output: '',
      error: error.message,
      toolsWired: allToolPaths.length
    };
  }
}

/**
 * Build tool functions object that maps function names to actual tool.execute() calls
 */
function buildToolFunctions(catalog: ToolCatalog, toolPaths: string[]): Record<string, Function> {
  const toolFunctions: Record<string, Function> = {};
  
  for (const toolPath of toolPaths) {
    const tool = getToolByPath(catalog, toolPath);
    if (!tool) continue;
    
    // Convert tool path to function name
    const functionName = pathToFunctionName(toolPath);
    
    // Create a wrapper function that calls the actual tool
    toolFunctions[functionName] = async (params: any) => {
      console.log(`[MCP Tool Call] ${toolPath}`);
      console.log(`[Parameters]`, params);
      
      try {
        const result = await tool.execute(params);
        console.log(`[Result]`, result);
        return result;
      } catch (error) {
        console.error(`[Error calling ${toolPath}]`, error);
        throw error;
      }
    };
  }
  
  return toolFunctions;
}

/**
 * Execute code in-process with access to tool functions
 */
async function executeInProcess(code: string, toolFunctions: Record<string, Function>): Promise<any> {
  // Create an async function from the code
  // The code should define and call a main() function
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  
  // Inject tool functions into the execution context
  const contextVars = Object.keys(toolFunctions).join(', ');
  
  // Wrap the code to capture the result
  // Remove the main().then().catch() call and instead just define main, then we call it
  let processedCode = code;
  
  // Remove the main() execution at the end (main().then(...).catch(...))
  processedCode = processedCode.replace(/main\s*\(\s*\)\s*\.then\([^)]+\)\s*\.catch\([^)]+\);?\s*$/s, '');
  processedCode = processedCode.replace(/main\s*\(\s*\)\s*\.then\([^)]+\);?\s*$/s, '');
  
  const wrappedCode = `
    const { ${contextVars} } = toolFunctions;
    ${processedCode}
    // Execute main and return its result
    return await main();
  `;
  
  // Create and execute the function
  const func = new AsyncFunction('toolFunctions', wrappedCode);
  return await func(toolFunctions);
}

/**
 * Convert a tool path to a function name
 * e.g., "slack.chat.post_message" -> "SLACK_CHAT_POST_MESSAGE"
 */
function pathToFunctionName(toolPath: string): string {
  return toolPath
    .split('.')
    .join('_')
    .toUpperCase();
}

/**
 * Compile TypeScript code to JavaScript using the TypeScript compiler
 */
function compileTypeScriptToJavaScript(tsCode: string): string {
  const result = ts.transpileModule(tsCode, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      removeComments: false,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      strict: false,
    }
  });
  
  return result.outputText;
}

