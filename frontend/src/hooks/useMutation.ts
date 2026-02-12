import { useState } from "react";

export function useMutation() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function execute<T>(operation: () => Promise<T>): Promise<T | undefined> {
    if (pending) return undefined;
    setPending(true);
    setError(null);
    try {
      return await operation();
    } catch (failure) {
      setError(failure instanceof Error ? failure : new Error("The change could not be saved."));
      return undefined;
    } finally {
      setPending(false);
    }
  }

  return { pending, error, execute, clearError: () => setError(null) };
}
