import OpenAI from 'openai';
import dotenv from 'dotenv';
import { ILLMClient, LLMFunction } from './types';

// Load environment variables
dotenv.config();

export class OpenAIClient implements ILLMClient {
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    
    this.client = new OpenAI({
      apiKey: apiKey,
    });
  }

  /**
   * Gets an LLM function for a specific model
   * @param modelId The OpenAI model ID (e.g., "gpt-4", "gpt-3.5-turbo")
   * @returns A function that can send messages to the model
   */
  getLLM(modelId: string): LLMFunction {
    return async (message: string): Promise<string> => {
      try {
        const response = await this.client.chat.completions.create({
          model: modelId,
          messages: [
            {
              role: 'user',
              content: message,
            },
          ],
        });

        return response.choices[0]?.message?.content || '';
      } catch (error) {
        if (error instanceof OpenAI.APIError) {
          throw new Error(`OpenAI API error: ${error.message}`);
        }
        throw error;
      }
    };
  }
}

