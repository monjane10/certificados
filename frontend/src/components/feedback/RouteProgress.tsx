import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/** Barra fina de progresso no topo durante transições de rota. */
export function RouteProgress() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 600);
    return () => clearTimeout(t);
  }, [pathname]);

  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-transparent" aria-hidden>
      <div className="h-full w-1/3 rounded-full bg-emerald-500 animate-route-progress" />
    </div>
  );
}
