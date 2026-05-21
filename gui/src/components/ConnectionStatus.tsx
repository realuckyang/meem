import { useEffect, useState } from 'react';
import { req } from '../lib/api';
import { onFrame } from '../lib/socket';

interface Status {
  online: boolean;
  extension: boolean;
  extensionBg?: boolean;
  web: boolean;
}

export function useConnectionStatus(): Status {
  const [status, setStatus] = useState<Status>({ online: false, extension: false, extensionBg: false, web: false });

  useEffect(() => {
    const load = () => req<Status>('/api/status').then(setStatus).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    const off = onFrame((f: any) => {
      if (f.type === 'ws:open' || f.type === 'presence') load();
    });
    return () => { clearInterval(t); off(); };
  }, []);

  return status;
}
