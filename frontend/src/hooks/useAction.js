import { useRef, useState } from "react";
import { errorMessage } from "../services/apiClient";
export function useAction() {
  const lock = useRef(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(action) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, setError, run };
}
