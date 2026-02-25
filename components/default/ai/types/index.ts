/**
 * AI Module Types
 *
 * Types for AI text generation and processing
 */

export interface AIGenerationOptions {
  operation?: string;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  format?: string;
  tone?: string;
  language?: string;
  append?: boolean;
}

export interface AIGenerationResponse {
  response: string;
  operation: string;
  model: string;
}
