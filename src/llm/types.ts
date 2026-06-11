/**
 * LLM abstraction (ARCHITECTURE.md: Tauri-ready — WebLLM ↔ Ollama ↔ any
 * OpenAI-compatible endpoint behind one interface).
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GenerateOptions {
  maxTokens?: number
  temperature?: number
}

export interface CallerEngine {
  readonly kind: 'webllm' | 'endpoint' | 'mock'
  generate(messages: ChatMessage[], opts?: GenerateOptions): Promise<string>
  dispose?(): void
}

export type LlmTier = 'tier1' | 'webllm' | 'endpoint'

export interface EndpointConfig {
  url: string
  apiKey: string
  model: string
}

export const WEBLLM_MODELS = [
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 3B (Standard, ~1,9 GB)' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B (Low-End, ~0,9 GB)' },
] as const

export type WebLlmModelId = (typeof WEBLLM_MODELS)[number]['id']
