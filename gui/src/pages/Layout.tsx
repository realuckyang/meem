import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import TabBar, { type Tab } from '../components/TabBar';

const ROOT_PATHS: Record<Tab, string> = {
  messages: '/messages',
  contacts: '/contacts',
  feed:     '/feed',
  agents:   '/agents',
  me:       '/me',
};

function pickTab(pathname: string): Tab | null {
  if (pathname.startsWith('/messages')) return 'messages';
  if (pathname.startsWith('/contacts')) return 'contacts';
  if (pathname.startsWith('/feed'))     return 'feed';
  if (pathname.startsWith('/agents'))   return 'agents';
  if (pathname.startsWith('/sessions')) return 'agents';  // 会话进入也算智能体 tab
  if (pathname.startsWith('/me'))       return 'me';
  return null;
}

function isRoot(pathname: string): boolean {
  return ['/messages', '/contacts', '/feed', '/agents', '/me'].includes(pathname);
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = pickTab(location.pathname);
  const showTab = isRoot(location.pathname);

  return (
    <div className="flex flex-col h-full max-w-[760px] mx-auto bg-neutral-100 border-x border-neutral-200">
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
      {showTab && tab && (
        <TabBar
          active={tab}
          onChange={(next) => navigate(ROOT_PATHS[next])}
        />
      )}
    </div>
  );
}
