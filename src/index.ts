import { OpenRouterClient, ILLMClient } from './model_clients/index.js';
import { CodeModeMCP, CodeModeMCPConfig } from './CodeModeMCP.js';
import { ComposioProvider } from './mcp_providers/composio.js';

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
    tools: await composioProvider.getTools({ toolkits: ['slack', 'gmail'] })
  })
}

// Run main function if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}