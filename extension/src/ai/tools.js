const tools = [
  {
    type: "function",
    function: {
      name: "get_active_tab",
      description: "获取当前活动浏览器标签页的标题、URL、tab ID 和 window ID。",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tabs",
      description: "列出当前 Chrome 窗口中的标签页。",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate_active_tab",
      description: "把当前活动标签页导航到指定 URL。",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "目标 URL。通常应包含 https://。",
          },
        },
        required: ["url"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "inspect_page",
      description: "读取当前页面的标题、URL、选中文本、主要标题、链接和可见文本。",
      parameters: {
        type: "object",
        properties: {
          maxChars: {
            type: "number",
            description: "最多返回多少页面文本字符，默认 6000。",
          },
        },
        additionalProperties: false,
      },
    },
  },
];

export { tools };
