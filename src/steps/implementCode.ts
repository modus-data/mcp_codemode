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
  
  // Combine interfaces and implementation
  const fullProgram = `${interfacesCode}\n\n${implementationCode}`;
  
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
  
  return {
    implementationCode,
    compilesSuccessfully: compilationResult.success,
    compilationErrors: compilationResult.errors,
    fullProgram
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

IMPORTANT STRUCTURE REQUIREMENTS:

1. First, implement stub functions for each tool interface you see above.
   - Each stub function should be named exactly as shown in the interface (e.g., "post_message", "all_channels")
   - Use the corresponding Params interface (e.g., Post_messageParams, All_channelsParams)
   - Each stub should have a simple implementation that throws an error or returns mock data
   - Example:
     async function post_message(params: Post_messageParams): Promise<any> {
       // TODO: This would call the actual MCP tool
       console.log('Calling post_message with:', params);
       return { ok: true, ts: '1234567890.123456', channel: params.channel };
     }

2. Then, implement a main() function that:
   - Follows the strategic plan step by step
   - Calls the stub functions you created
   - Includes proper error handling (try/catch)
   - Logs progress to console
   - Returns a meaningful result object

3. Finally, add code to execute main():
   main()
     .then(result => console.log('Result:', result))
     .catch(error => console.error('Error:', error));

REQUIREMENTS:
- Do NOT import anything - this is a self-contained program
- Do NOT repeat the interface definitions (they're already provided above)
- Use async/await for all asynchronous operations
- Include descriptive console.log statements for debugging
- Handle all errors gracefully with try/catch
- Return structured results (objects with success/error fields)

OUTPUT FORMAT:
Provide ONLY TypeScript code, no explanations, no markdown formatting. Start with the stub function implementations, then the main function, then the execution code.`;
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
