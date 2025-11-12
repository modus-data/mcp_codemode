import axios from 'axios';
import dotenv from 'dotenv';
import { IMCPProvider, MCPTool, ToolParameter, ToolCatalog, ToolFilterOptions } from './types';

// Load environment variables
dotenv.config();

interface PipedreamAction {
  key: string;
  name: string;
  description: string;
  props: Record<string, any>;
  app?: string;
  category?: string;
}

/**
 * Pipedream MCP Provider implementation
 * Provides access to Pipedream workflows and actions as MCP tools
 * Organizes tools hierarchically by app and category
 */
export class PipedreamProvider implements IMCPProvider {
  private apiKey: string;
  private baseUrl = 'https://api.pipedream.com/v1';
  private cachedCatalog: ToolCatalog | null = null;

  constructor() {
    const apiKey = process.env.PIPEDREAM_API_KEY;
    
    if (!apiKey) {
      throw new Error('PIPEDREAM_API_KEY is not set in environment variables');
    }
    
    this.apiKey = apiKey;
  }

  /**
   * Converts Pipedream action to MCPTool format
   */
  private convertActionToTool(action: PipedreamAction): MCPTool {
    const parameters: ToolParameter[] = Object.entries(action.props || {}).map(([key, value]) => ({
      name: key,
      type: typeof value === 'object' && value?.type ? value.type : 'string',
      description: typeof value === 'object' && value?.description ? value.description : `Parameter ${key}`,
      required: typeof value === 'object' && value?.optional === false,
      default: typeof value === 'object' ? value?.default : undefined,
    }));

    return {
      name: action.key,
      description: action.description || action.name,
      parameters,
      execute: async (args: Record<string, any>) => {
        return this.executeWorkflow(action.key, args);
      },
    };
  }

  /**
   * Executes a Pipedream workflow or action
   */
  private async executeWorkflow(actionKey: string, args: Record<string, any>): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/workflows/${actionKey}/invoke`,
        args,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Pipedream API error: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Fetches available actions from Pipedream
   */
  private async fetchActions(): Promise<PipedreamAction[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/actions`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      return response.data.data || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Pipedream API error: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Organizes actions into a hierarchical catalog structure
   * Format: app -> category -> tool
   */
  private organizeCatalog(actions: PipedreamAction[]): ToolCatalog {
    const catalog: ToolCatalog = {};

    for (const action of actions) {
      const tool = this.convertActionToTool(action);
      
      // Parse the action key to extract app and category
      // Expected format: "app_name-category-action" or "app_name-action"
      const parts = action.key.split('-');
      const appName = action.app || parts[0] || 'general';
      
      // Initialize app if doesn't exist
      if (!catalog[appName]) {
        catalog[appName] = {};
      }

      // If there are multiple parts, organize by category
      if (parts.length > 2) {
        const category = parts[1] || 'actions';
        const appCatalog = catalog[appName] as ToolCatalog;
        
        if (!appCatalog[category]) {
          appCatalog[category] = {};
        }
        
        const categoryCatalog = appCatalog[category] as ToolCatalog;
        const actionName = parts.slice(2).join('-');
        categoryCatalog[actionName] = tool;
      } else {
        // Direct tool under app
        const appCatalog = catalog[appName] as ToolCatalog;
        const actionName = parts.slice(1).join('-') || action.key;
        appCatalog[actionName] = tool;
      }
    }

    return catalog;
  }

  async getTools(options?: ToolFilterOptions): Promise<ToolCatalog> {
    if (!this.cachedCatalog) {
      const actions = await this.fetchActions();
      this.cachedCatalog = this.organizeCatalog(actions);
    }

    // If filtering by toolkits, filter the cached catalog
    if (options?.toolkits && options.toolkits.length > 0) {
      const filtered: ToolCatalog = {};
      const toolkitNames = options.toolkits.map(t => t.toLowerCase());
      
      for (const [key, value] of Object.entries(this.cachedCatalog)) {
        if (toolkitNames.includes(key.toLowerCase())) {
          filtered[key] = value;
        }
      }
      
      return filtered;
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

