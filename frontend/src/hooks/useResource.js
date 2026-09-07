import { useEffect, useRef, useState, useCallback } from "react";
import { errorMessage } from "../services/apiClient";
// Sequence checks prevent an older resource response replacing the current selection.
export function useResource(loader, key = "") {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const sequence = useRef(0);
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: "",
    key: null,
  });
  const refresh = useCallback(async () => {
    const id = ++sequence.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const data = await loaderRef.current();
      if (id === sequence.current)
        setState({ data, loading: false, error: "", key });
    } catch (e) {
      if (id === sequence.current)
        setState((s) => ({
          ...s,
          loading: false,
          error: errorMessage(e),
          key,
        }));
    }
  }, [key]);
  useEffect(() => {
    refresh();
    return () => {
      sequence.current++;
    };
  }, [key, refresh]);
  return state.key === key
    ? { ...state, refresh }
    : { data: null, loading: true, error: "", refresh };
}
