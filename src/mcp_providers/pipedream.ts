import dotenv from 'dotenv';
import { IMCPProvider, MCPTool, ToolParameter, ToolCatalog, ToolFilterOptions } from './types';

// Load environment variables
dotenv.config();

// Environment variables for Pipedream
const PIPEDREAM_CLIENT_ID = process.env.PIPEDREAM_CLIENT_ID;
const PIPEDREAM_CLIENT_SECRET = process.env.PIPEDREAM_CLIENT_SECRET;
const PIPEDREAM_PROJECT_ID = process.env.PIPEDREAM_PROJECT_ID;
const PIPEDREAM_ENVIRONMENT = process.env.PIPEDREAM_ENVIRONMENT || 'production';

interface PipedreamActionProp {
  name: string;
  type: string;
  label?: string;
  description?: string;
  optional?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  remoteOptions?: boolean;
  useQuery?: boolean;
  reloadProps?: boolean;
  withLabel?: boolean;
}

interface PipedreamAction {
  key: string;
  name: string;
  version: string;
  description: string;
  componentType: string;
  configurableProps: PipedreamActionProp[];
}

interface PipedreamAccount {
  id: string;
  name?: string;
  app?: {
    name_slug?: string;
  };
}

/**
 * Configuration options for Pipedream provider
 */
export interface PipedreamConfig {
  clientId?: string;
  clientSecret?: string;
  projectId?: string;
  projectEnvironment?: 'production' | 'development';
  externalUserId?: string;
}

/**
 * Pipedream MCP Provider implementation
 * Provides access to Pipedream workflows and actions as MCP tools
 * Uses the Pipedream Connect API directly for API interactions
 */
