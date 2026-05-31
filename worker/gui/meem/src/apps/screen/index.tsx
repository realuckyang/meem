import { useEffect, useRef, useState } from 'react';
import { onFrame, sendWs } from '../../system/lib/ws';
import Topbar from '../../system/Topbar';
import type { SystemAppProps } from '../../system/registry';
import { Button } from '../../system/ui/button';
import ConnectionGuide from '../../system/ConnectionGuide';
import { useConnectionStatus } from '../../system/useConnectionStatus';

export default function ScreenApp(_: SystemAppProps) {
  const [img, setImg] = useState('');
  const [loading, setLoading] = useState(false);
  const reqId = useRef('');
  const status = useConnectionStatus();

  function shot() {
    setLoading(true);
    reqId.current = 'sc' + Date.now();
    sendWs({ type: 'screen.shot', to: 'client', data: { reqId: reqId.current } });
  }
  useEffect(() => {
    const off = onFrame((m: any) => {
      if (m?.type === 'screen.ok' && m.data?.reqId === reqId.current) { setImg(m.data.dataUrl || ''); setLoading(false); }
      if (m?.type === 'screen.err' && m.data?.reqId === reqId.current) setLoading(false);
    });
    if (status.computer) shot();
    return off;
  }, [status.computer]);

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <Topbar title="截图" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!status.computer ? <ConnectionGuide kind="computer" className="h-full" onRetry={() => location.reload()} /> : (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-5">
          <Button variant="outline" className="self-start" onClick={shot} disabled={loading}>{loading ? '截取中...' : '重新截图'}</Button>
          {img
            ? <img className="w-full rounded-lg border border-border" src={img} alt="screen" />
            : <div className="grid aspect-video place-items-center rounded-lg border border-border bg-[#0f1117] text-sm text-muted-foreground">{loading ? '截取中...' : '没有可用截图'}</div>}
        </div>
        )}
      </div>
    </main>
  );
}
