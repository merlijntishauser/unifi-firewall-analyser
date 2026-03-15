import { useCallback, useEffect, useReducer, useState } from "react";
import { api } from "../api/client";
import type { AiPreset } from "../api/types";
import { useSaveAiConfig, useDeleteAiConfig, useLogin } from "../hooks/queries";
import { useAppContext } from "../hooks/useAppContext";
import type { ThemePreference } from "../hooks/useAppContext";

interface SettingsModalProps {
  onClose: () => void;
}

type SettingsTab = "connection" | "ai" | "user";

// --- Tab button ---

interface TabButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ icon, label, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
        active
          ? "bg-ub-blue/10 dark:bg-ub-blue-dim text-ub-blue dark:text-ub-blue-light"
          : "text-gray-600 dark:text-noc-text-secondary hover:bg-gray-100 dark:hover:bg-noc-raised hover:text-gray-900 dark:hover:text-noc-text"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// --- Tab icons ---

function LinkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
      <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" />
    </svg>
  );
}

function CpuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M14 6H6v8h8V6z" />
      <path fillRule="evenodd" d="M9.25 3V1.75a.75.75 0 011.5 0V3h1.5V1.75a.75.75 0 011.5 0V3h.5A2.75 2.75 0 0117 5.75v.5h1.25a.75.75 0 010 1.5H17v1.5h1.25a.75.75 0 010 1.5H17v1.5h1.25a.75.75 0 010 1.5H17v.5A2.75 2.75 0 0114.25 17h-.5v1.25a.75.75 0 01-1.5 0V17h-1.5v1.25a.75.75 0 01-1.5 0V17h-1.5v1.25a.75.75 0 01-1.5 0V17h-.5A2.75 2.75 0 013 14.25v-.5H1.75a.75.75 0 010-1.5H3v-1.5H1.75a.75.75 0 010-1.5H3v-1.5H1.75a.75.75 0 010-1.5H3v-.5A2.75 2.75 0 015.75 3h.5V1.75a.75.75 0 011.5 0V3h1.5zM4.5 5.75c0-.69.56-1.25 1.25-1.25h8.5c.69 0 1.25.56 1.25 1.25v8.5c0 .69-.56 1.25-1.25 1.25h-8.5c-.69 0-1.25-.56-1.25-1.25v-8.5z" clipRule="evenodd" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
    </svg>
  );
}

// --- Shared styles ---

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 dark:border-noc-border bg-white dark:bg-noc-input px-3 py-2 text-sm text-gray-900 dark:text-noc-text placeholder-gray-400 dark:placeholder-noc-text-dim focus:border-ub-blue focus:outline-none focus:ring-1 focus:ring-ub-blue/40 transition-colors";

// --- Connection pane ---

interface ConnectionFormState {
  url: string;
  username: string;
  password: string;
  site: string;
  verifySsl: boolean;
}

const initialConnectionFormState: ConnectionFormState = {
  url: "",
  username: "",
  password: "",
  site: "default",
  verifySsl: false,
};

function connectionFormReducer(state: ConnectionFormState, update: Partial<ConnectionFormState>): ConnectionFormState {
  return { ...state, ...update };
}

