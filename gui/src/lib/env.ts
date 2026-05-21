export const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.id;

export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string) ||
  (isExtension ? 'https://meem.yanglong.yun' : '');
