import { ToolCatalog, MCPTool } from './types';

/**
 * Helper utility functions for working with MCP tool catalogs
 */

/**
 * Checks if an object is an MCPTool
 */
export function isMCPTool(obj: any): obj is MCPTool {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'name' in obj &&
    'description' in obj &&
    'parameters' in obj &&
    'execute' in obj &&
    typeof obj.execute === 'function'
  );
}

/**
 * Recursively lists all tool paths in a catalog
 * @param catalog The tool catalog to traverse
 * @param prefix Current path prefix (used for recursion)
 * @returns Array of dot-separated tool paths
 */
export function listAllToolPaths(catalog: ToolCatalog, prefix: string = ''): string[] {
  const paths: string[] = [];

  for (const [key, value] of Object.entries(catalog)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;

    if (isMCPTool(value)) {
      paths.push(currentPath);
    } else {
      // Recursively traverse the nested catalog
      paths.push(...listAllToolPaths(value as ToolCatalog, currentPath));
    }
  }

  return paths;
}

/**
 * Gets a tool from a catalog using a dot-separated path
 * @param catalog The tool catalog
 * @param path Dot-separated path (e.g., 'slack.message.send')
 * @returns The tool if found, null otherwise
 */
export function getToolByPath(catalog: ToolCatalog, path: string): MCPTool | null {
  const parts = path.split('.');
  let current: MCPTool | ToolCatalog = catalog;

  for (const part of parts) {
    if (isMCPTool(current)) {
      // We've reached a tool but there are more parts in the path
      return null;
    }

    if (typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }

  return isMCPTool(current) ? current : null;
}

/**
 * Gets all tools at a specific category level
 * @param catalog The tool catalog
 * @param categoryPath Dot-separated path to category (e.g., 'slack.message')
 * @returns Object containing all tools in that category
 */
export function getToolsInCategory(
  catalog: ToolCatalog,
  categoryPath: string
): Record<string, MCPTool> {
  const parts = categoryPath.split('.');
  let current: MCPTool | ToolCatalog = catalog;

  // Navigate to the category
  for (const part of parts) {
    if (isMCPTool(current) || !(part in current)) {
      return {};
    }
    current = current[part];
  }

  // Extract all tools from this level
  const tools: Record<string, MCPTool> = {};
  
  if (!isMCPTool(current)) {
    for (const [key, value] of Object.entries(current)) {
      if (isMCPTool(value)) {
        tools[key] = value;
      }
    }
  }

  return tools;
}

/**
 * Gets the hierarchical structure (category tree) without the tool details
 * Useful for understanding the organization without loading all tool data
 * @param catalog The tool catalog
 * @returns Nested object with just the structure (keys)
 */
export function getCatalogStructure(catalog: ToolCatalog): any {
  const structure: any = {};

  for (const [key, value] of Object.entries(catalog)) {
    if (isMCPTool(value)) {
      structure[key] = '<tool>';
    } else {
      structure[key] = getCatalogStructure(value as ToolCatalog);
    }
  }

  return structure;
}

/**
 * Flattens a hierarchical tool catalog into a flat array of tools
 * @param catalog The tool catalog to flatten
 * @returns Array of all MCPTool objects in the catalog
 */
export function flattenToolCatalog(catalog: ToolCatalog): MCPTool[] {
  const tools: MCPTool[] = [];

  for (const value of Object.values(catalog)) {
    if (isMCPTool(value)) {
      tools.push(value);
    } else {
      // Recursively flatten nested catalogs
      tools.push(...flattenToolCatalog(value as ToolCatalog));
    }
  }

  return tools;
}

