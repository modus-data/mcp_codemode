import { OpenRouterClient, OpenAIClient, ILLMClient } from './model_clients/index.js';

async function main() {
  // Example: Using OpenRouter client
  console.log('=== OpenRouter Example ===');
  const openRouterClient: ILLMClient = new OpenRouterClient();
  const openRouterLLM = openRouterClient.getLLM('anthropic/claude-sonnet-4.5');
  
  console.log('Sending message to OpenRouter...');
  const openRouterResponse = await openRouterLLM('hello ai');
  console.log('\nOpenRouter Response:');
  console.log(openRouterResponse);
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