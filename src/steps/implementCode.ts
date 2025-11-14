import * as ts from 'typescript';
import { LLMFunction } from '../model_clients/types';

/**
 * Options for implementing code with mainLLM
 */
export interface ImplementCodeOptions {
  /**
   * The pseudocode plan from strategyLLM
   */
  pseudocode: string;
  
  /**
   * The generated TypeScript interfaces
   */
  interfacesCode: string;
  
  /**
   * User query/task
   */
  query: string;
  
  /**
   * The mainLLM function to use for code generation
   */
  llmFunction: LLMFunction;
}

/**
 * Result of code implementation
 */
export interface ImplementCodeResult {
  /**
   * The generated implementation code
   */
  implementationCode: string;
  
  /**
   * Whether the code compiles successfully
   */
  compilesSuccessfully: boolean;
  
  /**
   * Compilation errors if any
   */
  compilationErrors: string[];
  
  /**
   * Full TypeScript program (interfaces + implementation)
   */
  fullProgram: string;
}

/**
 * Implement code using mainLLM based on pseudocode and interfaces
 * 
 * This function:
 * 1. Sends the pseudocode and interfaces to mainLLM
 * 2. Asks mainLLM to generate actual implementation code
 * 3. Verifies TypeScript compilation in memory
 * 4. Returns the complete program
 * 
 * @param options Implementation options
 * @returns Promise that resolves with the implementation result
 */
export async function implementCode(
  options: ImplementCodeOptions
): Promise<ImplementCodeResult> {
  const {
    pseudocode,
    interfacesCode,
    query,
    llmFunction
  } = options;
  
  console.log(`\n🤖 Generating Implementation with mainLLM:`);
  console.log(`   Query: ${query}`);
  console.log(`   Interfaces size: ${interfacesCode.length} characters`);
  console.log(`   Pseudocode size: ${pseudocode.length} characters`);
  
  // Create prompt for mainLLM
  const prompt = createImplementationPrompt(query, pseudocode, interfacesCode);
  
  // Get implementation from mainLLM
  console.log(`   🔄 Calling mainLLM...`);
  const implementationCode = await llmFunction(prompt);
  console.log(`   ✅ Received implementation (${implementationCode.length} characters)`);
  
  // Generate function declarations for the tool functions
  const functionDeclarations = generateFunctionDeclarations(interfacesCode);
  
  // Combine interfaces, function declarations, and implementation
  const fullProgram = `${interfacesCode}\n\n${functionDeclarations}\n\n${implementationCode}`;
  
  // Verify TypeScript compilation
  console.log(`   🔍 Verifying TypeScript compilation...`);
  const compilationResult = verifyTypeScriptCompilation(fullProgram);
  
  if (compilationResult.success) {
    console.log(`   ✅ TypeScript compilation successful!`);
  } else {
    console.log(`   ❌ TypeScript compilation failed:`);
    compilationResult.errors.forEach(error => {
      console.log(`      - ${error}`);
    });
  }
  
  // Return the implementation code (just the main function, not the declarations)
  // The fullProgram includes declarations for verification, but we return just the implementation
  return {
    implementationCode,
    compilesSuccessfully: compilationResult.success,
    compilationErrors: compilationResult.errors,
    fullProgram: implementationCode // Return only the implementation, not the declarations
  };
}

/**
 * Create the prompt for mainLLM to generate implementation
 */
