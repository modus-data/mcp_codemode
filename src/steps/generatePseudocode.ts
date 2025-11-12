import { LLMFunction } from '../model_clients/types';
import { ToolCatalog } from '../mcp_providers/types';
import { listAllToolPaths, getToolByPath } from '../mcp_providers/utils';

/**
 * Options for generating pseudocode
 */
export interface GeneratePseudocodeOptions {
  /**
   * The user query to generate pseudocode for
   */
  query: string;
  
  /**
   * The full tool catalog (for context about available capabilities)
   */
  catalog: ToolCatalog;
  
  /**
   * The LLM function to use for pseudocode generation (typically strategyLLM)
   */
  llmFunction: LLMFunction;
}

/**
 * Result of pseudocode generation
 */
export interface GeneratePseudocodeResult {
  /**
   * The generated pseudocode outlining the approach
   */
  pseudocode: string;
  
  /**
   * Total number of tools available in the catalog
   */
  totalToolsAvailable: number;
}

/**
 * Generate pseudocode for accomplishing a task using strategyLLM
 * 
 * This function:
 * 1. Takes the user query and available tools catalog
 * 2. Uses the strategy LLM to think through the approach at a high level
 * 3. Generates pseudocode that outlines the steps needed
 * 4. This pseudocode is then used to guide tool filtering
 * 
 * @param options Pseudocode generation options
 * @returns Promise that resolves with the pseudocode result
 */
export async function generatePseudocode(
  options: GeneratePseudocodeOptions
): Promise<GeneratePseudocodeResult> {
  const {
    query,
    catalog,
    llmFunction
  } = options;
  
  // Get overview of available tools
  const allToolPaths = listAllToolPaths(catalog);
  const totalToolsAvailable = allToolPaths.length;
  
  console.log(`\n🧠 Generating pseudocode with strategyLLM:`);
  console.log(`   User query: "${query}"`);
  console.log(`   Total tools available: ${totalToolsAvailable}`);
  
  // Create a high-level overview of available tool categories
  const toolCategories = getToolCategoriesOverview(catalog, allToolPaths);
  
  // Create the prompt for pseudocode generation
  const prompt = `
You are a strategic planning assistant. Your task is to analyze a user's request and write TypeScript-style pseudocode that outlines how to accomplish the task.

Given:
- User Query: "${query}"
- Available Tool Categories: ${toolCategories}

Write pseudocode that looks like actual TypeScript code showing:
- Function calls with approximate parameters (even if you don't know exact signatures)
- Variable assignments to store results
- Data flow showing how results from one call are passed to the next
- Loops and conditionals where needed
- Comments explaining the logic

Don't worry about exact function names or signatures - use your best guess based on what makes sense.

Example:
\`\`\`typescript
// Get all channels from Slack
const channels = await slack.list.all_channels();

// Filter for channels that start with 'test'
const testChannels = channels.filter(ch => ch.name.startsWith('test'));

// Send message to each test channel
for (const channel of testChannels) {
  const message = await slack.send_message({
    channel_id: channel.id,
    text: "Hello from bot"
  });
}

// Also filter channels starting with 'e'
const eChannels = channels.filter(ch => ch.name.startsWith('e'));

// For each e-channel, set emoji on messages
for (const channel of eChannels) {
  const messages = await slack.get_messages({ channel_id: channel.id });
  for (const msg of messages) {
    await slack.add_reaction({ message_id: msg.id, emoji: "thumbsup" });
  }
}
\`\`\`

Generate the TypeScript-style pseudocode now:
`;
  
  console.log(`   Calling strategyLLM...`);
  
  try {
    const pseudocode = await llmFunction(prompt);
    
    console.log(`   ✅ Pseudocode generated successfully`);
    console.log(`\n📝 Generated Pseudocode:`);
    console.log('   ' + pseudocode.split('\n').join('\n   '));
    console.log('');
    
    return {
      pseudocode,
      totalToolsAvailable
    };
  } catch (error) {
    console.error(`   ⚠️  Error generating pseudocode: ${error}`);
    // Return a basic fallback pseudocode
    const fallbackPseudocode = `
// Analyze the user query: "${query}"
// Execute required operations using available tools
const result = await executeTask();
`;
    return {
      pseudocode: fallbackPseudocode,
      totalToolsAvailable
    };
  }
}

/**
 * Get a high-level overview of tool categories from the catalog
 * @param catalog The tool catalog
 * @param allToolPaths All tool paths in the catalog
 * @returns A formatted string describing tool categories
 */
function getToolCategoriesOverview(
  catalog: ToolCatalog,
  allToolPaths: string[]
): string {
  // Group tools by their top-level category
  const categories = new Map<string, number>();
  const categoryTools = new Map<string, string[]>();
  
  for (const path of allToolPaths) {
    const topLevel = path.split('.')[0];
    categories.set(topLevel, (categories.get(topLevel) || 0) + 1);
    
    if (!categoryTools.has(topLevel)) {
      categoryTools.set(topLevel, []);
    }
    categoryTools.get(topLevel)!.push(path);
  }
  
  // Create overview string
  const overview: string[] = [];
  for (const [category, count] of categories.entries()) {
    const tools = categoryTools.get(category) || [];
    const sampleTools = tools.slice(0, 3).join(', ');
    const moreText = tools.length > 3 ? `, and ${tools.length - 3} more` : '';
    overview.push(`${category} (${count} tools: ${sampleTools}${moreText})`);
  }
  
  return overview.join('; ');
}

