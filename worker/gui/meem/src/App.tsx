import { useEffect, useState } from 'react';
import AppLauncher from './system/AppLauncher';
import { APPS, appFromPath, pathForApp, type AppId } from './system/registry';
import AuthScreen from './system/AuthScreen';
import { api, clearToken, getToken } from './system/lib/api';
import InstallApp from './apps/install';

type InstallKind = 'client' | 'extension';
const installFromPath = (pathname = location.pathname): InstallKind | null => {
  const slug = pathname.match(/^\/meem\/install\/([^/]+)/)?.[1];
  return slug === 'client' || slug === 'extension' ? slug : null;
};

export default function App() {
  const [activeApp, setActiveApp] = useState<AppId>(() => appFromPath());
  const [install, setInstall] = useState<InstallKind | null>(() => installFromPath());
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [authKey, setAuthKey] = useState(0);

  useEffect(() => {
    if (!getToken()) { setReady(false); return; }
    api.me().then(() => setReady(true)).catch(() => { clearToken(); setReady(false); });
  }, [authKey]);

  useEffect(() => {
    const onPop = () => { setInstall(installFromPath()); setActiveApp(appFromPath()); };
    addEventListener('popstate', onPop);
    if (location.pathname === '/meem' || location.pathname === '/meem/') history.replaceState(null, '', pathForApp('chat'));
    return () => removeEventListener('popstate', onPop);
  }, []);

  function openApp(app: AppId) {
    setActiveApp(app);
    setInstall(null);
    setLauncherOpen(false);
    const next = pathForApp(app);
    if (location.pathname !== next) history.pushState(null, '', next);
  }

  function openInstall(kind: InstallKind) {
    setInstall(kind);
    setLauncherOpen(false);
    const next = `/meem/install/${kind}`;
    if (location.pathname !== next) history.pushState(null, '', next);
  }

  if (!ready) return <AuthScreen onReady={() => setAuthKey((key) => key + 1)} />;

  const Active = APPS.find((app) => app.id === activeApp)?.Component ?? APPS[0].Component;

  return (
    <div className="h-full">
      {install ? <InstallApp kind={install} activeApp={activeApp} openApps={() => setLauncherOpen(true)} /> : <Active activeApp={activeApp} openApps={() => setLauncherOpen(true)} />}
      <AppLauncher activeApp={activeApp} open={launcherOpen} onClose={() => setLauncherOpen(false)} onPick={openApp} onInstall={openInstall} />
    </div>
  );
}
