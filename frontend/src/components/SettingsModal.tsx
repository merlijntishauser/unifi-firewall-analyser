import { useCallback, useEffect, useReducer } from "react";
import { api } from "../api/client";
import type { AiPreset } from "../api/types";

interface SettingsModalProps {
  onClose: () => void;
}

type SiteProfile = "homelab" | "smb" | "enterprise";

type ConfigSource = "db" | "env" | "none";

interface SettingsState {
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

const initialSettingsState: SettingsState = {
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

function settingsReducer(state: SettingsState, update: Partial<SettingsState>): SettingsState {
  return { ...state, ...update };
}

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 dark:border-noc-border bg-white dark:bg-noc-input px-3 py-2 text-sm text-gray-900 dark:text-noc-text placeholder-gray-400 dark:placeholder-noc-text-dim focus:border-ub-blue focus:outline-none focus:ring-1 focus:ring-ub-blue/40 transition-colors";

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
  dispatch: (update: Partial<SettingsState>) => void;
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

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [state, dispatch] = useReducer(settingsReducer, initialSettingsState);
  const { presets, selectedPresetId, baseUrl, apiKey, model, providerType, models, siteProfile, configSource, keySource, hasKey, saving, testing, testResult, error, loading } = state;
  const isEnvSourced = configSource === "env";

  // Load presets, current config, and analysis settings on mount
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
        saves.push(api.saveAiConfig({ base_url: baseUrl, api_key: apiKey, model, provider_type: providerType }));
      }
      await Promise.all(saves);
      onClose();
    } catch {
      dispatch({ error: "Failed to save settings", saving: false });
    }
  }, [baseUrl, apiKey, model, providerType, siteProfile, isEnvSourced, onClose]);

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
      await api.deleteAiConfig();
      onClose();
    } catch {
      dispatch({ error: "Failed to delete settings" });
    }
  }, [onClose]);

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
        className="bg-white dark:bg-noc-surface border border-gray-200 dark:border-noc-border rounded-xl shadow-xl dark:shadow-2xl w-full max-w-md mx-4 p-6 animate-fade-in"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
        role="dialog"
        aria-label="AI Settings"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-semibold text-gray-900 dark:text-noc-text tracking-tight">AI Provider Settings</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-noc-text-dim hover:text-gray-600 dark:hover:text-noc-text text-xl cursor-pointer transition-colors" aria-label="Close settings">
            &times;
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500 dark:text-noc-text-secondary">Loading...</div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
