import { OpenRouterClient, ILLMClient } from './model_clients';
import { CodeModeMCP, CodeModeMCPConfig, MCPExecutionResult } from './CodeModeMCP';
import { ComposioProvider } from './mcp_providers/composio';
import { LocalRunEnvironment } from './run_environments';

async function main() {
  console.log('=== Initializing CodeModeMCP ===\n');
  
  const openRouterClient: ILLMClient = new OpenRouterClient();
  const composioProvider = new ComposioProvider();
  
  const codeModeMCP = new CodeModeMCP({
    llms: {
        tinyLLM: openRouterClient.getLLM('openai/gpt-oss-20b'), // for lightweight filtering and tool selection
        mainLLM: openRouterClient.getLLM('openai/gpt-oss-120b'), // for code generation and execution
        strategyLLM: openRouterClient.getLLM('anthropic/claude-sonnet-4.5'), // for strategic reasoning and planning
    },
    tools: await composioProvider.getTools({ toolkits: ['slack', 'gmail'] }),
    runEnvironment: new LocalRunEnvironment('./tmp/mcp-codemode'),
  });

  const result: MCPExecutionResult = await codeModeMCP.runMCPCode({
    query: "get all channels from slack",
    maxToolCalls: 100,
    totalExecutionTimeout: 60,
    toolCallTimeout: 10,
  });
  console.log(result);
}

// Run main function if this is the entry point
if (require.main === module) {
  main().catch(console.error);
}