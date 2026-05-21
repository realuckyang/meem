import { normalizeUsage } from "./usage.js";

// 返回 { message, usage }——和 LLM 响应结构对齐，互不混淆。
// message 是 choices[0].message 原对象，所有字段保留（reasoning_content 等），
// usage 是顶级 usage，单独给出。
const parseRegularResponse = async (res) => {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM ${res.status}: ${text}`);
  }

  const json = await res.json();
  const message = json?.choices?.[0]?.message;
  if (!message) {
    throw new Error("LLM response missing choices[0].message");
  }

  return {
    message,
    usage: normalizeUsage(json?.usage),
  };
};

export { parseRegularResponse };
