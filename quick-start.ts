import { CodeModeMCP } from './src/CodeModeMCP';
import { OpenRouterClient } from './src/model_clients';
import { ComposioProvider } from './src/mcp_providers';
import { E2BRunEnvironment } from './src/run_environments';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Check if required environment variables are set
 */
function checkEnvironmentVariables(): void {
  const requiredVars = [
    { name: 'OPENROUTER_API_KEY', description: 'Get your API key from: https://openrouter.ai/keys' },
    { name: 'COMPOSIO_API_KEY', description: 'Get your API key from: https://app.composio.dev/settings/api-keys' },
    { name: 'E2B_API_KEY', description: 'Get your API key from: https://e2b.dev/docs/getting-started/api-key' },
  ];

  const missing: string[] = [];
  const helpMessages: string[] = [];

  for (const { name, description } of requiredVars) {
    if (!process.env[name]) {
      missing.push(name);
      helpMessages.push(`  ${name}: ${description}`);
    }
  }

  if (missing.length > 0) {
    console.error('\n❌ Missing required environment variables:\n');
    helpMessages.forEach(msg => console.error(msg));
    console.error('\n💡 To fix this:');
    console.error('   1. Copy .env.example to .env: cp .env.example .env');
    console.error('   2. Edit .env and add your API keys');
    console.error('   3. Or export them in your shell:');
    missing.forEach(name => {
      console.error(`      export ${name}="your-api-key-here"`);
    });
    console.error('');
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

async function main() {
  // Check environment variables before proceeding
  checkEnvironmentVariables();

  // Initialize OpenRouter client for LLM access
  const openRouterClient = new OpenRouterClient();

  // Setup Composio with your project
  const composioProvider = new ComposioProvider({
    projectId: 'your-project-id', // Optional: configure with connectedAccountId and userId
  });

  // Configure with three specialized LLMs
  const codeMode = new CodeModeMCP({
    llms: {
      tinyLLM: openRouterClient.getLLM('openai/gpt-oss-20b'),      // Fast filtering model
      mainLLM: openRouterClient.getLLM('openai/gpt-oss-120b'),     // Code generation model
      strategyLLM: openRouterClient.getLLM('anthropic/claude-sonnet-4.5')  // Strategic planning
    },
    tools: await composioProvider.getTools({ 
      toolkits: ['slack', 'gmail', 'github'] // Specify the toolkits you need
    }),
    runEnvironment: new E2BRunEnvironment(), // Secure cloud sandbox
    logPath: './prompt_logs' // Optional: log all LLM interactions
  });

  // Execute a complex multi-step task
  const result = await codeMode.runMCPCode({
    query: "get all channels from slack, and send a message to every channel that start with 'test', set an emoji on each message in channels that start with the letter 'e'",
    maxToolCalls: 100,
    totalExecutionTimeout: 60,
    toolCallTimeout: 10
  });

  console.log(`Execution: ${result.resultType}`);
  console.log(`Duration: ${result.totalDurationMs}ms`);
}

// Run main function
main().catch(console.error);
