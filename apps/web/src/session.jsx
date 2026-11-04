import { createContext, useContext, useEffect, useState } from 'react';
import { bindSession, clearSession, refreshSession } from './api.js';
const SessionContext = createContext({
  user: null,
  loading: true,
});
export function SessionProvider({ children }) {
  const [user, setUser] = useState(null),
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
