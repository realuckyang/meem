// 访客登录 token 的本地存取
const KEY = 'meem_visitor_token';

export const vGetToken = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export const vSetToken = (t: string) => { try { localStorage.setItem(KEY, t); } catch { /* */ } };
export const vClearToken = () => { try { localStorage.removeItem(KEY); } catch { /* */ } };