function createImplementationPrompt(
  query: string,
  pseudocode: string,
  interfacesCode: string
): string {
  return `You are a TypeScript code generator. Your task is to implement working code based on a strategic plan and TypeScript interface definitions.

USER QUERY:
${query}

STRATEGIC PLAN (from strategyLLM):
${pseudocode}

AVAILABLE TOOL PARAMETER INTERFACES:
${interfacesCode}

YOUR TASK:
Generate a complete, self-contained TypeScript program that follows the strategic plan.

CRITICAL: The tool functions are ALREADY IMPLEMENTED and will be available at runtime.
Each tool function is named with uppercase and underscores matching the tool path.

For example:
- Tool path: slack.list.all_channels → Function name: SLACK_LIST_ALL_CHANNELS
- Tool path: slack.chat.post_message → Function name: SLACK_CHAT_POST_MESSAGE
- Tool path: slack.add.reaction_to_an_item → Function name: SLACK_ADD_REACTION_TO_AN_ITEM

IMPORTANT - Response Structure:
Tool responses follow this structure:
{
  data: { /* actual response data here */ },
  successful: boolean,
  error: any,
  log_id: string
}

For example, SLACK_LIST_ALL_CHANNELS returns:
{
  data: {
    channels: [...],
    ok: true,
    response_metadata: { next_cursor: '...' }
  },
  successful: true,
  error: null
}

So to access channels, use: response.data.channels (NOT response.channels)

IMPORTANT STRUCTURE REQUIREMENTS:

1. Implement a main() function that:
   - Follows the strategic plan step by step
   - CALLS the provided tool functions (they're already implemented - don't create them!)
   - Use the function names in UPPERCASE_WITH_UNDERSCORES format
   - Pass parameters using the Params interfaces provided
   - Includes proper error handling (try/catch)
   - Logs progress to console
   - Returns a meaningful result object
   
   Example:
     async function main() {
       try {
         // Call the already-implemented tool function
         const result = await SLACK_LIST_ALL_CHANNELS({ limit: 100 });
         const channels = result.channels;
         
         for (const channel of channels) {
           await SLACK_CHAT_POST_MESSAGE({
             channel: channel.id,
             markdown_text: 'Hello!'
           });
         }
         
         return { success: true };
       } catch (error) {
         console.error('Error:', error);
         return { success: false, error };
       }
     }

2. Finally, add code to execute main():
   main()
     .then(result => console.log('Result:', result))
     .catch(error => console.error('Error:', error));

REQUIREMENTS:
- Do NOT import anything - this is a self-contained program
- Do NOT repeat the interface definitions (they're already provided above)
- Do NOT implement the tool functions - they are already available!
- Use async/await for all asynchronous operations
- Include descriptive console.log statements for debugging
- Handle all errors gracefully with try/catch
- Return structured results (objects with success/error fields)
- Use concurrency with Promise.all when possible to speed up the execution

OUTPUT FORMAT:
Provide ONLY TypeScript code, no explanations, no markdown formatting. Start with the main function, then the execution code.`;
}

/**
 * Generate function declarations for tool functions based on interfaces
 */
function generateFunctionDeclarations(interfacesCode: string): string {
  const declarations: string[] = [];
  
  // Extract all interface names that end with "Params"
  const interfaceRegex = /export\s+interface\s+(\w+Params)\s*\{/g;
  let match;
  
  while ((match = interfaceRegex.exec(interfacesCode)) !== null) {
    const paramsInterfaceName = match[1];
    // Convert e.g. "SLACK_LIST_ALL_CHANNELSParams" to "SLACK_LIST_ALL_CHANNELS"
    const functionName = paramsInterfaceName.replace(/Params$/, '');
    
    // Generate a declare function statement
    declarations.push(`declare function ${functionName}(params: ${paramsInterfaceName}): Promise<any>;`);
  }
  
  return declarations.join('\n');
}

/**
 * Verify TypeScript compilation in memory
 */
function verifyTypeScriptCompilation(
  code: string
): { success: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    // Create a source file
    const sourceFile = ts.createSourceFile(
      'program.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    
    // Create compiler options - lenient for generated code
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      strict: false,
      noEmit: true,
      skipLibCheck: true,
      noImplicitAny: false,
      noImplicitThis: false,
      strictNullChecks: false,
      strictFunctionTypes: false,
      strictBindCallApply: false,
      strictPropertyInitialization: false,
      noImplicitReturns: false,
      noFallthroughCasesInSwitch: false,
      allowUnreachableCode: true,
      allowUnusedLabels: true
    };
    
    // Create a program
    const host = ts.createCompilerHost(compilerOptions);
    
    // Override getSourceFile to return our in-memory source file
    const originalGetSourceFile = host.getSourceFile;
    host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
      if (fileName === 'program.ts') {
        return sourceFile;
      }
      return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    };
    
    // Create program
    const program = ts.createProgram(['program.ts'], compilerOptions, host);
    
    // Get diagnostics
    const diagnostics = [
      ...program.getSyntacticDiagnostics(sourceFile),
      ...program.getSemanticDiagnostics(sourceFile)
    ];
    
    // Collect error messages
    diagnostics.forEach(diagnostic => {
      if (diagnostic.file && diagnostic.start !== undefined) {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        errors.push(`Line ${line + 1}:${character + 1} - ${message}`);
      } else {
        errors.push(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      }
    });
    
    return {
      success: errors.length === 0,
      errors
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Compilation error: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}
