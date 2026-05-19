const asNumber = (value) => (
  typeof value === "number" && Number.isFinite(value) ? value : undefined
);

const asString = (value) => (
  typeof value === "string" && value.trim() ? value.trim() : undefined
);

const getActiveChromeTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found");
  return tab;
};

const cleanTab = (tab) => ({
  id: tab.id,
  windowId: tab.windowId,
  active: Boolean(tab.active),
  title: tab.title || "",
  url: tab.url || "",
});

const get_active_tab = async () => {
  return cleanTab(await getActiveChromeTab());
};

const list_tabs = async () => {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs.map(cleanTab);
};

const navigate_active_tab = async ({ url } = {}) => {
  const targetUrl = asString(url);
  if (!targetUrl) throw new Error("url is required");
  const tab = await getActiveChromeTab();
  await chrome.tabs.update(tab.id, { url: targetUrl });
  return { tabId: tab.id, url: targetUrl };
};

const inspect_page = async ({ maxChars } = {}) => {
  const tab = await getActiveChromeTab();
  if (!tab.id) throw new Error("No active tab ID");
  const limit = Math.min(Math.max(asNumber(maxChars) ?? 6000, 1000), 20000);

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (textLimit) => {
      const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
        .slice(0, 24)
        .map((node) => ({
          tag: node.tagName.toLowerCase(),
          text: node.textContent?.trim().replace(/\s+/g, " ") || "",
        }))
        .filter((item) => item.text);

      const links = Array.from(document.querySelectorAll("a[href]"))
        .slice(0, 40)
        .map((node) => ({
          text: node.textContent?.trim().replace(/\s+/g, " ") || "",
          href: node.href,
        }))
        .filter((item) => item.text || item.href);

      const text = document.body?.innerText
        ?.replace(/\s+\n/g, "\n")
        .trim()
        .slice(0, textLimit) || "";

      return {
        title: document.title,
        url: location.href,
        selection: String(getSelection() || "").trim(),
        headings,
        links,
        text,
      };
    },
    args: [limit],
  });

  return result?.result || { title: tab.title, url: tab.url, text: "" };
};

export {
  get_active_tab,
  inspect_page,
  list_tabs,
  navigate_active_tab,
};
