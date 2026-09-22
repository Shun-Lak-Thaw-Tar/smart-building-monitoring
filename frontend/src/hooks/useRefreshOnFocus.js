import { useEffect, useRef } from "react";
import { useToast } from "../context/ToastContext";

// Refresh operational data once when the user returns, without polling.
export function useRefreshOnFocus(refresh, message = "Could not refresh the latest data.") {
  const refreshRef = useRef(refresh);
  const toast = useToast();
  const toastRef = useRef(toast);
  refreshRef.current = refresh;
  toastRef.current = toast;

  useEffect(() => {
    let refreshing = false;
    let lastRefresh = 0;
    const refreshOnReturn = async () => {
      const now = Date.now();
      if (
        document.visibilityState !== "visible" ||
        refreshing ||
        now - lastRefresh < 1000
      )
        return;
      refreshing = true;
      lastRefresh = now;
      const succeeded = await refreshRef.current({ background: true });
      if (!succeeded) toastRef.current(message);
      refreshing = false;
    };
    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [message]);
}
