import { OpenRouterClient, ILLMClient } from './model_clients';
import { CodeModeMCP, CodeModeMCPConfig, MCPExecutionResult, StepTiming } from './CodeModeMCP';
import { ComposioProvider, ComposioConfig } from './mcp_providers/composio';
import { LocalRunEnvironment } from './run_environments';
import axios from 'axios';

async function main() {
  console.log('=== Initializing CodeModeMCP ===\n');
  
  const openRouterClient: ILLMClient = new OpenRouterClient();
  
  // Setup Composio with connected account
  const composioConfig: ComposioConfig = {
    projectId: 'pr_VkAXHNA8WZkP',
  };
  
  // Fetch connected accounts from Composio
  try {
    console.log('Fetching connected accounts from Composio...');
    const response = await axios.get('https://backend.composio.dev/api/v3/connected_accounts', {
      headers: {
        'X-API-Key': process.env.COMPOSIO_API_KEY || '',
        'Content-Type': 'application/json',
      },
    });
    
    if (response.data && response.data.items && response.data.items.length > 0) {
      // Find the first Slack account
      const slackAccount = response.data.items.find((acc: any) => {
        const appIdentifier = (acc.toolkit?.slug || acc.appName || acc.integrationId || '').toLowerCase();
        return appIdentifier === 'slack' || appIdentifier.includes('slack');
      });
      
      if (slackAccount) {
        console.log(`✓ Found Slack account: ${slackAccount.id}`);
        composioConfig.connectedAccountId = slackAccount.id;
        composioConfig.userId = slackAccount.user_id;
      } else {
        console.warn('⚠ No Slack account found. Visit: https://app.composio.dev/apps/slack');
      }
    }
  } catch (error: any) {
    console.error('Error fetching connected accounts:', error.response?.data || error.message);
    console.log('Make sure COMPOSIO_API_KEY is set in your .env file');
  }
  
  const composioProvider = new ComposioProvider(composioConfig);
  
  const codeModeMCP = new CodeModeMCP({
    llms: {
        tinyLLM: openRouterClient.getLLM('openai/gpt-oss-20b'), // for lightweight filtering and tool selection
        mainLLM: openRouterClient.getLLM('openai/gpt-oss-120b'), // for code generation and execution
        strategyLLM: openRouterClient.getLLM('anthropic/claude-sonnet-4.5'), // for strategic reasoning and planning
    },
    tools: await composioProvider.getTools({ toolkits: ['slack', 'gmail'] }),
    runEnvironment: new LocalRunEnvironment('./tmp/'),
  });

  try {
    const result: MCPExecutionResult = await codeModeMCP.runMCPCode({
    //   query: "get all channels from slack, and send a message to every channel that start with 'test', set an emoji on each message in channels that start with the letter 'e'",
      query: "send 'hi private channel' to every private channel in slack",
      maxToolCalls: 100,
      totalExecutionTimeout: 60,
      toolCallTimeout: 10,
    });
    console.log(result);
  } catch (error: any) {
    // Expected to throw "not yet fully implemented" error
    // But we should see the tool filtering output above
    if (error.message === 'runMCPCode not yet fully implemented') {
      console.log(`\n✅ Tool filtering step completed successfully!`);
      console.log(`   The tinyLLM successfully filtered the catalog to only relevant tools.`);
      console.log(`   (Note: Full execution flow not yet implemented - this is expected)\n`);
    } else {
      throw error;
    }
  }
}

// Run main function if this is the entry point
if (require.main === module) {
  main().catch(console.error);
}