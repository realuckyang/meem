import { useEffect, useState } from 'react';
import { connStatus, onFrame, type ConnStatus } from './lib/ws';

export function useConnectionStatus(): ConnStatus {
  const [status, setStatus] = useState<ConnStatus>({ ...connStatus });

  useEffect(() => onFrame((frame) => {
    if (frame.type === 'hello' || frame.type === 'connection.status') setStatus({ ...connStatus });
  }), []);

  return status;
}
