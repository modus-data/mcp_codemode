# Implementation Notes: Tool Filtering Step

## Overview
Successfully implemented the first step of the `runMCPCode()` method: using a tiny LLM to filter the tool catalog for only relevant tools based on the user query.

## Implementation Details

### New Configuration Options
Added to `RunMCPCodeOptions`:
- `maxToolsPerPrompt` (default: 20) - Maximum number of tools to include per LLM prompt
- `maxConcurrentThreads` (default: 5) - Maximum number of concurrent LLM calls for parallel filtering

### New Methods

#### `filterToolsForQuery(query, maxToolsPerPrompt, maxConcurrentThreads)`
Main filtering method that:
1. Flattens the hierarchical catalog to get all tool paths
2. Batches tools based on `maxToolsPerPrompt`
3. Processes batches in parallel (up to `maxConcurrentThreads`)
4. Reconstructs the filtered catalog with the same hierarchical structure
5. Prints comprehensive statistics

#### `filterToolBatch(batch, query)`
Filters a single batch of tools:
- Creates a detailed prompt with tool descriptions and parameters
- Asks the tinyLLM to select only relevant tools
- Parses the LLM response (comma-separated numbers)
- Returns selected tool paths
- Includes error handling (returns all tools in batch on error)

#### `reconstructCatalog(selectedPaths)`
Rebuilds the hierarchical catalog structure from a flat list of selected tool paths.

## Performance

### Test Results
**Query:** "get all channels from slack"

**Statistics:**
- Total tools in catalog: 123
- Batches processed: 7 (20 tools per batch)
- Max concurrent threads: 5
- **Selected tools: 3 out of 123**

**Selected Tools:**
- `slack.fetch.team_info`
- `slack.list.all_channels`
- `slack.list.conversations`

### Benefits
- **97.6% reduction** in tool catalog size (123 → 3)
- Only highly relevant tools selected for the query
- Parallel processing for fast filtering
- Maintains original catalog structure

## Next Steps
1. Use strategyLLM to plan the approach
2. Use mainLLM to generate code using the filtered tools
3. Use runEnvironment to execute code safely

## Usage Example

```typescript
const codeModeMCP = new CodeModeMCP({
  llms: {
    tinyLLM: openRouterClient.getLLM('google/gemini-flash-1.5-8b'),
    mainLLM: openRouterClient.getLLM('anthropic/claude-sonnet-4'),
    strategyLLM: openRouterClient.getLLM('anthropic/claude-sonnet-4.5'),
  },
  tools: await composioProvider.getTools({ toolkits: ['slack', 'gmail'] }),
});

await codeModeMCP.runMCPCode({
  query: "get all channels from slack",
  maxToolCalls: 100,
  totalExecutionTimeout: 60,
  toolCallTimeout: 10,
  maxToolsPerPrompt: 20,  // Batch size
  maxConcurrentThreads: 5  // Parallel processing
});
```

## Output Format

```
📊 Tool Filtering Statistics:
   Total tools in catalog: 123
   Batches to process: 7 (20 tools per batch)
   Max concurrent threads: 5
   Filtering tools with tinyLLM...
   Progress: 5/7 batches processed
   Progress: 7/7 batches processed
   ✅ Selected tools: 3 out of 123
   Selected tool paths:
     - slack.fetch.team_info
     - slack.list.all_channels
     - slack.list.conversations
```

