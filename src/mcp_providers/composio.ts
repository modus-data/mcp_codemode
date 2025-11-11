import axios from 'axios';
import dotenv from 'dotenv';
import { IMCPProvider, MCPTool, ToolParameter, ToolCatalog, ToolFilterOptions } from './types.js';

// Load environment variables
dotenv.config();

interface ComposioAction {
  slug: string;
  name: string;
  description: string;
  toolkit: {
    slug: string;
    name: string;
    logo?: string;
  };
  input_parameters: {
    description?: string;
    properties: Record<string, any>;
    required?: string[];
  };
  available_versions?: string[];
  version?: string;
}

interface ComposioExecutionRequest {
  connectedAccountId: string;
  input: Record<string, any>;
}

/**
 * Configuration options for Composio provider
 */
export interface ComposioConfig {
  apiKey?: string;
  projectId?: string;
  userId?: string;
  connectedAccountId?: string;
}

/**
 * Composio MCP Provider implementation
 * Provides access to Composio actions and integrations as MCP tools
 * Organizes tools hierarchically by app and action category
 */
export class ComposioProvider implements IMCPProvider {
  private apiKey: string;
  private projectId?: string;
  private userId?: string;
  private baseUrl = 'https://backend.composio.dev/api/v3';
  private cachedCatalog: ToolCatalog | null = null;
  private connectedAccountId?: string;

  constructor(config?: ComposioConfig) {
    // API Key (required)
    this.apiKey = config?.apiKey || process.env.COMPOSIO_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('COMPOSIO_API_KEY is required. Provide it via config or environment variable.');
    }
    
    // Project ID (optional, from config or env)
    this.projectId = config?.projectId || process.env.COMPOSIO_PROJECT_ID;
    
    // User ID (optional, from config or env)
    this.userId = config?.userId || process.env.COMPOSIO_USER_ID;
    
