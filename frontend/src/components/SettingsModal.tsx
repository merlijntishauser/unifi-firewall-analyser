import { useCallback, useEffect, useReducer } from "react";
import { api } from "../api/client";
import type { AiPreset } from "../api/types";

interface SettingsModalProps {
  onClose: () => void;
}

type SiteProfile = "homelab" | "smb" | "enterprise";

interface SettingsState {
  presets: AiPreset[];
  selectedPresetId: string | null;
  baseUrl: string;
  apiKey: string;
  model: string;
  providerType: string;
  models: string[];
  siteProfile: SiteProfile;
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
  saving: false,
  testing: false,
  testResult: null,
  error: null,
  loading: true,
};

function settingsReducer(state: SettingsState, update: Partial<SettingsState>): SettingsState {
  return { ...state, ...update };
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [state, dispatch] = useReducer(settingsReducer, initialSettingsState);
  const { presets, selectedPresetId, baseUrl, apiKey, model, providerType, models, siteProfile, saving, testing, testResult, error, loading } = state;

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
            siteProfile: analysisSettings.site_profile,
            loading: false,
          });
        } else {
          dispatch({ presets: presetsData, siteProfile: analysisSettings.site_profile, loading: false });
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
      await Promise.all([
        api.saveAiConfig({ base_url: baseUrl, api_key: apiKey, model, provider_type: providerType }),
        api.saveAiAnalysisSettings({ site_profile: siteProfile }),
      ]);
      onClose();
    } catch {
      dispatch({ error: "Failed to save settings", saving: false });
    }
  }, [baseUrl, apiKey, model, providerType, siteProfile, onClose]);

  const handleTest = useCallback(async () => {
    dispatch({ testing: true, testResult: null });
    try {
      await api.testAiConnection();
      dispatch({ testResult: { ok: true, message: "Connection successful - provider responded" }, testing: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      dispatch({ testResult: { ok: false, message }, testing: false });
    }
  }, []);

  const handleDelete = useCallback(async () => {
    try {
      await api.deleteAiConfig();
      onClose();
    } catch {
      dispatch({ error: "Failed to delete settings" });
    }
  }, [onClose]);

  const inputClass =
    "w-full rounded-lg border border-gray-300 dark:border-noc-border bg-white dark:bg-noc-input px-3 py-2 text-sm text-gray-900 dark:text-noc-text placeholder-gray-400 dark:placeholder-noc-text-dim focus:border-ub-blue focus:outline-none focus:ring-1 focus:ring-ub-blue/40 transition-colors";

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
            {/* Provider picker */}
            <div>
              <label htmlFor="settings-provider" className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary mb-1">Provider</label>
              <select
                id="settings-provider"
                value={selectedPresetId ?? ""}
                onChange={e => handlePresetChange(e.target.value)}
                className={inputClass}
              >
                <option value="">Select a provider...</option>
                {presets.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* Base URL (shown for custom) */}
            {selectedPresetId === "custom" && (
              <div>
                <label htmlFor="settings-base-url" className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary mb-1">Base URL</label>
                <input
                  id="settings-base-url"
                  type="text"
                  value={baseUrl}
                  onChange={e => dispatch({ baseUrl: e.target.value })}
                  placeholder="https://api.example.com/v1"
                  className={inputClass}
                />
              </div>
            )}

            {/* API Key */}
            {selectedPresetId && (
              <>
                <div>
                  <label htmlFor="settings-api-key" className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary mb-1">API Key</label>
                  <input
                    id="settings-api-key"
                    type="password"
                    value={apiKey}
                    onChange={e => dispatch({ apiKey: e.target.value })}
                    placeholder="Enter your API key"
                    className={inputClass}
                  />
                </div>

                {/* Model selector */}
                <div>
                  <label htmlFor="settings-model" className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary mb-1">Model</label>
                  {models.length > 0 ? (
                    <select
                      id="settings-model"
                      value={model}
                      onChange={e => dispatch({ model: e.target.value })}
                      className={inputClass}
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
                      placeholder="Model name"
                      className={inputClass}
                    />
                  )}
                </div>

                {/* Provider type (for custom only) */}
                {selectedPresetId === "custom" && (
                  <div>
                    <label htmlFor="settings-provider-type" className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary mb-1">Provider Type</label>
                    <select
                      id="settings-provider-type"
                      value={providerType}
                      onChange={e => dispatch({ providerType: e.target.value })}
                      className={inputClass}
                    >
                      <option value="openai">OpenAI Compatible</option>
                      <option value="anthropic">Anthropic</option>
                    </select>
                  </div>
                )}
              </>
            )}

            {/* Site profile */}
            <div>
              <label htmlFor="settings-site-profile" className="block text-sm font-medium text-gray-700 dark:text-noc-text-secondary mb-1">Site Profile</label>
              <select
                id="settings-site-profile"
                value={siteProfile}
                onChange={e => dispatch({ siteProfile: e.target.value as SiteProfile })}
                className={inputClass}
              >
                <option value="homelab">Homelab</option>
                <option value="smb">Small / Medium Business</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-noc-text-dim">
                Tunes AI analysis prioritization and remediation for your environment.
              </p>
            </div>

            {/* Error/test messages */}
            {error && <div className="text-sm text-red-600 dark:text-status-danger">{error}</div>}
            {testResult && (
              <div className={`text-sm ${testResult.ok ? "text-green-600 dark:text-status-success" : "text-red-600 dark:text-status-danger"}`}>
                {testResult.message}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving || !selectedPresetId} className="flex-1 rounded-lg bg-ub-blue px-3 py-2 text-sm font-semibold text-white hover:bg-ub-blue-light disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all">
                {saving ? "Saving..." : "Save"}
              </button>
              <button onClick={handleTest} disabled={testing} className="rounded-lg border border-gray-300 dark:border-noc-border px-3 py-2 text-sm text-gray-700 dark:text-noc-text-secondary hover:bg-gray-100 dark:hover:bg-noc-raised hover:text-gray-900 dark:hover:text-noc-text disabled:opacity-50 cursor-pointer transition-all">
                {testing ? "Testing..." : "Test"}
              </button>
              <button onClick={handleDelete} className="rounded-lg border border-red-300 dark:border-status-danger/30 px-3 py-2 text-sm text-red-600 dark:text-status-danger hover:bg-red-50 dark:hover:bg-status-danger-dim cursor-pointer transition-all">
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
