import { createContext, useContext, useEffect, useState } from "react";
import { authService } from "../services/authService";
import { TOKEN_KEY, errorMessage } from "../services/apiClient";
const Context = createContext(null);
export const useAuth = () => useContext(Context);
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY)),
    [user, setUser] = useState(null),
    [loading, setLoading] = useState(Boolean(token)),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    if (sessionStorage.getItem(TOKEN_KEY))
      authService
        .me()
        .then((u) => {
          if (active && sessionStorage.getItem(TOKEN_KEY)) setUser(u);
        })
        .catch((e) => {
          if (active) {
            sessionStorage.removeItem(TOKEN_KEY);
            setToken(null);
            setNotice(
              e.response?.status === 401
                ? "Your session has expired. Please sign in again."
                : errorMessage(e),
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    const expire = () => {
      setUser(null);
      setToken(null);
      setLoading(false);
      setNotice("Your session has expired. Please sign in again.");
    };
    window.addEventListener("session-expired", expire);
    return () => {
      active = false;
      window.removeEventListener("session-expired", expire);
    };
  }, []);
  async function login(body) {
    const result = await authService.login(body);
    sessionStorage.setItem(TOKEN_KEY, result.access_token);
    setToken(result.access_token);
    setUser(result.user);
    setNotice("");
  }
  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setNotice("");
  }
  return (
    <Context.Provider value={{ user, token, loading, notice, login, logout }}>
      {children}
    </Context.Provider>
  );
}
