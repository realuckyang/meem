import type { Route } from '../lib/router';
import { navigate, PATH } from '../lib/router';
import AgentChatView from './AgentChatView';
import AgentSettings from './AgentSettings';

export default function Agent({
  onLogout,
  route,
}: {
  onLogout: () => void;
  route: Route;
}) {
  return (
    <div className="h-full relative">
      <AgentChatView
        sessionId={route.overlay === 'session' ? route.sessionId : undefined}
        onSettings={() => navigate(PATH.settings())}
        onOpenSession={(id) => navigate(PATH.session(id))}
        onCloseSession={() => navigate(PATH.codex())}
      />
      {route.overlay && route.overlay !== 'session' && (
        <AgentSettings
          onClose={() => navigate(PATH.codex())}
          onLogout={onLogout}
          overlay={route.overlay}
        />
      )}
    </div>
  );
}
