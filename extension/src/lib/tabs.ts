export interface ActiveTabInfo {
  id?: number;
  title: string;
  url: string;
}

export async function readActiveTab(): Promise<ActiveTabInfo | null> {
  if (typeof chrome === 'undefined' || !chrome.tabs) return null;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return null;
  return {
    id: tab.id,
    title: tab.title || '',
    url: tab.url || ''
  };
}
