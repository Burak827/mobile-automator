import { requireValue, type EnvConfig } from './config.js';
import type { AIConfig, AIProvider } from './translate.js';

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-6';
const DEFAULT_ANTHROPIC_VERSION = '2023-06-01';

export function parseAIProvider(value: unknown): AIProvider | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'openai' || normalized === 'chatgpt') return 'openai';
  if (normalized === 'anthropic' || normalized === 'claude') return 'anthropic';
  return null;
}

export function getAvailableAIProviders(env: EnvConfig): AIProvider[] {
  const providers: AIProvider[] = [];
  if (env.openaiApiKey) providers.push('openai');
  if (env.anthropicApiKey) providers.push('anthropic');
  return providers;
}

export function getDefaultAIProvider(env: EnvConfig): AIProvider {
  const configured = parseAIProvider(env.aiProvider);
  const available = getAvailableAIProviders(env);
  if (configured && available.includes(configured)) return configured;
  if (available.length > 0) return available[0]!;
  return configured ?? 'openai';
}

export function getAIProviderLabel(provider: AIProvider): string {
  return provider === 'anthropic' ? 'Claude Opus' : 'ChatGPT';
}

export function resolveAIConfig(env: EnvConfig, providerInput?: unknown): AIConfig {
  const provider = parseAIProvider(providerInput) ?? getDefaultAIProvider(env);

  if (provider === 'anthropic') {
    return {
      provider,
      apiKey: requireValue(env.anthropicApiKey, 'ANTHROPIC_API_KEY'),
      model: env.anthropicModel ?? DEFAULT_ANTHROPIC_MODEL,
      baseUrl: env.anthropicBaseUrl,
      version: env.anthropicVersion ?? DEFAULT_ANTHROPIC_VERSION,
    };
  }

  return {
    provider: 'openai',
    apiKey: requireValue(env.openaiApiKey, 'OPENAI_API_KEY'),
    model: env.openaiModel ?? DEFAULT_OPENAI_MODEL,
    baseUrl: env.openaiBaseUrl,
  };
}
