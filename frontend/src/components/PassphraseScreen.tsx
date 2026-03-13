import { useState } from "react";
import type { FormEvent } from "react";
import { useAppLogin } from "../hooks/queries";

interface PassphraseScreenProps {
  onAuthenticated: () => void;
}

export default function PassphraseScreen({ onAuthenticated }: PassphraseScreenProps) {
  const [password, setPassword] = useState("");
  const appLoginMutation = useAppLogin();

  const error = appLoginMutation.error
    ? (appLoginMutation.error instanceof Error ? appLoginMutation.error.message : "Authentication failed")
    : null;
  const loading = appLoginMutation.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    appLoginMutation.mutate(password, { onSuccess: onAuthenticated });
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 dark:border-noc-border bg-white dark:bg-noc-input px-3 py-2.5 text-sm text-gray-900 dark:text-noc-text placeholder-gray-400 dark:placeholder-noc-text-dim focus:border-ub-blue focus:outline-none focus:ring-1 focus:ring-ub-blue/40 transition-colors font-body";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-noc-bg px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,_rgba(0,111,255,0.07)_0%,_transparent_60%)]" />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm bg-white dark:bg-noc-surface border border-gray-200 dark:border-noc-border rounded-xl shadow-lg dark:shadow-2xl p-8 space-y-5 animate-fade-in"
      >
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-ub-blue/50 to-transparent" />

        <h2 className="text-2xl font-display font-semibold text-gray-900 dark:text-noc-text text-center tracking-tight">
          UniFi Firewall Analyser
        </h2>
        <p className="text-sm text-gray-500 dark:text-noc-text-secondary text-center">
          Enter the application password to continue.
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-status-danger-dim border border-red-200 dark:border-status-danger/20 p-3 text-sm text-red-700 dark:text-status-danger">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label
            htmlFor="passphrase"
            className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary"
          >
            Password
          </label>
          <input
            id="passphrase"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Application password"
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ub-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-ub-blue-light focus:outline-none focus:ring-2 focus:ring-ub-blue/40 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-noc-surface disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? "Authenticating..." : "Unlock"}
        </button>
      </form>
    </div>
  );
}
