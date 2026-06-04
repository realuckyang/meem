import { useEffect, useState } from 'react';
import { APPS, appFromPath, pathForApp, type AppId } from './system/registry';
import AuthScreen from './system/AuthScreen';
import { api, clearToken, getToken } from './system/lib/api';
import InstallApp from './apps/install';
import DeviceSheet from './apps/devices/DeviceSheet';
import { NavContext, type InstallKind } from './system/nav';

const installFromPath = (pathname = location.pathname): InstallKind | null => {
  const slug = pathname.match(/^\/install\/([^/]+)/)?.[1];
  return slug === 'client' || slug === 'extension' ? slug : null;
};

export default function App() {
  const [activeApp, setActiveApp] = useState<AppId>(() => appFromPath());
  const [install, setInstall] = useState<InstallKind | null>(() => installFromPath());
  const [ready, setReady] = useState(false);
  const [authKey, setAuthKey] = useState(0);
  const [deviceTarget, setDeviceTarget] = useState<string | 'new' | null>(null);

  useEffect(() => {
    if (!getToken()) { setReady(false); return; }
    api.me().then(() => setReady(true)).catch(() => { clearToken(); setReady(false); });
  }, [authKey]);

  useEffect(() => {
    const onPop = () => { setInstall(installFromPath()); setActiveApp(appFromPath()); };
    addEventListener('popstate', onPop);
    if (location.pathname === '/' || location.pathname === '') history.replaceState(null, '', pathForApp('chat'));
    return () => removeEventListener('popstate', onPop);
  }, []);

  function openApp(app: AppId) {
    setActiveApp(app);
    setInstall(null);
    const next = pathForApp(app);
    if (location.pathname !== next) history.pushState(null, '', next);
  }

  function openInstall(kind: InstallKind) {
    setInstall(kind);
    const next = `/install/${kind}`;
    if (location.pathname !== next) history.pushState(null, '', next);
  }

  const Active = APPS.find((app) => app.id === activeApp)?.Component ?? APPS[0].Component;

  return (
    <NavContext.Provider value={{ activeApp, openApp, openInstall, openDevice: (id) => setDeviceTarget(id ?? 'new') }}>
      {/* ambient cyberpunk layers */}
      <div className="neon-field" aria-hidden />
      <div className="relative z-[1] h-full">
        {!ready ? (
          <AuthScreen onReady={() => setAuthKey((key) => key + 1)} />
        ) : install ? (
          <InstallApp kind={install} />
        ) : (
          <Active />
        )}
      </div>
      {ready && <DeviceSheet target={deviceTarget} onClose={() => setDeviceTarget(null)} />}
      <div className="neon-scan" aria-hidden />
    </NavContext.Provider>
  );
}
