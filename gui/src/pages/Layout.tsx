import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import TabBar, { type Tab } from '../components/TabBar';

const ROOT_PATHS: Record<Tab, string> = {
  messages: '/messages',
  contacts: '/contacts',
  settings: '/settings',
};

function pickTab(pathname: string): Tab | null {
  if (pathname.startsWith('/messages')) return 'messages';
  if (pathname.startsWith('/sessions')) return 'messages';
  if (pathname.startsWith('/contacts')) return 'contacts';
  if (pathname.startsWith('/settings')) return 'settings';
  return null;
}

// 根路径才显示 tab bar；进入子页隐藏
function isRoot(pathname: string): boolean {
  return ['/messages', '/contacts', '/settings'].includes(pathname);
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = pickTab(location.pathname);
  const showTab = isRoot(location.pathname);

  return (
    <div className="flex flex-col h-full max-w-[480px] mx-auto bg-neutral-100 border-x border-neutral-200">
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
