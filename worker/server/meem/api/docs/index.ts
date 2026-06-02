// 文档(私有)· 薄分发:docs/notebooks → notebooks,docs/pages → pages
import { json, type RouteCtx } from '../../http';
import { notebooks } from './notebooks';
import { pages } from './pages';

export async function docs(c: RouteCtx): Promise<Response> {
  if (c.p === 'docs/notebooks') return notebooks(c);
  if (c.p === 'docs/pages') return pages(c);
  return json({ error: 'not found' }, 404);
}
