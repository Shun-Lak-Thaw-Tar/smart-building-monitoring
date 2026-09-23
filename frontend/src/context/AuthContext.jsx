import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { authService } from "../services/authService";
import { TOKEN_KEY } from "../services/apiClient";
const Context = createContext(null);
export const useAuth = () => useContext(Context);
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY)),
    [user, setUser] = useState(null),
    [loading, setLoading] = useState(Boolean(token)),
    [temporarilyUnavailable, setTemporarilyUnavailable] = useState(false),
    [notice, setNotice] = useState("");
  const restoration = useRef(null);
  const restore = useCallback(() => {
    if (restoration.current) return restoration.current;
    if (!sessionStorage.getItem(TOKEN_KEY)) {
      setToken(null);
      setUser(null);
      setLoading(false);
      setTemporarilyUnavailable(false);
      return Promise.resolve();
    }
    setLoading(true);
    setTemporarilyUnavailable(false);
    const attempt = authService
      .me()
      .then((u) => {
        if (sessionStorage.getItem(TOKEN_KEY)) {
          setUser(u);
          setNotice("");
        }
      })
      .catch((e) => {
        if (e.response?.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
          setNotice("auth.sessionExpired");
        } else {
          setUser(null);
          setTemporarilyUnavailable(true);
          setNotice("login.sessionUnavailableTitle");
        }
      })
      .finally(() => {
        setLoading(false);
        restoration.current = null;
      });
    restoration.current = attempt;
    return attempt;
  }, []);
  useEffect(() => {
    restore();
    const expire = () => {
      setUser(null);
      setToken(null);
      setLoading(false);
      setTemporarilyUnavailable(false);
      setNotice("auth.sessionExpired");
    };
    window.addEventListener("session-expired", expire);
    return () => {
      window.removeEventListener("session-expired", expire);
    };
  }, [restore]);
  async function login(body) {
    const result = await authService.login(body);
    sessionStorage.setItem(TOKEN_KEY, result.access_token);
    setToken(result.access_token);
    setUser(result.user);
    setTemporarilyUnavailable(false);
    setNotice("");
  }
  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setTemporarilyUnavailable(false);
    setNotice("");
  }
  return (
    <Context.Provider
      value={{
        user,
        token,
        loading,
        temporarilyUnavailable,
        notice,
        login,
        logout,
        retry: restore,
      }}
    >
      {children}
    </Context.Provider>
  );
}
