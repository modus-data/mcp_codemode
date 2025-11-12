import { OpenRouterClient, ILLMClient } from './model_clients';
import { CodeModeMCP, CodeModeMCPConfig } from './CodeModeMCP';
import { ComposioProvider } from './mcp_providers/composio';
import { LocalRunEnvironment } from './run_environments';

async function main() {
  console.log('=== Initializing CodeModeMCP ===\n');
  
  const openRouterClient: ILLMClient = new OpenRouterClient();
  const composioProvider = new ComposioProvider();
  
  const codeModeMCP = new CodeModeMCP({
    llms: {
        tinyLLM: openRouterClient.getLLM('openai/gpt-oss-20b'),
        mainLLM: openRouterClient.getLLM('openai/gpt-oss-120b'),
        strategyLLM: openRouterClient.getLLM('anthropic/claude-sonnet-4.5'),
    },
    tools: await composioProvider.getTools({ toolkits: ['slack', 'gmail'] }),
    runEnvironment: new LocalRunEnvironment(),
  });
}

// Run main function if this is the entry point
if (require.main === module) {
  main().catch(console.error);
}