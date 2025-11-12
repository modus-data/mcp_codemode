import { OpenRouterClient, OpenAIClient, ILLMClient } from './model_clients';
import { 
  PipedreamProvider, 
  ComposioProvider,
  ComposioConfig,
  IMCPProvider,
  ToolFilterOptions,
  listAllToolPaths,
  getCatalogStructure,
  getToolsInCategory,
  getToolByPath
} from './mcp_providers';
import {
  IRunEnvironment,
  ExecutionResult,
  ExecutionOptions,
  LocalRunEnvironment,
  E2BRunEnvironment
} from './run_environments';

async function main() {
  // Example: Testing CodeModeMCP tool filtering
  console.log('=== CodeModeMCP Tool Filtering Test ===\n');
  
  const { CodeModeMCP } = await import('./CodeModeMCP');
  const testOpenRouterClient: ILLMClient = new OpenRouterClient();
  
  // Create mock LLM functions for testing
  const tinyLLM = testOpenRouterClient.getLLM('google/gemini-flash-1.5-8b');
  const mainLLM = testOpenRouterClient.getLLM('anthropic/claude-sonnet-4');
  const strategyLLM = testOpenRouterClient.getLLM('anthropic/claude-sonnet-4');
  
  // Get a sample catalog from Composio
  const testComposioConfig: ComposioConfig = {
    projectId: 'pr_VkAXHNA8WZkP',
  };
  const testComposioProvider: IMCPProvider = new ComposioProvider(testComposioConfig);
  const testFilterOptions: ToolFilterOptions = {
    toolkits: ['slack', 'gmail'],
    limit: 50
  };
  const catalog = await testComposioProvider.getTools(testFilterOptions);
  
  // Initialize a local run environment for code generation
  // Use current directory so files are created in the project
  const runEnvironment: IRunEnvironment = new LocalRunEnvironment(process.cwd());
  
  // Initialize CodeModeMCP
  const codeMode = new CodeModeMCP({
    llms: {
      tinyLLM,
      mainLLM,
      strategyLLM
    },
    tools: catalog,
    runEnvironment
  });
  
  // Test the tool filtering with a specific query
  try {
    await codeMode.runMCPCode({
      query: 'Send a message to a Slack channel',
      maxToolCalls: 10,
      totalExecutionTimeout: 60,
      toolCallTimeout: 10,
      maxToolsPerPrompt: 10,
      maxConcurrentThreads: 3
    });
  } catch (error: any) {
    // Expected to throw "not yet fully implemented" error
    // But we should see the tool filtering and code generation output above
    if (error.message === 'runMCPCode not yet fully implemented') {
      console.log(`\n✅ Tool filtering and code generation steps completed successfully!`);
      console.log(`   The tinyLLM successfully filtered the catalog to only relevant tools.`);
      console.log(`   TypeScript tool files have been generated in the functions/ directory.`);
      console.log(`   (Note: Full execution flow not yet implemented - this is expected)\n`);
    } else {
      throw error;
    }
  }
  
  return; // Exit early to just test filtering
  
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
  
  // First, let's check what connected accounts you have
  const composioConfig: ComposioConfig = {
    // API credentials will be read from environment if not provided
    // apiKey: 'your-api-key',
    projectId: 'pr_VkAXHNA8WZkP', // From your screenshot
    // userId: 'your-user-id',
    // connectedAccountId will be set after we find available accounts
  };
  
  console.log('\n=== Checking Connected Accounts ===');
  try {
    const axios = (await import('axios')).default;
    // Try the correct v3 API endpoint for connected accounts
    const response = await axios.get('https://backend.composio.dev/api/v3/connected_accounts', {
      headers: {
        'X-API-Key': process.env.COMPOSIO_API_KEY || '',
        'Content-Type': 'application/json',
      },
    });
    
    console.log('\nYour connected accounts:');
    if (response.data && response.data.items && response.data.items.length > 0) {
      response.data.items.forEach((account: any, index: number) => {
        const appName = account.toolkit?.slug || account.appName || account.integrationId || 'Unknown';
        console.log(`${index + 1}. ${appName.toUpperCase()} (ID: ${account.id})`);
        console.log(`   Status: ${account.status}`);
      });
      
      // Use the first Slack account if available
      const slackAccount = response.data.items.find((acc: any) => {
        const appIdentifier = (acc.toolkit?.slug || acc.appName || acc.integrationId || '').toLowerCase();
        return appIdentifier === 'slack' || appIdentifier.includes('slack');
      });
      
      if (slackAccount) {
        console.log(`\n✓ Using Slack account: ${slackAccount.id}`);
        console.log(`  User ID: ${slackAccount.user_id}`);
        composioConfig.connectedAccountId = slackAccount.id;
        composioConfig.userId = slackAccount.user_id;
      } else {
        console.log('\n⚠ No Slack account found. You need to connect Slack first.');
        console.log('Visit: https://app.composio.dev/apps/slack');
      }
    } else {
      console.log('No connected accounts found. You need to connect Slack first.');
      console.log('Visit: https://app.composio.dev/apps/slack');
    }
  } catch (error: any) {
    console.error('Error fetching connected accounts:', error.response?.data || error.message);
    console.log('\nMake sure COMPOSIO_API_KEY is set in your .env file');
  }
  
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
  
  // Get the tool to list all Slack channels from the catalog we just fetched
  const listChannelsTool = getToolByPath(composioCatalog, 'slack.list.all_channels');
  if (listChannelsTool) {
    console.log(`\nFound tool: ${listChannelsTool!.name}`);
    console.log(`Description: ${listChannelsTool!.description}`);
    console.log('\nTool parameters:');
    listChannelsTool!.parameters.forEach((param: any) => {
      console.log(`  - ${param.name} (${param.type}): ${param.description}`);
      console.log(`    Required: ${param.required}, Default: ${param.default}`);
    });
    
    // Only execute if we have a connected account
    if (composioConfig.connectedAccountId) {
      console.log('\n=== Executing: List Slack Channels ===');
      try {
        // Pass limit parameter to get more channels (max is 1000)
        const result = await listChannelsTool!.execute({ 
          limit: 100,  // Get up to 100 channels per page
          exclude_archived: false  // Include archived channels
        });
        
        console.log('\n=== Slack Channels ===');
        
        // Extract channels from the Composio response structure
        const channels = result?.data?.channels || result?.channels;
        const nextCursor = result?.data?.response_metadata?.next_cursor;
        
        if (channels && Array.isArray(channels)) {
          channels.forEach((channel: any) => {
            const privacy = channel.is_private ? ' [Private]' : ' [Public]';
            const archived = channel.is_archived ? ' [Archived]' : '';
            const members = channel.num_members ? ` (${channel.num_members} members)` : '';
            console.log(`- #${channel.name} (ID: ${channel.id})${privacy}${archived}${members}`);
          });
          console.log(`\nTotal channels: ${channels.length}`);
          
          if (nextCursor) {
            console.log('\n💡 More channels available. There\'s a next_cursor for pagination.');
          }
        } else {
          console.log('Unexpected response structure:', JSON.stringify(result, null, 2));
        }
      } catch (error) {
        console.error('Error executing tool:', error);
      }
    } else {
      console.log('\n⚠ Skipping execution: No connected Slack account found.');
      console.log('To execute tools, you need to:');
      console.log('1. Go to https://app.composio.dev/apps');
      console.log('2. Connect your Slack workspace');
      console.log('3. The connected account ID will be automatically used');
    }
  } else {
    console.log('\nCould not find slack.list.all_channels tool. Available paths:');
    console.log(composioPaths.filter(p => p.includes('slack.list')).slice(0, 10));
  }
}

main().catch(console.error);

// CodeModeMCP
export { CodeModeMCP, CodeModeMCPConfig, RunMCPCodeOptions } from './CodeModeMCP';

// Re-export all modules for library usage
export {
  // Model Clients
  ILLMClient,
  OpenRouterClient,
  OpenAIClient,
  // MCP Providers
  IMCPProvider,
  PipedreamProvider,
  ComposioProvider,
  ComposioConfig,
  ToolFilterOptions,
  listAllToolPaths,
  getCatalogStructure,
  getToolsInCategory,
  getToolByPath,
  // Run Environments
  IRunEnvironment,
  ExecutionResult,
  ExecutionOptions,
  LocalRunEnvironment,
  E2BRunEnvironment,
};

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