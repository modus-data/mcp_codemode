import { OpenRouterClient, OpenAIClient, ILLMClient } from './model_clients/index.js';
import { 
  PipedreamProvider, 
  ComposioProvider,
  ComposioConfig,
  IMCPProvider,
  ToolFilterOptions,
  listAllToolPaths,
  getCatalogStructure,
  getToolsInCategory
} from './mcp_providers/index.js';

async function main() {
  // Example: Using OpenRouter client
//   console.log('=== OpenRouter Example ===');
//   const openRouterClient: ILLMClient = new OpenRouterClient();
//   const openRouterLLM = openRouterClient.getLLM('anthropic/claude-sonnet-4.5');
  
//   console.log('Sending message to OpenRouter...');
//   const openRouterResponse = await openRouterLLM('hello ai');
//   console.log('\nOpenRouter Response:');
//   console.log(openRouterResponse);

  // Example: Using MCP Providers
  // Uncomment to test when API keys are configured
  /*
  console.log('\n=== Pipedream Provider Example ===');
  const pipedreamProvider: IMCPProvider = new PipedreamProvider();
  const pipedreamCatalog = await pipedreamProvider.getTools();
  
  // View the hierarchical structure
  console.log('Pipedream catalog structure:');
  console.log(JSON.stringify(getCatalogStructure(pipedreamCatalog), null, 2));
  
  // List all available tool paths
  const pipedreamPaths = listAllToolPaths(pipedreamCatalog);
  console.log(`\nTotal Pipedream tools: ${pipedreamPaths.length}`);
  console.log('Sample tool paths:', pipedreamPaths.slice(0, 5));
  
  // Get a specific tool by path
  const specificTool = await pipedreamProvider.getTool('slack.message.send');
  if (specificTool) {
    console.log(`\nFound tool: ${specificTool.name}`);
    console.log(`Description: ${specificTool.description}`);
  }
  
  // Get all tools in a category
  const slackTools = getToolsInCategory(pipedreamCatalog, 'slack.message');
  console.log(`\nSlack message tools: ${Object.keys(slackTools).join(', ')}`);
  */
  console.log('\n=== Composio Provider Example ===');
  const composioConfig: ComposioConfig = {
    // API credentials will be read from environment if not provided
    // apiKey: 'your-api-key',
    // projectId: 'your-project-id',
    // userId: 'your-user-id',
    // connectedAccountId: 'your-connected-account-id' // needed for execution
  };
  const composioProvider: IMCPProvider = new ComposioProvider(composioConfig);
  
  // Filter by specific toolkits
  const filterOptions: ToolFilterOptions = {
    toolkits: ['slack', 'gmail']
    // No limit specified - will fetch enough to find these toolkits
  };
  const composioCatalog = await composioProvider.getTools(filterOptions);
  
  // View the hierarchical structure
  console.log('Composio catalog structure:');
  console.log(JSON.stringify(getCatalogStructure(composioCatalog), null, 2));
  
  // List all available tool paths
  const composioPaths = listAllToolPaths(composioCatalog);
  console.log(`\nTotal Composio tools: ${composioPaths.length}`);
  console.log('Sample tool paths:', composioPaths.slice(0, 5));
  
  // Get a specific tool by path
  const composioTool = await composioProvider.getTool('slack.message.send');
  if (composioTool) {
    console.log(`\nFound tool: ${composioTool.name}`);
    console.log(`Description: ${composioTool.description}`);
    
    // Execute the tool (requires connectedAccountId in constructor)
    // const result = await composioTool.execute({ 
    //   channel: '#general', 
    //   text: 'Hello from MCP!' 
    // });
  }
}

main().catch(console.error);


// const codeModeMCPRunner = initCodeModeMCP({
//     llmCallers: {
//       tinyLLMcaller: createTinyLLMCaller(), // used for sorting through massive amounts of options
//       mainLLMcaller: createMainLLMCaller(), // writing and executing the calling code
//       strategicLLMcaller: createStrategicLLMCaller(), // stratgic reasoning
//     },
//     execution: {
//       sandboxCreator: createSandboxCreator(), // creating the sandbox for the code to run in
  
//     }
  
//   });
  
//   codeModeMCPRunner.runMCPcode({
//     maxToolCalls: 100,
//     totalExecutionTimeout: 60,
//     toolCallTimeout: 10,
//   })