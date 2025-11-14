/**
 * Represents a parameter for a tool
 */
export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: any;
}

/**
 * Represents an MCP tool with its metadata and execution details
 */
export interface MCPTool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  /**
   * Executes the tool with the given arguments
   * @param args Arguments to pass to the tool
   * @returns Result of the tool execution
   */
  execute: (args: Record<string, any>) => Promise<any>;
}

/**
 * Hierarchical tool catalog structure
 * Can be nested indefinitely: category -> subcategory -> tool
 * or category -> tool
 */
export type ToolCatalog = {
  [key: string]: MCPTool | ToolCatalog;
};

/**
 * Options for filtering tools
 */
export interface ToolFilterOptions {
  /**
   * Filter by specific toolkits/apps (e.g., ["slack", "gmail"])
   */
  toolkits?: string[];
  /**
   * Limit the number of tools per toolkit
   */
  limit?: number;
}

/**
 * Generic interface for all MCP tool provider implementations
 */
export interface IMCPProvider {
  /**
   * Gets all available tools organized in a hierarchical structure
   * @param options Optional filtering options
   * @returns Nested object with tools organized by categories
   */
  getTools(options?: ToolFilterOptions): Promise<ToolCatalog>;

  /**
   * Gets a specific tool by path (e.g., 'slack.send.sendToChannel')
   * @param path Dot-separated path to the tool
   * @returns The requested tool or null if not found
   */
  getTool(path: string): Promise<MCPTool | null>;
}

