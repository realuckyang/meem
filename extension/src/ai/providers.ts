import { getProviderCatalog } from '../llm/providers.js';
import type { ChatSettings, ProviderConfig } from './types';

const catalog = getProviderCatalog() as unknown as {
  providers: Array<ProviderConfig & { group?: string }>;
};

export const providers = catalog.providers;

export const defaultSettings: ChatSettings = {
  displayName: '',
  description: '',
  provider: 'openai',
  apiUrl: providers.find((provider) => provider.id === 'openai')?.apiUrl || '',
  apiKey: '',
  model: providers.find((provider) => provider.id === 'openai')?.defaultModel || '',
  avatarWorkerUrl: 'https://meem-extension.chatnext.ai',
  avatarId: '',
  avatarToken: '',
  avatarMode: 'off'
};

export function getProvider(id: string): ProviderConfig {
  return providers.find((provider) => provider.id === id) ?? providers[0];
}

export function settingsForProvider(id: string, current: ChatSettings): ChatSettings {
  const provider = getProvider(id);
  return {
    provider: provider.id,
    displayName: current.displayName,
    description: current.description,
    apiUrl: provider.apiUrl || current.apiUrl,
    apiKey: current.apiKey,
    model: provider.defaultModel || current.model,
    avatarWorkerUrl: current.avatarWorkerUrl,
    avatarId: current.avatarId,
    avatarToken: current.avatarToken,
    avatarMode: current.avatarMode
  };
}