function ConnectionPane() {
  const { connectionInfo, onLogout } = useAppContext();
  const loginMutation = useLogin();
  const [form, dispatch] = useReducer(connectionFormReducer, initialConnectionFormState, () => ({
    ...initialConnectionFormState,
    url: connectionInfo?.url ?? "",
    username: connectionInfo?.username ?? "",
  }));

  const error = loginMutation.error
    ? (loginMutation.error instanceof Error ? loginMutation.error.message : "Connection failed")
    : null;

  function handleConnect() {
    loginMutation.mutate(
      { url: form.url, username: form.username, password: form.password, site: form.site, verifySsl: form.verifySsl },
    );
  }

  return (
    <div className="space-y-4">
      {connectionInfo && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-status-success-dim border border-emerald-200 dark:border-status-success/20 p-3 text-sm text-emerald-700 dark:text-status-success">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 dark:bg-status-success" />
          Connected to {connectionInfo.url}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-status-danger-dim border border-red-200 dark:border-status-danger/20 p-3 text-sm text-red-700 dark:text-status-danger">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="conn-url" className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary mb-1">Controller URL</label>
        <input id="conn-url" type="url" value={form.url} onChange={e => dispatch({ url: e.target.value })} placeholder="https://192.168.1.1" className={INPUT_CLASS} />
      </div>

      <div>
        <label htmlFor="conn-username" className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary mb-1">Username</label>
        <input id="conn-username" type="text" value={form.username} onChange={e => dispatch({ username: e.target.value })} className={INPUT_CLASS} />
      </div>

      <div>
        <label htmlFor="conn-password" className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary mb-1">Password</label>
        <input id="conn-password" type="password" value={form.password} onChange={e => dispatch({ password: e.target.value })} className={INPUT_CLASS} data-1p-ignore />
      </div>

      <div>
        <label htmlFor="conn-site" className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary mb-1">Site</label>
        <input id="conn-site" type="text" value={form.site} onChange={e => dispatch({ site: e.target.value })} className={INPUT_CLASS} />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="conn-verify-ssl"
          type="checkbox"
          checked={form.verifySsl}
          onChange={e => dispatch({ verifySsl: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 dark:border-noc-border text-ub-blue focus:ring-ub-blue bg-white dark:bg-noc-input accent-ub-blue"
        />
        <label htmlFor="conn-verify-ssl" className="text-sm text-gray-700 dark:text-noc-text-secondary">Verify SSL</label>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleConnect}
          disabled={loginMutation.isPending}
          className="flex-1 rounded-lg bg-ub-blue px-3 py-2 text-sm font-semibold text-white hover:bg-ub-blue-light disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          {loginMutation.isPending ? "Connecting..." : "Connect"}
        </button>
        {connectionInfo && (
          <button
            onClick={onLogout}
            className="rounded-lg border border-red-300 dark:border-status-danger/30 px-3 py-2 text-sm text-red-600 dark:text-status-danger hover:bg-red-50 dark:hover:bg-status-danger-dim cursor-pointer transition-all"
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}

// --- AI Provider pane ---

type SiteProfile = "homelab" | "smb" | "enterprise";
type ConfigSource = "db" | "env" | "none";

interface AiSettingsState {
  presets: AiPreset[];
  selectedPresetId: string | null;
  baseUrl: string;
  apiKey: string;
  model: string;
  providerType: string;
  models: string[];
  siteProfile: SiteProfile;
  configSource: ConfigSource;
  keySource: ConfigSource;
  hasKey: boolean;
  saving: boolean;
  testing: boolean;
  testResult: { ok: boolean; message: string } | null;
  error: string | null;
  loading: boolean;
}

const initialAiState: AiSettingsState = {
  presets: [],
  selectedPresetId: null,
  baseUrl: "",
  apiKey: "",
  model: "",
  providerType: "openai",
  models: [],
  siteProfile: "homelab",
  configSource: "none",
  keySource: "none",
  hasKey: false,
  saving: false,
  testing: false,
  testResult: null,
  error: null,
  loading: true,
};

function aiSettingsReducer(state: AiSettingsState, update: Partial<AiSettingsState>): AiSettingsState {
  return { ...state, ...update };
}

interface ProviderFieldsProps {
  selectedPresetId: string | null;
  presets: AiPreset[];
  baseUrl: string;
  apiKey: string;
  model: string;
  providerType: string;
  models: string[];
  hasKey: boolean;
  keySource: ConfigSource;
  isEnvSourced: boolean;
  dispatch: (update: Partial<AiSettingsState>) => void;
}

function ProviderFields({ selectedPresetId, presets, baseUrl, apiKey, model, providerType, models, hasKey, keySource, isEnvSourced, dispatch }: ProviderFieldsProps) {
  if (!selectedPresetId) return null;

  return (
    <>
      {selectedPresetId === "custom" && (
        <div>
          <label htmlFor="settings-base-url" className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary mb-1">Base URL</label>
          <input
            id="settings-base-url"
            type="text"
            value={baseUrl}
            onChange={e => dispatch({ baseUrl: e.target.value })}
            disabled={isEnvSourced}
            placeholder="https://api.example.com/v1"
            className={INPUT_CLASS}
          />
        </div>
      )}

      <div>
        <label htmlFor="settings-api-key" className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary mb-1">API Key</label>
        {isEnvSourced ? (
          <div className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-noc-border bg-gray-50 dark:bg-noc-input px-3 py-2 text-sm text-gray-500 dark:text-noc-text-dim">
            <span>{presets.find(p => p.id === selectedPresetId)?.name ?? providerType} key configured via environment</span>
          </div>
        ) : (
          <input
            id="settings-api-key"
            type="password"
            value={apiKey}
            onChange={e => dispatch({ apiKey: e.target.value })}
            placeholder={keySource === "env" ? "Loaded from environment" : hasKey ? "Key configured \u2014 leave blank to keep" : "Enter your API key"}
            className={INPUT_CLASS}
            data-1p-ignore
          />
        )}
      </div>

      <div>
        <label htmlFor="settings-model" className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary mb-1">Model</label>
        {models.length > 0 ? (
          <select
            id="settings-model"
            value={model}
            onChange={e => dispatch({ model: e.target.value })}
            disabled={isEnvSourced}
            className={INPUT_CLASS}
          >
            {models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        ) : (
          <input
            id="settings-model"
            type="text"
            value={model}
            onChange={e => dispatch({ model: e.target.value })}
            disabled={isEnvSourced}
            placeholder="Model name"
            className={INPUT_CLASS}
          />
        )}
      </div>

      {selectedPresetId === "custom" && (
        <div>
          <label htmlFor="settings-provider-type" className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary mb-1">Provider Type</label>
          <select
            id="settings-provider-type"
            value={providerType}
            onChange={e => dispatch({ providerType: e.target.value })}
            disabled={isEnvSourced}
            className={INPUT_CLASS}
          >
            <option value="openai">OpenAI Compatible</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>
      )}
    </>
  );
}

function AiPane({ onClose }: { onClose: () => void }) {
  const [state, dispatch] = useReducer(aiSettingsReducer, initialAiState);
  const { presets, selectedPresetId, baseUrl, apiKey, model, providerType, models, siteProfile, configSource, keySource, hasKey, saving, testing, testResult, error, loading } = state;
  const isEnvSourced = configSource === "env";
  const saveAiConfigMutation = useSaveAiConfig();
  const deleteAiConfigMutation = useDeleteAiConfig();

  useEffect(() => {
    async function load() {
      try {
        const [presetsData, config, analysisSettings] = await Promise.all([
          api.getAiPresets(),
          api.getAiConfig(),
          api.getAiAnalysisSettings(),
        ]);
        if (config.source !== "none") {
          const matchedPreset = presetsData.find(p => p.base_url === config.base_url);
          dispatch({
            presets: presetsData,
            baseUrl: config.base_url,
            model: config.model,
            providerType: config.provider_type,
            selectedPresetId: matchedPreset ? matchedPreset.id : null,
            models: matchedPreset ? matchedPreset.models : [],
            configSource: config.source,
            keySource: config.key_source,
            hasKey: config.has_key,
            siteProfile: analysisSettings.site_profile,
            loading: false,
          });
        } else {
          dispatch({ presets: presetsData, configSource: "none", keySource: config.key_source, hasKey: config.has_key, siteProfile: analysisSettings.site_profile, loading: false });
        }
      } catch {
        dispatch({ error: "Failed to load settings", loading: false });
      }
    }
    load();
  }, []);

  const handlePresetChange = useCallback((presetId: string) => {
    if (presetId === "custom") {
      dispatch({ selectedPresetId: "custom", baseUrl: "", model: "", providerType: "openai", models: [] });
      return;
    }
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      dispatch({ selectedPresetId: preset.id, baseUrl: preset.base_url, model: preset.default_model, providerType: preset.provider_type, models: preset.models });
    }
  }, [presets]);

  const handleSave = useCallback(async () => {
    dispatch({ saving: true, error: null });
    try {
      const saves: Promise<unknown>[] = [api.saveAiAnalysisSettings({ site_profile: siteProfile })];
      if (!isEnvSourced) {
        saves.push(saveAiConfigMutation.mutateAsync({ base_url: baseUrl, api_key: apiKey, model, provider_type: providerType }));
      }
      await Promise.all(saves);
      onClose();
    } catch {
      dispatch({ error: "Failed to save settings", saving: false });
    }
  }, [baseUrl, apiKey, model, providerType, siteProfile, isEnvSourced, onClose, saveAiConfigMutation]);

  const handleTest = useCallback(async () => {
    dispatch({ testing: true, testResult: null });
    try {
      await api.testAiConnection({ base_url: baseUrl, api_key: apiKey, model, provider_type: providerType });
      dispatch({ testResult: { ok: true, message: "Connection successful - provider responded" }, testing: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      dispatch({ testResult: { ok: false, message }, testing: false });
    }
  }, [baseUrl, apiKey, model, providerType]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteAiConfigMutation.mutateAsync();
      onClose();
    } catch {
      dispatch({ error: "Failed to delete settings" });
    }
  }, [onClose, deleteAiConfigMutation]);

  if (loading) {
    return <div className="text-sm text-gray-500 dark:text-noc-text-secondary">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {isEnvSourced && (
        <div className="rounded-lg bg-blue-50 dark:bg-ub-blue-dim border border-blue-200 dark:border-ub-blue/20 p-3 text-sm text-blue-700 dark:text-ub-blue-light">
          Configured via environment variables. Changes must be made in the deployment configuration.
        </div>
      )}

      <div>
        <label htmlFor="settings-provider" className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary mb-1">Provider</label>
        <select
          id="settings-provider"
          value={selectedPresetId ?? ""}
          onChange={e => handlePresetChange(e.target.value)}
          disabled={isEnvSourced}
          className={INPUT_CLASS}
        >
          <option value="">Select a provider...</option>
          {presets.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </div>

      <ProviderFields
        selectedPresetId={selectedPresetId}
        presets={presets}
        baseUrl={baseUrl}
        apiKey={apiKey}
        model={model}
        providerType={providerType}
        models={models}
        hasKey={hasKey}
        keySource={keySource}
        isEnvSourced={isEnvSourced}
        dispatch={dispatch}
      />

      <div>
        <label htmlFor="settings-site-profile" className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary mb-1">Site Profile</label>
        <select
          id="settings-site-profile"
          value={siteProfile}
          onChange={e => dispatch({ siteProfile: e.target.value as SiteProfile })}
          className={INPUT_CLASS}
        >
          <option value="homelab">Homelab</option>
          <option value="smb">Small / Medium Business</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-noc-text-dim">
          Tunes AI analysis prioritization and remediation for your environment.
        </p>
      </div>

      {error && <div className="text-sm text-red-600 dark:text-status-danger">{error}</div>}
      {testResult && (
        <div className={`text-sm ${testResult.ok ? "text-green-600 dark:text-status-success" : "text-red-600 dark:text-status-danger"}`}>
          {testResult.message}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button onClick={handleSave} disabled={saving || (!isEnvSourced && !selectedPresetId)} className="flex-1 rounded-lg bg-ub-blue px-3 py-2 text-sm font-semibold text-white hover:bg-ub-blue-light disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all">
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={handleTest} disabled={testing} className="rounded-lg border border-gray-300 dark:border-noc-border px-3 py-2 text-sm text-gray-700 dark:text-noc-text-secondary hover:bg-gray-100 dark:hover:bg-noc-raised hover:text-gray-900 dark:hover:text-noc-text disabled:opacity-50 cursor-pointer transition-all">
          {testing ? "Testing..." : "Test Connection"}
        </button>
        {configSource === "db" && (
          <button onClick={handleDelete} className="rounded-lg border border-red-300 dark:border-status-danger/30 px-3 py-2 text-sm text-red-600 dark:text-status-danger hover:bg-red-50 dark:hover:bg-status-danger-dim cursor-pointer transition-all">
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// --- User Settings pane ---

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function UserPane() {
  const { themePreference, onThemePreferenceChange } = useAppContext();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-noc-text-secondary mb-2">Appearance</h3>
        <div className="inline-flex rounded-lg border border-gray-300 dark:border-noc-border overflow-hidden">
          {THEME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onThemePreferenceChange(opt.value)}
              className={`px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${
                themePreference === opt.value
                  ? "bg-ub-blue text-white"
                  : "bg-white dark:bg-noc-input text-gray-600 dark:text-noc-text-secondary hover:bg-gray-100 dark:hover:bg-noc-raised"
              }`}
              aria-label={`Theme: ${opt.label}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Main modal ---

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>("connection");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      role="button"
      tabIndex={-1}
      aria-label="Close dialog"
    >
      <div
        className="relative bg-white dark:bg-noc-surface border border-gray-200 dark:border-noc-border rounded-xl shadow-xl dark:shadow-2xl w-[700px] h-[80vh] flex mx-4 animate-fade-in"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
      >
        {/* Tab sidebar */}
        <div className="w-[160px] border-r border-gray-200 dark:border-noc-border flex flex-col gap-1 py-4 px-2 shrink-0">
          <TabButton icon={<LinkIcon />} label="Connection" active={tab === "connection"} onClick={() => setTab("connection")} />
          <TabButton icon={<CpuIcon />} label="AI Provider" active={tab === "ai"} onClick={() => setTab("ai")} />
          <TabButton icon={<UserIcon />} label="User Settings" active={tab === "user"} onClick={() => setTab("user")} />
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="text-lg font-display font-semibold text-gray-900 dark:text-noc-text tracking-tight">
              {tab === "connection" && "Connection"}
              {tab === "ai" && "AI Provider Settings"}
              {tab === "user" && "User Settings"}
            </h2>
            <button onClick={onClose} className="text-gray-400 dark:text-noc-text-dim hover:text-gray-600 dark:hover:text-noc-text text-xl cursor-pointer transition-colors" aria-label="Close settings">
              &times;
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 pt-2">
            {tab === "connection" && <ConnectionPane />}
            {tab === "ai" && <AiPane onClose={onClose} />}
            {tab === "user" && <UserPane />}
          </div>
        </div>
      </div>
    </div>
  );
}
