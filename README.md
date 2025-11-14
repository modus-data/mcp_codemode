# MCP CodeMode

An open-source, agnostic implementation of the MCP Code Mode concept for sandbox environments.

**Inspired by:**
- [Cloudflare's Code Mode](https://blog.cloudflare.com/code-mode/) - Converting MCP tools into TypeScript APIs
- [Anthropic's Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp) - Safe code execution patterns

## What is Code Mode?

Traditional MCP (Model Context Protocol) usage exposes tools directly to LLMs, requiring them to make explicit tool calls. However, as [Cloudflare discovered](https://blog.cloudflare.com/code-mode/), **LLMs are better at writing code to call MCP than calling MCP directly**.

### Why Code Mode?

1. **LLMs excel at writing code**: They've been trained on millions of real-world TypeScript examples, but only synthetic tool-calling examples
2. **Handle more complex tools**: When tools are presented as TypeScript APIs, LLMs can work with larger and more sophisticated tool sets
3. **Efficient multi-step operations**: Instead of feeding each tool result back through the neural network, LLMs can write code that chains multiple calls together
4. **Better reasoning**: Writing code is a more natural problem-solving mode for LLMs than structured tool invocations

## How It Works

This library implements a sophisticated 6-step pipeline:

```
User Query → Pseudocode Plan → Tool Filtering → TypeScript Generation 
           → Code Implementation → Compilation → Sandboxed Execution
```

### Architecture

The system uses **three specialized LLMs**:

- **Strategy LLM**: High-level planning and pseudocode generation (most capable model)
- **Tiny LLM**: Fast filtering through large tool catalogs (lightweight, fast model)
- **Main LLM**: Code generation and implementation (capable coding model)

### Execution Flow

1. **Generate Pseudocode** (Strategy LLM): Creates a high-level execution plan
2. **Filter Tools** (Tiny LLM): Intelligently selects relevant tools from potentially thousands of options
3. **Generate TypeScript Interfaces**: Converts filtered MCP tools into TypeScript API definitions
4. **Implement Code** (Main LLM): Writes actual TypeScript code using the generated APIs
5. **Verify Compilation**: Ensures type safety before execution
6. **Execute in Sandbox**: Runs the code in a secure, isolated environment

## Installation

```bash
npm install mcp_codemode
```

## Quick Start

```typescript
import { CodeModeMCP } from 'mcp_codemode';
import { createOpenAIClient } from 'mcp_codemode/model_clients';
import { LocalEnvironment } from 'mcp_codemode/run_environments';

// Configure with three specialized LLMs
const codeMode = new CodeModeMCP({
  llms: {
    strategyLLM: createOpenAIClient('gpt-4', process.env.OPENAI_API_KEY),
    tinyLLM: createOpenAIClient('gpt-3.5-turbo', process.env.OPENAI_API_KEY),
    mainLLM: createOpenAIClient('gpt-4', process.env.OPENAI_API_KEY)
  },
  tools: {
    // Your hierarchical tool catalog
    slack: {
      message: {
        send: { /* tool definition */ }
      }
    },
    github: {
      issues: {
        create: { /* tool definition */ }
      }
    }
  },
  runEnvironment: new LocalEnvironment(),
  logPath: './prompt_logs' // Optional: log all LLM interactions
});

// Execute a task
const result = await codeMode.runMCPCode({
  query: "Send a message to #general channel saying 'Hello World'",
  maxToolCalls: 10,
  totalExecutionTimeout: 60,
  toolCallTimeout: 30,
  maxToolsPerPrompt: 20,
  maxConcurrentThreads: 5
});

console.log(`Execution: ${result.resultType}`);
console.log(`Duration: ${result.totalDurationMs}ms`);
```

## Key Features

### 🎯 Intelligent Tool Filtering
With potentially thousands of tools available, the Tiny LLM rapidly filters down to only relevant tools, reducing context size and improving accuracy.

### 🏗️ Type-Safe Code Generation
All generated code is TypeScript with full type checking before execution, catching errors early.

### 🔒 Secure Sandboxing
Supports multiple execution environments:
- **Local**: Node.js process isolation
- **E2B**: Cloud sandboxes for production use
- **Custom**: Implement your own `IRunEnvironment`

### 📊 Comprehensive Observability
- Detailed timing reports for each pipeline step
- Optional logging of all LLM prompts and responses
- Execution traces for debugging

### 🔌 Flexible Architecture
- **MCP Provider Agnostic**: Works with Composio, Pipedream, or custom providers
- **Model Agnostic**: Use OpenAI, OpenRouter, or any LLM that follows the interface
- **Environment Agnostic**: Run locally or in the cloud

## Configuration Options

### CodeModeMCPConfig

```typescript
interface CodeModeMCPConfig {
  llms: {
    tinyLLM: LLMFunction;      // Fast filtering model
    mainLLM: LLMFunction;      // Code generation model
    strategyLLM: LLMFunction;  // Planning model
  };
  tools?: ToolCatalog;          // Hierarchical tool catalog
  mcpProvider?: IMCPProvider;   // Optional MCP provider
  runEnvironment?: IRunEnvironment; // Execution sandbox
  logPath?: string;             // Optional logging directory
}
```

### RunMCPCodeOptions

```typescript
interface RunMCPCodeOptions {
  query?: string;                    // User task description
  maxToolCalls: number;              // Limit on tool invocations
  totalExecutionTimeout: number;     // Overall timeout (seconds)
  toolCallTimeout: number;           // Per-tool timeout (seconds)
  maxToolsPerPrompt?: number;        // Tools per filtering batch (default: 20)
  maxConcurrentThreads?: number;     // Parallel filtering threads (default: 5)
  includeDescriptionsInFilter?: boolean; // Include tool descriptions in logs
}
```

## Advanced Usage

### Custom LLM Integration

```typescript
import { LLMFunction } from 'mcp_codemode/model_clients';

const myCustomLLM: LLMFunction = async (prompt: string): Promise<string> => {
  // Your LLM integration here
  const response = await myLLMService.complete(prompt);
  return response.text;
};

const codeMode = new CodeModeMCP({
  llms: {
    strategyLLM: myCustomLLM,
    tinyLLM: myCustomLLM,
    mainLLM: myCustomLLM
  },
  // ... other config
});
```

### Custom Run Environment

```typescript
import { IRunEnvironment } from 'mcp_codemode/run_environments';

class MyCustomEnvironment implements IRunEnvironment {
  async execute(code: string): Promise<{ success: boolean; output: string }> {
    // Your execution logic
  }
}
```

### Tool Catalog Management

```typescript
// List all available tools
const toolPaths = codeMode.listToolPaths();
console.log(toolPaths); // ['slack.message.send', 'github.issues.create', ...]

// Get a specific tool
const tool = codeMode.getTool('slack.message.send');

// Update the catalog
codeMode.setToolCatalog(newCatalog);
```

## Project Structure

```
src/
├── CodeModeMCP.ts           # Main orchestrator class
├── steps/                   # Pipeline steps
│   ├── generatePseudocode.ts
│   ├── filterTools.ts
│   ├── generateToolsCode.ts
│   ├── implementCode.ts
│   └── executeCode.ts
├── model_clients/           # LLM integrations
│   ├── openai.ts
│   └── openrouter.ts
├── run_environments/        # Execution sandboxes
│   ├── local.ts
│   └── e2b.ts
└── mcp_providers/          # MCP server integrations
    ├── composio.ts
    └── pipedream.ts
```

## Why This Matters

As MCP adoption grows, agents will have access to hundreds or thousands of tools. Traditional tool-calling approaches break down at scale:

- **Context limits**: Can't fit all tool definitions in a prompt
- **Poor selection**: LLMs struggle to choose the right tool from many options
- **Inefficient chaining**: Each tool result must round-trip through the LLM

Code Mode solves these problems by leveraging what LLMs do best: **writing code**. This library provides a production-ready implementation that's modular, extensible, and platform-agnostic.

## Contributing

This is a completely free and open-to-collaboration repository. Contributions are welcome!

- Report issues
- Submit pull requests
- Suggest improvements
- Share your use cases

## License

Apache 2.0

## Learn More

- [Cloudflare's Code Mode Announcement](https://blog.cloudflare.com/code-mode/)
- [Anthropic's Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
