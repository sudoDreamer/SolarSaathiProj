import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { bindSession, clearSession, refreshSession, type Viewer } from './api';
const SessionContext = createContext<{ user: Viewer | null; loading: boolean }>({
  user: null,
  loading: true,
});
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Viewer | null>(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    bindSession(setUser);
    void refreshSession()
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    const channel = new BroadcastChannel('solarsaathi-auth');
    channel.onmessage = () => clearSession();
    return () => {
      channel.close();
      bindSession(() => undefined);
    };
  }, []);
  return <SessionContext.Provider value={{ user, loading }}>{children}</SessionContext.Provider>;
}
export const useSession = () => useContext(SessionContext);
