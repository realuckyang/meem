import { useEffect, useState } from 'react';
import AppLauncher from './system/AppLauncher';
import { APPS, appFromPath, pathForApp, type AppId } from './system/registry';

export default function App() {
  const [activeApp, setActiveApp] = useState<AppId>(() => appFromPath());
  const [launcherOpen, setLauncherOpen] = useState(false);

  useEffect(() => {
    const onPop = () => setActiveApp(appFromPath());
    addEventListener('popstate', onPop);
    if (location.pathname === '/meem' || location.pathname === '/meem/') history.replaceState(null, '', pathForApp('chat'));
    return () => removeEventListener('popstate', onPop);
  }, []);

  function openApp(app: AppId) {
    setActiveApp(app);
    setLauncherOpen(false);
    const next = pathForApp(app);
    if (location.pathname !== next) history.pushState(null, '', next);
  }

  const Active = APPS.find((app) => app.id === activeApp)?.Component ?? APPS[0].Component;

  return (
    <div className="h-full">
      <Active activeApp={activeApp} openApps={() => setLauncherOpen(true)} />
      <AppLauncher activeApp={activeApp} open={launcherOpen} onClose={() => setLauncherOpen(false)} onPick={openApp} />
    </div>
  );
}