export class PipedreamProvider implements IMCPProvider {
  private clientId: string;
  private clientSecret: string;
  private projectId: string;
  private projectEnvironment: string;
  private externalUserId: string;
  private cachedCatalog: ToolCatalog | null = null;
  private actionCache: Map<string, PipedreamAction> = new Map();
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config?: PipedreamConfig) {
    this.clientId = config?.clientId || PIPEDREAM_CLIENT_ID || '';
    this.clientSecret = config?.clientSecret || PIPEDREAM_CLIENT_SECRET || '';
    this.projectId = config?.projectId || PIPEDREAM_PROJECT_ID || '';
    this.projectEnvironment = config?.projectEnvironment || PIPEDREAM_ENVIRONMENT;
    this.externalUserId = config?.externalUserId || 'default';

    if (!this.clientId || !this.clientSecret || !this.projectId) {
      throw new Error(
        'Pipedream configuration is incomplete. Provide clientId, clientSecret, and projectId ' +
        'via config or environment variables (PIPEDREAM_CLIENT_ID, PIPEDREAM_CLIENT_SECRET, PIPEDREAM_PROJECT_ID)'
      );
    }
  }

  /**
   * Get an OAuth access token using client credentials flow
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    const tokenResponse = await fetch('https://api.pipedream.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'grant_type': 'client_credentials',
        'client_id': this.clientId,
        'client_secret': this.clientSecret
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Failed to get Pipedream access token: ${tokenResponse.status} ${errorText}`);
    }

    const tokenData = await tokenResponse.json() as { access_token: string; expires_in: number };
    this.accessToken = tokenData.access_token;
    this.tokenExpiresAt = Date.now() + (tokenData.expires_in * 1000);

    return this.accessToken;
  }

  /**
   * List actions from Pipedream, optionally filtered by app
   */
  async listActions(options?: { app?: string; q?: string; limit?: number }): Promise<PipedreamAction[]> {
    const accessToken = await this.getAccessToken();
    
    const url = `https://api.pipedream.com/v1/connect/${this.projectId}/actions`;
    const queryParams = new URLSearchParams();
    
    if (options?.app) {
      queryParams.append('app', options.app);
    }
    if (options?.q) {
      queryParams.append('q', options.q);
    }
    if (options?.limit) {
      queryParams.append('limit', options.limit.toString());
    }

    const response = await fetch(`${url}?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-pd-environment': this.projectEnvironment,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list Pipedream actions: ${response.status} ${errorText}`);
    }

    const data = await response.json() as { data: any[] };
    const actions: PipedreamAction[] = (data.data || []).map((action: any) => ({
      key: action.key,
      name: action.name,
      version: action.version || '',
      description: action.description || '',
      componentType: action.component_type || '',
      configurableProps: (action.configurable_props || []).map((prop: any) => ({
        name: prop.name,
        type: prop.type,
        label: prop.label,
        description: prop.description,
        optional: prop.optional,
        disabled: prop.disabled,
        hidden: prop.hidden,
        remoteOptions: prop.remoteOptions,
        useQuery: prop.useQuery,
        reloadProps: prop.reloadProps,
        withLabel: prop.withLabel
      }))
    }));

    // Cache the actions
    for (const action of actions) {
      this.actionCache.set(action.key, action);
    }

    return actions;
  }

  /**
   * Retrieve action details from Pipedream API
   */
  private async retrieveAction(actionKey: string): Promise<PipedreamAction> {
    // Check cache first
    if (this.actionCache.has(actionKey)) {
      return this.actionCache.get(actionKey)!;
    }

    const accessToken = await this.getAccessToken();
    const url = `https://api.pipedream.com/v1/connect/${this.projectId}/actions/${actionKey}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-pd-environment': this.projectEnvironment,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to retrieve Pipedream action ${actionKey}: ${response.status} ${errorText}`);
    }

    const data = await response.json() as { data: any };
    const action = data.data;

    const result: PipedreamAction = {
      key: action.key,
      name: action.name,
      version: action.version || '',
      description: action.description || '',
      componentType: action.component_type || '',
      configurableProps: (action.configurable_props || []).map((prop: any) => ({
        name: prop.name,
        type: prop.type,
        label: prop.label,
        description: prop.description,
        optional: prop.optional,
        disabled: prop.disabled,
        hidden: prop.hidden,
        remoteOptions: prop.remoteOptions,
        useQuery: prop.useQuery,
        reloadProps: prop.reloadProps,
        withLabel: prop.withLabel,
      })),
    };

    // Cache the result
    this.actionCache.set(actionKey, result);
    return result;
  }

  /**
   * List connected Pipedream accounts for a user
   */
  async listConnectedAccounts(): Promise<PipedreamAccount[]> {
    const accessToken = await this.getAccessToken();
    const url = `https://api.pipedream.com/v1/connect/${this.projectId}/accounts`;
    const queryParams = new URLSearchParams();
    queryParams.append('external_user_id', this.externalUserId);

    const response = await fetch(`${url}?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-pd-environment': this.projectEnvironment,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list Pipedream accounts: ${response.status} ${errorText}`);
    }

    const data = await response.json() as { data: any[] };
    return data.data || [];
  }

  /**
   * Run a Pipedream action
   */
  private async runAction(
    actionKey: string,
    configuredProps?: Record<string, any>,
    appPropName?: string
  ): Promise<any> {
    let props = { ...configuredProps };

    // If there's an app prop, find the connected account and add it to configured_props
    if (appPropName) {
      const accounts = await this.listConnectedAccounts();
      const matchingAccount = accounts.find((acc) => acc.app?.name_slug === appPropName);

      if (matchingAccount) {
        props[appPropName] = {
          authProvisionId: matchingAccount.id,
        };
      } else {
        throw new Error(`No ${appPropName} account connected for user: ${this.externalUserId}`);
      }
    }

    const accessToken = await this.getAccessToken();
    const url = `https://api.pipedream.com/v1/connect/${this.projectId}/actions/run`;

    const requestBody = {
      id: actionKey,
      external_user_id: this.externalUserId,
      configured_props: props
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-pd-environment': this.projectEnvironment,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to run Pipedream action ${actionKey}: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Converts Pipedream action to MCPTool format
   */
  private convertActionToTool(action: PipedreamAction): MCPTool {
    // Find the app prop (usually first prop with type "app")
    const appProp = action.configurableProps.find((p) => p.type === 'app');

    // Build parameters from configurable props
    const parameters: ToolParameter[] = action.configurableProps
      .filter((prop) => !prop.hidden && !prop.disabled && prop.type !== 'app')
      .map((prop) => ({
        name: prop.name,
        type: this.mapPipedreamType(prop.type),
        description: prop.description || prop.label || `Parameter ${prop.name}`,
        required: !prop.optional,
      }));

    return {
      name: action.key,
      description: action.description || action.name,
      parameters,
      execute: async (args: Record<string, any>) => {
        const result = await this.runAction(action.key, args, appProp?.name);

        // Format the result appropriately
        if (result.ret !== undefined && result.ret !== null) {
          return typeof result.ret === 'string' ? result.ret : result.ret;
        } else if (result.exports && Object.keys(result.exports).length > 0) {
          return result.exports;
        } else if (result.os && result.os.length > 0) {
          return result.os;
        } else {
          return result;
        }
      },
    };
  }

  /**
   * Maps Pipedream prop types to standard types
   */
  private mapPipedreamType(pipedreamType: string): string {
    switch (pipedreamType) {
      case 'string':
        return 'string';
      case 'integer':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'object':
        return 'object';
      case 'array':
        return 'array';
      default:
        return 'any';
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
      const appProp = action.configurableProps.find((p) => p.type === 'app');
      const appName = appProp?.name || parts[0] || 'general';

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

  /**
   * Gets tools from a toolset configuration
   * @param toolset - Record where keys are app IDs and values are arrays of action keys
   */
  async getToolsFromToolset(toolset: Record<string, string[]>): Promise<MCPTool[]> {
    const actionKeysToFetch: string[] = [];

    for (const [appId, actionKeys] of Object.entries(toolset)) {
      if (!Array.isArray(actionKeys) || actionKeys.length === 0) {
        continue;
      }
      actionKeysToFetch.push(...actionKeys);
    }

    // Fetch all actions concurrently
    const results = await Promise.allSettled(
      actionKeysToFetch.map(async (actionKey) => {
        const action = await this.retrieveAction(actionKey);
        return this.convertActionToTool(action);
      })
    );

    // Extract successful tools
    const tools: MCPTool[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        tools.push(result.value);
      }
    }

    return tools;
  }

  /**
   * Get tools from Pipedream
   * @param options.toolkits - Array of app names (e.g., ['slack', 'gmail']) or action keys
   *                          App names will list all actions for that app
   *                          Action keys (containing '-') will fetch specific actions
   */
  async getTools(options?: ToolFilterOptions): Promise<ToolCatalog> {
    // If we have a cached catalog and no specific filtering, return it
    if (this.cachedCatalog && (!options?.toolkits || options.toolkits.length === 0)) {
      return this.cachedCatalog;
    }

    // If filtering by toolkits
    if (options?.toolkits && options.toolkits.length > 0) {
      const allActions: PipedreamAction[] = [];

      // Separate app names from action keys
      // App names typically don't have '-', action keys do (e.g., 'slack-send-message')
      const appNames: string[] = [];
      const actionKeys: string[] = [];

      for (const toolkit of options.toolkits) {
        // If it contains a '-', treat as action key; otherwise as app name
        if (toolkit.includes('-')) {
          actionKeys.push(toolkit);
        } else {
          appNames.push(toolkit);
        }
      }

      // Fetch actions for each app name
      console.log(`\n📦 Fetching tools from Pipedream:`);
      
      if (appNames.length > 0) {
        console.log(`   Apps to fetch: ${appNames.join(', ')}`);
        const appResults = await Promise.allSettled(
          appNames.map(async (appName) => {
            console.log(`   → Fetching actions for app: ${appName}...`);
            const actions = await this.listActions({ app: appName, limit: 100 });
            console.log(`   ✓ Found ${actions.length} actions for ${appName}`);
            return actions;
          })
        );

        for (const result of appResults) {
          if (result.status === 'fulfilled') {
            allActions.push(...result.value);
          } else {
            console.error(`   ✗ Failed to fetch app actions:`, result.reason);
          }
        }
      }

      // Fetch specific action keys
      if (actionKeys.length > 0) {
        console.log(`   Action keys to fetch: ${actionKeys.join(', ')}`);
        const keyResults = await Promise.allSettled(
          actionKeys.map((actionKey) => this.retrieveAction(actionKey))
        );

        for (const result of keyResults) {
          if (result.status === 'fulfilled') {
            allActions.push(result.value);
          } else {
            console.error(`   ✗ Failed to fetch action:`, result.reason);
          }
        }
      }

      console.log(`   📊 Total actions loaded: ${allActions.length}\n`);

      return this.organizeCatalog(allActions);
    }

    // Return empty catalog if no toolkits specified
    return {};
  }

  async getTool(path: string): Promise<MCPTool | null> {
    // First check if path is a direct action key
    try {
      const action = await this.retrieveAction(path);
      return this.convertActionToTool(action);
    } catch {
      // Path is not a direct action key, try hierarchical lookup
    }

    // Try hierarchical lookup in cached catalog
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

  /**
   * Set the external user ID for multi-tenant support
   */
  setExternalUserId(userId: string): void {
    this.externalUserId = userId;
  }

  /**
   * Get the current external user ID
   */
  getExternalUserId(): string {
    return this.externalUserId;
  }
}
