import { getProviderCatalog } from '../llm/providers.js';
import type { ChatSettings, ProviderConfig } from './types';

const catalog = getProviderCatalog() as unknown as {
  providers: Array<ProviderConfig & { group?: string }>;
};

export const providers = catalog.providers;

export const defaultSettings: ChatSettings = {
  provider: 'openai',
  apiUrl: providers.find((provider) => provider.id === 'openai')?.apiUrl || '',
  apiKey: '',
  model: providers.find((provider) => provider.id === 'openai')?.defaultModel || '',
  meemBaseUrl: 'https://meem.chatnext.ai',
  meemToken: '',
  avatarEnabled: false
};

export function getProvider(id: string): ProviderConfig {
  return providers.find((provider) => provider.id === id) ?? providers[0];
}

export function settingsForProvider(id: string, current: ChatSettings): ChatSettings {
  const provider = getProvider(id);
  return {
    provider: provider.id,
    apiUrl: provider.apiUrl || current.apiUrl,
    apiKey: current.apiKey,
    model: provider.defaultModel || current.model,
    meemBaseUrl: current.meemBaseUrl,
    meemToken: current.meemToken,
    avatarEnabled: current.avatarEnabled
  };
}
