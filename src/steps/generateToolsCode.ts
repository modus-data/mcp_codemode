import * as ts from 'typescript';
import { ToolCatalog, MCPTool } from '../mcp_providers/types';
import { IRunEnvironment } from '../run_environments/types';
import { getToolByPath, listAllToolPaths } from '../mcp_providers/utils';
import * as path from 'path';

/**
 * Options for generating tool code
 */
export interface GenerateToolsCodeOptions {
  /**
   * The filtered tool catalog to generate code for
   */
  catalog: ToolCatalog;
  
  /**
   * The run environment to use for file operations
   */
  runEnvironment: IRunEnvironment;
  
  /**
   * Base directory where the functions folder will be created
   * @default "."
   */
  baseDir?: string;
}

/**
 * Result of code generation operation
 */
export interface GenerateToolsCodeResult {
  /**
   * Number of files generated
   */
  filesGenerated: number;
  
  /**
   * Paths of all generated files relative to baseDir
   */
  generatedFiles: string[];
  
  /**
   * Base directory where files were created
   */
  outputDir: string;
  
  /**
   * Generated interfaces code (in-memory)
   */
  interfacesCode: string;
  
  /**
   * Map of tool paths to their interface code
   */
  toolInterfaces: Map<string, string>;
}

/**
 * Generate TypeScript code files for tools in the catalog
 * 
 * This function:
 * 1. Creates a hierarchical folder structure under functions/
 * 2. Generates TypeScript files with function signatures for each tool
 * 3. Uses TypeScript's compiler API for proper AST generation
 * 4. Leaves function bodies empty
 * 
 * @param options Generation options
 * @returns Promise that resolves with the generation result
 */
export async function generateToolsCode(
  options: GenerateToolsCodeOptions
): Promise<GenerateToolsCodeResult> {
  const {
    catalog,
    runEnvironment,
    baseDir = '.'
  } = options;
  
  // baseDir is relative to the environment's working directory
  const outputDir = path.join(baseDir, 'functions');
  const allToolPaths = listAllToolPaths(catalog);
  
  console.log(`\n🔨 Generating TypeScript Interfaces (in-memory):`);
  console.log(`   Total tools to generate: ${allToolPaths.length}`);
  
  if (allToolPaths.length === 0) {
    console.log(`   ⚠️  No tools to generate`);
    return {
      filesGenerated: 0,
      generatedFiles: [],
      outputDir,
      interfacesCode: '',
      toolInterfaces: new Map()
    };
  }
  
  const toolInterfaces = new Map<string, string>();
  let interfacesCode = '';
  
  // Process each tool - generate interfaces in memory
  for (const toolPath of allToolPaths) {
    const tool = getToolByPath(catalog, toolPath);
    if (!tool) continue;
    
    const interfaceCode = generateToolInterfaceCode(tool, toolPath);
    toolInterfaces.set(toolPath, interfaceCode);
    
    // Add tool path and name as a comment, then the interface
    interfacesCode += `// Tool: ${toolPath}\n`;
    interfacesCode += `// Function name: ${tool.name}\n`;
    interfacesCode += interfaceCode;
    interfacesCode += '\n\n';
    
    console.log(`   ✅ Generated interface: ${toolPath} -> ${tool.name}()`);
  }
  
  console.log(`\n   📦 Summary:`);
  console.log(`   Interfaces generated: ${toolInterfaces.size}`);
  console.log(`   Total code size: ${interfacesCode.length} characters`);
  
  return {
    filesGenerated: toolInterfaces.size,
    generatedFiles: Array.from(toolInterfaces.keys()),
    outputDir,
    interfacesCode,
    toolInterfaces
  };
}

/**
 * Generate a TypeScript file for a single tool
 */
async function generateToolFile(
  runEnvironment: IRunEnvironment,
  baseDir: string,
  toolPath: string,
  tool: MCPTool
): Promise<{ relativePath: string; fullPath: string }> {
  // Split the tool path into parts
  const parts = toolPath.split('.');
  const fileName = parts[parts.length - 1];
  const directories = parts.slice(0, -1);
  
  // Create the directory path
  let currentPath = baseDir;
  for (const dir of directories) {
    currentPath = path.join(currentPath, dir);
    await createDirectory(runEnvironment, currentPath);
  }
  
  // Generate the TypeScript code
  const code = generateToolFunctionCode(tool);
  
  // Write the file
  const fullPath = path.join(currentPath, `${fileName}.ts`);
  await writeFile(runEnvironment, fullPath, code);
  
  const relativePath = path.relative(baseDir, fullPath);
  return { relativePath, fullPath };
}

/**
 * Generate only the TypeScript interface for a tool (no implementation)
 */
