# mcp_codemode
An agnostic implementation fit for sandbox environments for the MCP codemode concept

## Overview

MCP CodeMode is a framework for LLM-powered tool execution that:
1. Filters large tool catalogs using a tiny LLM
2. Generates TypeScript implementations using AST
3. Plans execution strategy using a strategic LLM
4. Executes code safely in sandboxed environments

## Quick Start

```bash
npm install
npm run build
npm run example:generate
```

## Project Status

**Completed Steps:**
- ✅ Step 1: Tool Filtering - See [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md)
- ✅ Step 2: TypeScript Code Generation - See [STEP2_CODE_GENERATION.md](./STEP2_CODE_GENERATION.md)

**Next Steps:**
- Step 3: Strategic Planning with strategyLLM
- Step 4: Code Implementation with mainLLM
- Step 5: Safe Execution and Result Aggregation

## Documentation

- [Implementation Notes](./IMPLEMENTATION_NOTES.md) - Details on Step 1 (Tool Filtering)
- [Step 2 Documentation](./STEP2_CODE_GENERATION.md) - Details on TypeScript Code Generation
- [Run Environments](./src/run_environments/README.md) - Guide to execution environments
- [MCP Providers](./src/mcp_providers/README.md) - Guide to tool providers
