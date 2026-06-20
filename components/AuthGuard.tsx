'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const allowedPaths = ['/assistant'];

export function ChatOnlyGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (allowedPaths.includes(pathname)) return;
    router.replace('/assistant');
  }, [pathname, router]);

  return null;
}

export function SessionCleanup() {
  useEffect(() => {
    function clearSession() {
      const idFileName = sessionStorage.getItem('elderly-id-file');
      if (idFileName) {
        fetch(`/api/pdf/files/${encodeURIComponent(idFileName)}`, { method: 'DELETE', keepalive: true }).catch(() => undefined);
      }
      sessionStorage.removeItem('elderly-flow-active');
      sessionStorage.removeItem('report-workflow-language');
      sessionStorage.removeItem('elderly-id-file');
      localStorage.removeItem('report-workflow-user');
    }
    window.addEventListener('beforeunload', clearSession);
    window.addEventListener('pagehide', clearSession);
    return () => {
      window.removeEventListener('beforeunload', clearSession);
      window.removeEventListener('pagehide', clearSession);
    };
  }, []);

  return null;
}