function generateToolInterfaceCode(tool: MCPTool, toolPath: string): string {
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
  });
  
  // Create parameter type interface
  const interfaceName = `${capitalize(tool.name)}Params`;
  const interfaceMembers = tool.parameters.map(param => 
    ts.factory.createPropertySignature(
      undefined,
      ts.factory.createIdentifier(param.name),
      param.required 
        ? undefined 
        : ts.factory.createToken(ts.SyntaxKind.QuestionToken),
      ts.factory.createTypeReferenceNode(
        mapTypeStringToTSType(param.type)
      )
    )
  );
  
  const paramInterface = ts.factory.createInterfaceDeclaration(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createIdentifier(interfaceName),
    undefined,
    undefined,
    interfaceMembers
  );
  
  // Add JSDoc comment to interface
  const paramsDoc = tool.parameters.map(param => 
    ` * @param ${param.name} ${param.description} (${param.type}${param.required ? ', required' : ', optional'})`
  ).join('\n');
  
  const interfaceWithComment = ts.addSyntheticLeadingComment(
    paramInterface,
    ts.SyntaxKind.MultiLineCommentTrivia,
    `*\n * Parameters for ${tool.name}\n * ${tool.description}\n *\n${paramsDoc}\n `,
    true
  );
  
  // Create source file for printing
  const sourceFile = ts.createSourceFile(
    'temp.ts',
    '',
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS
  );
  
  const interfaceCode = printer.printNode(
    ts.EmitHint.Unspecified,
    interfaceWithComment,
    sourceFile
  );
  
  // Just return the interface - mainLLM will implement the functions
  return interfaceCode;
}

/**
 * Generate TypeScript code for a tool using the TypeScript compiler API
 */
function generateToolFunctionCode(tool: MCPTool): string {
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
  });
  
  // Create parameter type interface
  const interfaceName = `${capitalize(tool.name)}Params`;
  const interfaceMembers = tool.parameters.map(param => 
    ts.factory.createPropertySignature(
      undefined,
      ts.factory.createIdentifier(param.name),
      param.required 
        ? undefined 
        : ts.factory.createToken(ts.SyntaxKind.QuestionToken),
      ts.factory.createTypeReferenceNode(
        mapTypeStringToTSType(param.type)
      )
    )
  );
  
  const paramInterface = ts.factory.createInterfaceDeclaration(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createIdentifier(interfaceName),
    undefined,
    undefined,
    interfaceMembers
  );
  
  // Add JSDoc comment to interface
  const interfaceWithComment = ts.addSyntheticLeadingComment(
    paramInterface,
    ts.SyntaxKind.MultiLineCommentTrivia,
    `*\n * Parameters for ${tool.name}\n * ${tool.description}\n `,
    true
  );
  
  // Create the function
  const functionParams = [
    ts.factory.createParameterDeclaration(
      undefined,
      undefined,
      ts.factory.createIdentifier('params'),
      undefined,
      ts.factory.createTypeReferenceNode(interfaceName),
      undefined
    )
  ];
  
  const functionDeclaration = ts.factory.createFunctionDeclaration(
    [
      ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
      ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)
    ],
    undefined,
    ts.factory.createIdentifier(tool.name),
    undefined,
    functionParams,
    ts.factory.createTypeReferenceNode(
      'Promise',
      [ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)]
    ),
    ts.factory.createBlock(
      [
        ts.factory.createThrowStatement(
          ts.factory.createNewExpression(
            ts.factory.createIdentifier('Error'),
            undefined,
            [ts.factory.createStringLiteral('Not implemented')]
          )
        )
      ],
      true
    )
  );
  
  // Add JSDoc comment to function
  const paramsDoc = tool.parameters.map(param => 
    ` * @param params.${param.name} ${param.description} (${param.type}${param.required ? ', required' : ', optional'})`
  ).join('\n');
  
  const functionWithComment = ts.addSyntheticLeadingComment(
    functionDeclaration,
    ts.SyntaxKind.MultiLineCommentTrivia,
    `*\n * ${tool.description}\n *\n${paramsDoc}\n * @returns Promise<any>\n `,
    true
  );
  
  // Create source file
  const sourceFile = ts.createSourceFile(
    'temp.ts',
    '',
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS
  );
  
  // Print both declarations
  const interfaceCode = printer.printNode(
    ts.EmitHint.Unspecified,
    interfaceWithComment,
    sourceFile
  );
  
  const functionCode = printer.printNode(
    ts.EmitHint.Unspecified,
    functionWithComment,
    sourceFile
  );
  
  return `${interfaceCode}\n\n${functionCode}\n`;
}

/**
 * Map parameter type string to TypeScript type
 */
function mapTypeStringToTSType(typeString: string): string {
  const lowerType = typeString.toLowerCase();
  
  if (lowerType.includes('string')) return 'string';
  if (lowerType.includes('number') || lowerType.includes('int')) return 'number';
  if (lowerType.includes('boolean') || lowerType.includes('bool')) return 'boolean';
  if (lowerType.includes('array')) return 'any[]';
  if (lowerType.includes('object')) return 'Record<string, any>';
  
  // Default to any for complex or unknown types
  return 'any';
}

/**
 * Capitalize the first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Create a directory using the run environment's filesystem
 */
async function createDirectory(
  runEnvironment: IRunEnvironment,
  dirPath: string
): Promise<void> {
  const code = `
const fs = require('fs');
const dirPath = ${JSON.stringify(dirPath)};

if (!fs.existsSync(dirPath)) {
  fs.mkdirSync(dirPath, { recursive: true });
}
`;
  
  await runEnvironment.execute(code, { language: 'node' });
}

/**
 * Write a file using the run environment's filesystem
 */
async function writeFile(
  runEnvironment: IRunEnvironment,
  filePath: string,
  content: string
): Promise<void> {
  const code = `
const fs = require('fs');
const filePath = ${JSON.stringify(filePath)};
const content = ${JSON.stringify(content)};

fs.writeFileSync(filePath, content, 'utf-8');
`;
  
  await runEnvironment.execute(code, { language: 'node' });
}

