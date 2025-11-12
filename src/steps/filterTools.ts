import { LLMFunction } from '../model_clients/types';
import { MCPTool, ToolCatalog } from '../mcp_providers/types';
import { getToolByPath, listAllToolPaths } from '../mcp_providers/utils';

/**
 * Options for filtering tools
 */
export interface FilterToolsOptions {
  /**
   * The user query to filter tools for
   */
  query: string;
  
  /**
   * The tool catalog to filter
   */
  catalog: ToolCatalog;
  
  /**
   * The LLM function to use for filtering
   */
  llmFunction: LLMFunction;
  
  /**
   * Maximum number of tools to include per LLM prompt
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
 * Result of tool filtering operation
 */
export interface FilterToolsResult {
  /**
   * The filtered catalog with the same hierarchical structure
   */
  filteredCatalog: ToolCatalog;
  
  /**
   * Total number of tools in the original catalog
   */
  totalTools: number;
  
  /**
   * Number of tools selected after filtering
   */
  selectedTools: number;
  
  /**
   * Paths of the selected tools
   */
  selectedPaths: string[];
}

/**
 * Filter tools from the catalog based on query relevance using an LLM
 * 
 * This function:
 * 1. Flattens the hierarchical catalog to get all tool paths
 * 2. Batches tools based on maxToolsPerPrompt
 * 3. Processes batches in parallel (up to maxConcurrentThreads)
 * 4. Reconstructs the filtered catalog with the same hierarchical structure
 * 5. Prints comprehensive statistics
 * 
 * @param options Filtering options
 * @returns Promise that resolves with the filtering result
 */
export async function filterToolsForQuery(
  options: FilterToolsOptions
): Promise<FilterToolsResult> {
  const {
    query,
    catalog,
    llmFunction,
    maxToolsPerPrompt = 20,
    maxConcurrentThreads = 20
  } = options;
  
  // Flatten the catalog to get all tools with their paths
  const allToolPaths = listAllToolPaths(catalog);
  const totalTools = allToolPaths.length;
  
  console.log(`\n📊 Tool Filtering Statistics:`);
  console.log(`   Total tools in catalog: ${totalTools}`);
  
  if (totalTools === 0) {
    console.log(`   ✅ Selected tools: 0 (catalog is empty)`);
    return {
      filteredCatalog: {},
      totalTools: 0,
      selectedTools: 0,
      selectedPaths: []
    };
  }
  
  console.log(`\n   All available tools:`);
  allToolPaths.forEach(path => console.log(`     - ${path}`));
  console.log('');
  
  // Get full tool details for each path
  const allTools = allToolPaths.map(path => ({
    path,
    tool: getToolByPath(catalog, path)!
  }));
  
  // Split tools into batches
  const batches: Array<typeof allTools> = [];
  for (let i = 0; i < allTools.length; i += maxToolsPerPrompt) {
    batches.push(allTools.slice(i, i + maxToolsPerPrompt));
  }
  
  console.log(`   Batches to process: ${batches.length} (${maxToolsPerPrompt} tools per batch)`);
  console.log(`   Max concurrent threads: ${maxConcurrentThreads}`);
  console.log(`   Filtering tools with tinyLLM...`);
  
  // Process batches in parallel with concurrency limit
  const selectedPaths: string[] = [];
  
  for (let i = 0; i < batches.length; i += maxConcurrentThreads) {
    const batchSlice = batches.slice(i, i + maxConcurrentThreads);
    const promises = batchSlice.map(batch => 
      filterToolBatch(batch, query, llmFunction)
    );
    const results = await Promise.all(promises);
    
    // Collect all selected paths
    results.forEach(result => {
      selectedPaths.push(...result);
    });
    
    console.log(`   Progress: ${Math.min(i + maxConcurrentThreads, batches.length)}/${batches.length} batches processed`);
  }
  
  console.log(`   ✅ Selected tools: ${selectedPaths.length} out of ${totalTools}`);
  
  if (selectedPaths.length > 0) {
    console.log(`   Selected tools with descriptions:`);
    selectedPaths.forEach(path => {
      const tool = getToolByPath(catalog, path);
      if (tool) {
        console.log(`     - ${path}`);
        console.log(`       Description: ${tool.description}`);
      } else {
        console.log(`     - ${path}`);
      }
    });
  }
  
  // Reconstruct the filtered catalog with the same structure
  const filteredCatalog = reconstructCatalog(catalog, selectedPaths);
  
  return {
    filteredCatalog,
    totalTools,
    selectedTools: selectedPaths.length,
    selectedPaths
  };
}

/**
 * Filter a batch of tools using the LLM
 * @param batch Array of tools with their paths
 * @param query The user query
 * @param llmFunction The LLM function to use
 * @returns Array of selected tool paths
 */
async function filterToolBatch(
  batch: Array<{ path: string; tool: MCPTool }>,
  query: string,
  llmFunction: LLMFunction
): Promise<string[]> {
  // Create a prompt for the LLM
  const toolDescriptions = batch.map((item, index) => {
    const params = item.tool.parameters
      .map(p => `${p.name}: ${p.type}${p.required ? ' (required)' : ''}`)
      .join(', ');
    return `${index + 1}. ${item.path}\n   Description: ${item.tool.description}\n   Parameters: ${params}`;
  }).join('\n\n');
  
  const prompt = `
Select ONLY the tools that are directly relevant and necessary to accomplish the provided task.
Be permissive - select the most relevant tools, even if they are not strictly necessary.

Respond with ONLY the numbers of relevant tools, comma-separated (e.g., "1,3,5").
If no tools are relevant, respond with "none".

Given this user query: "${query}"

Available tools:
${toolDescriptions}
`;
  
  try {
    const response = await llmFunction(prompt);
    
    // Parse the response
    const trimmedResponse = response.trim().toLowerCase();
    
    if (trimmedResponse === 'none' || trimmedResponse === '') {
      return [];
    }
    
    // Extract numbers from the response
    const selectedIndices = trimmedResponse
      .split(',')
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n) && n >= 1 && n <= batch.length);
    
    // Convert indices to paths
    return selectedIndices.map(idx => batch[idx - 1].path);
  } catch (error) {
    console.error(`   ⚠️  Error filtering batch: ${error}`);
    // On error, return all paths in the batch to be safe
    return batch.map(item => item.path);
  }
}

/**
 * Reconstruct the hierarchical catalog structure from selected tool paths
 * @param originalCatalog The original catalog to get tools from
 * @param selectedPaths Array of tool paths to include
 * @returns Reconstructed catalog with the same structure
 */
function reconstructCatalog(
  originalCatalog: ToolCatalog,
  selectedPaths: string[]
): ToolCatalog {
  const catalog: ToolCatalog = {};
  
  for (const path of selectedPaths) {
    const tool = getToolByPath(originalCatalog, path);
    if (!tool) continue;
    
    const parts = path.split('.');
    let current: any = catalog;
    
    // Navigate/create the nested structure
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }
    
    // Add the tool at the final position
    const lastPart = parts[parts.length - 1];
    current[lastPart] = tool;
  }
  
  return catalog;
}