    // Connected Account ID (optional, needed for execution)
    this.connectedAccountId = config?.connectedAccountId;
    
  }

  /**
   * Builds headers for API requests
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
    };

    if (this.projectId) {
      headers['X-Project-Id'] = this.projectId;
    }

    if (this.userId) {
      headers['X-User-Id'] = this.userId;
    }

    return headers;
  }

  /**
   * Converts Composio action to MCPTool format
   */
  private convertActionToTool(action: ComposioAction): MCPTool {
    const properties = action.input_parameters?.properties || {};
    const required = action.input_parameters?.required || [];

    const parameters: ToolParameter[] = Object.entries(properties).map(([key, value]: [string, any]) => ({
      name: key,
      type: value.type || 'string',
      description: value.description || `Parameter ${key}`,
      required: required.includes(key),
      default: value.default,
    }));

    return {
      name: action.slug,
      description: action.description || action.name,
      parameters,
      execute: async (args: Record<string, any>) => {
        return this.executeAction(action.slug, args);
      },
    };
  }

  /**
   * Executes a Composio action using v3 API
   */
  private async executeAction(actionName: string, input: Record<string, any>): Promise<any> {
    if (!this.connectedAccountId) {
      throw new Error('Connected account ID is required to execute actions. Provide it in the constructor.');
    }

    try {
      // Correct v3 execute endpoint structure
      const executeUrl = `${this.baseUrl}/tools/execute/${actionName}`;
      const requestBody: any = {
        connected_account_id: this.connectedAccountId,
        arguments: input,
      };
      
      // Add user_id if available (required for multi-user connected accounts)
      if (this.userId) {
        requestBody.user_id = this.userId;
      }
      
      const response = await axios.post(
        executeUrl,
        requestBody,
        {
          headers: this.getHeaders(),
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || error.response?.statusText || error.message;
        throw new Error(`Composio API error: ${error.response?.status} - ${errorMessage}`);
      }
      throw error;
    }
  }

  /**
   * Fetches available actions from Composio using v3 API with pagination
   * @param options Optional filtering options
   */
  private async fetchActions(options?: ToolFilterOptions): Promise<ComposioAction[]> {
    try {
      const allTools: ComposioAction[] = [];
      let cursor: string | null | undefined = undefined;
      let page = 1;
      const maxToolsTotal = options?.limit || 100; // Total tools to fetch
      const pageSize = Math.min(50, maxToolsTotal); // Tools per request
      
      // Fetch all pages
      do {
        // Build query parameters
        const params: Record<string, any> = {
          limit: pageSize,
        };
        
        if (this.userId) {
          params.user_id = this.userId;
        }
        
        if (options?.toolkits && options.toolkits.length > 0) {
          // API uses toolkit_slug parameter (can only filter by ONE toolkit at a time)
          // For multiple toolkits, we'll need to make multiple requests or filter client-side
          if (options.toolkits.length === 1) {
            params.toolkit_slug = options.toolkits[0].toUpperCase();
          }
          // For multiple toolkits, we'll filter client-side after fetching
        }
        
        if (cursor) {
          params.cursor = cursor;
        }

        const response = await axios.get(`${this.baseUrl}/tools`, {
          headers: this.getHeaders(),
          params,
        });

        // Handle various response formats
        const tools = response.data.tools || response.data.items || [];
        allTools.push(...tools);
        
        // Get next cursor for pagination
        cursor = response.data.next_cursor;
        
        // console.log(`[Composio] Fetched page ${page}, got ${tools.length} tools, total so far: ${allTools.length}`);
        
        // Stop if we've reached the requested limit
        if (allTools.length >= maxToolsTotal) {
          break;
        }
        
        // Safety check: don't fetch more than 20 pages
        page++;
        if (page > 20) {
          break;
        }
        
      } while (cursor);
      
      return allTools;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Composio API error: ${error.response?.status} - ${error.response?.data?.message || error.response?.statusText || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Organizes actions into a hierarchical catalog structure
   * Format: app -> category -> action
   * Example: slack -> message -> send
   */
  private organizeCatalog(actions: ComposioAction[]): ToolCatalog {
    const catalog: ToolCatalog = {};

    for (const action of actions) {
      const tool = this.convertActionToTool(action);
      
      // Get app name from toolkit
      const appName = action.toolkit.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      // Parse action slug to extract category and action
      // Expected format: "APPNAME_CATEGORY_ACTION" (e.g., "SLACK_MESSAGE_SEND")
      // Remove app prefix from slug
      const slug = action.slug.toUpperCase();
      const toolkitPrefix = action.toolkit.slug.toUpperCase();
      
      let remainingSlug = slug;
      if (slug.startsWith(toolkitPrefix)) {
        remainingSlug = slug.substring(toolkitPrefix.length);
        if (remainingSlug.startsWith('_')) {
          remainingSlug = remainingSlug.substring(1);
        }
      }
      
      // Initialize app if doesn't exist
      if (!catalog[appName]) {
        catalog[appName] = {};
      }

      const appCatalog = catalog[appName] as ToolCatalog;
      
      // Split remaining slug into parts
      const parts = remainingSlug.split('_').filter(p => p.length > 0);
      
      if (parts.length >= 2) {
        // Has category: first part is category, rest is action
        const category = parts[0].toLowerCase();
        const actionName = parts.slice(1).join('_').toLowerCase();
        
        if (!appCatalog[category]) {
          appCatalog[category] = {};
        }
        
        const categoryCatalog = appCatalog[category] as ToolCatalog;
        categoryCatalog[actionName] = tool;
      } else {
        // No clear category, use the action name directly
        const actionName = remainingSlug.toLowerCase();
        appCatalog[actionName] = tool;
      }
    }

    return catalog;
  }

  async getTools(options?: ToolFilterOptions): Promise<ToolCatalog> {
    // If filtering by a single toolkit, API can do it efficiently
    if (options?.toolkits && options.toolkits.length === 1) {
      const actions = await this.fetchActions(options);
      return this.organizeCatalog(actions);
    }
    
    // If filtering by multiple toolkits, fetch from each and combine
    if (options?.toolkits && options.toolkits.length > 1) {
      let allActions: ComposioAction[] = [];
      for (const toolkit of options.toolkits) {
        const actions = await this.fetchActions({ ...options, toolkits: [toolkit] });
        allActions = allActions.concat(actions);
      }
      return this.organizeCatalog(allActions);
    }
    
    // Otherwise use cache for all tools
    if (!this.cachedCatalog) {
      const actions = await this.fetchActions(options);
      this.cachedCatalog = this.organizeCatalog(actions);
    }

    return this.cachedCatalog;
  }

  async getTool(path: string): Promise<MCPTool | null> {
    const catalog = await this.getTools();
    const parts = path.split('.');
    
    let current: MCPTool | ToolCatalog = catalog;
    
    for (const part of parts) {
      if (typeof current === 'object' && 'execute' in current) {
        // We've reached a tool but there are more parts in the path
        return null;
      }
      
      if (typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }
    
    // Check if we ended up at a tool
    if (typeof current === 'object' && 'execute' in current) {
      return current as MCPTool;
    }
    
    return null;
  }
}

