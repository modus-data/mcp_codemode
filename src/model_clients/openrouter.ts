import axios from 'axios';
import dotenv from 'dotenv';
import { ILLMClient, LLMFunction } from './types.js';

// Load environment variables
dotenv.config();

interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OpenRouterResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
  }[];
}

export class OpenRouterClient implements ILLMClient {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not set in environment variables');
    }
    
    this.apiKey = apiKey;
  }

  /**
   * Gets an LLM function for a specific model
   * @param modelId The OpenRouter model ID (e.g., "anthropic/claude-3-sonnet")
   * @returns A function that can send messages to the model
   */
  getLLM(modelId: string): LLMFunction {
    return async (message: string): Promise<string> => {
      try {
        const response = await axios.post<OpenRouterResponse>(
          `${this.baseUrl}/chat/completions`,
          {
            model: modelId,
            messages: [
              {
                role: 'user',
                content: message,
              } as OpenRouterMessage,
            ],
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://github.com/mcp_codemode',
              'X-Title': 'MCP Codemode',
            },
          }
        );

        return response.data.choices[0].message.content;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          throw new Error(`OpenRouter API error: ${error.response?.data?.error?.message || error.message}`);
        }
        throw error;
      }
    };
  }
}

