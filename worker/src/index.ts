import { AvatarRoom } from './ws/room';
import { route } from './api';
import type { Env } from './types';

export { AvatarRoom };
export type { Env };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return route(request, env, ctx);
  },
};
