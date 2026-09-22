import { useEffect, useRef, useState, useCallback } from "react";
import { errorMessage } from "../services/apiClient";
// Sequence checks prevent an older resource response replacing the current selection.
export function useResource(loader, key = "") {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const sequence = useRef(0);
  const stateRef = useRef(null);
  const inFlight = useRef(null);
  const inFlightKey = useRef(null);
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: "",
    key: null,
  });
  stateRef.current = state;
  const refresh = useCallback(({ background = false } = {}) => {
    if (inFlight.current && inFlightKey.current === key)
      return inFlight.current;
    const id = ++sequence.current;
    const keepVisible =
      background &&
      stateRef.current?.key === key &&
      stateRef.current.data !== null;
    if (!keepVisible) setState((s) => ({ ...s, loading: true, error: "" }));
    const request = (async () => {
      try {
        const data = await loaderRef.current();
        if (id === sequence.current) {
          setState({ data, loading: false, error: "", key });
          return true;
        }
        return false;
      } catch (e) {
        if (id === sequence.current) {
          const error = errorMessage(e);
          setState((s) => ({
            ...s,
            loading: false,
            error: keepVisible ? "" : error,
            key,
          }));
        }
        return false;
      }
    })();
    inFlight.current = request;
    inFlightKey.current = key;
    return request.finally(() => {
      if (inFlight.current === request) {
        inFlight.current = null;
        inFlightKey.current = null;
      }
    });
  }, [key]);
  useEffect(() => {
    refresh();
  }, [key, refresh]);
  return state.key === key
    ? { ...state, refresh }
    : { data: null, loading: true, error: "", refresh };
}
