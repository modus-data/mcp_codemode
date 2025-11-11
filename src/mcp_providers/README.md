# MCP Providers

Generic implementation for Model Context Protocol (MCP) tool providers with hierarchical organization.

## Overview

This module provides a standardized interface for accessing tools from various MCP providers (Pipedream, Composio, etc.) with support for hierarchical organization of tools.

## Architecture

### Core Types

- **`MCPTool`**: Represents an individual tool with parameters and execution capability
- **`ToolCatalog`**: Hierarchical structure organizing tools by categories
- **`IMCPProvider`**: Generic interface all providers must implement

### Hierarchical Organization

Tools are organized in a nested structure:

```typescript
{
  slack: {
    message: {
      send: MCPTool,
      delete: MCPTool,
      update: MCPTool
    },
    channel: {
      create: MCPTool,
      archive: MCPTool
    }
  },
  github: {
    issues: {
      create: MCPTool,
      close: MCPTool
    }
  }
}
```

## Providers

### Pipedream

Provides access to Pipedream workflows and actions.

```typescript
import { PipedreamProvider } from './mcp_providers';

const provider = new PipedreamProvider();
const catalog = await provider.getTools();
const tool = await provider.getTool('slack.message.send');
```

**Environment Variable Required**: `PIPEDREAM_API_KEY`

### Composio

Provides access to Composio actions and integrations.

```typescript
import { ComposioProvider, ComposioConfig } from './mcp_providers';

// Option 1: Use environment variables
const provider = new ComposioProvider();

// Option 2: Pass config explicitly
const provider = new ComposioProvider({
  apiKey: 'your-api-key',
  projectId: 'your-project-id',
  userId: 'your-user-id',
  connectedAccountId: 'your-connected-account-id'
});

const catalog = await provider.getTools();
const tool = await provider.getTool('slack.message.send');
```

**Environment Variables**: 
- `COMPOSIO_API_KEY` (required)
- `COMPOSIO_PROJECT_ID` (optional)
- `COMPOSIO_USER_ID` (optional)

**Config Options**:
- `apiKey`: Composio API key (required, from env or config)
- `projectId`: Project ID for multi-project accounts (optional, from env or config)
- `userId`: User ID for user-specific actions (optional, from env or config)
- `connectedAccountId`: Account ID for tool execution (optional, from config)

## Utility Functions

### `listAllToolPaths(catalog)`

Returns an array of all tool paths in dot notation:

```typescript
const paths = listAllToolPaths(catalog);
// ['slack.message.send', 'slack.message.delete', 'github.issues.create', ...]
```

### `getCatalogStructure(catalog)`

Returns the hierarchical structure without tool details:

```typescript
const structure = getCatalogStructure(catalog);
// { slack: { message: '<tool>', channel: '<tool>' }, github: { ... } }
```

### `getToolsInCategory(catalog, path)`

Returns all tools at a specific category level:

```typescript
const slackTools = getToolsInCategory(catalog, 'slack.message');
// { send: MCPTool, delete: MCPTool, update: MCPTool }
```

### `getToolByPath(catalog, path)`

Gets a specific tool by its path:

```typescript
const tool = getToolByPath(catalog, 'slack.message.send');
```

### `isMCPTool(obj)`

Type guard to check if an object is an MCPTool:

```typescript
if (isMCPTool(value)) {
  // value is MCPTool
}
```

## Usage Example

```typescript
import { 
  PipedreamProvider, 
  ComposioProvider,
  ComposioConfig,
  listAllToolPaths,
  getCatalogStructure 
} from './mcp_providers';

// Initialize providers
const pipedreamProvider = new PipedreamProvider();
const composioProvider = new ComposioProvider({
  // Credentials read from environment if not provided
  connectedAccountId: 'your-connected-account-id'
});

// Get full catalog
const catalog = await composioProvider.getTools();

// View structure
console.log(getCatalogStructure(catalog));

// List all tools
const allPaths = listAllToolPaths(catalog);
console.log(`Total tools: ${allPaths.length}`);

// Get specific tool
const tool = await provider.getTool('slack.message.send');

if (tool) {
  console.log(`Tool: ${tool.name}`);
  console.log(`Description: ${tool.description}`);
  console.log(`Parameters:`, tool.parameters);
  
  // Execute the tool
  const result = await tool.execute({
    channel: '#general',
    text: 'Hello World!'
  });
}
```

## Implementing a New Provider

To add a new MCP provider:

1. Create a new file (e.g., `your-provider.ts`)
2. Implement the `IMCPProvider` interface
3. Organize tools hierarchically in `getTools()`
4. Implement path-based lookup in `getTool()`
5. Export from `index.ts`

```typescript
export class YourProvider implements IMCPProvider {
  async getTools(): Promise<ToolCatalog> {
    // Return hierarchically organized tools
  }
  
  async getTool(path: string): Promise<MCPTool | null> {
    // Return tool by dot-separated path
  }
}
```

## Design Principles

1. **No Filtering**: All tools are returned. Filtering should be done by consumers.
2. **Hierarchical Organization**: Tools organized by app/service and category.
3. **Lazy Loading**: Tools are cached after first fetch.
4. **Path-Based Access**: Use dot notation for intuitive tool lookup.
5. **Provider Agnostic**: Generic interface works with any MCP provider.

