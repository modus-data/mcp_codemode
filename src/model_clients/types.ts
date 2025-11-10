/**
 * LLM function type that takes a message and returns a response
 */
export type LLMFunction = (message: string) => Promise<string>;

/**
 * Generic interface for all LLM client implementations
 */
export interface ILLMClient {
  /**
   * Gets an LLM function for a specific model
   * @param modelId The model identifier (format varies by provider)
   * @returns A function that can send messages to the model
   */
  getLLM(modelId: string): LLMFunction;
}

