import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { AiPreset } from "../api/types";

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [presets, setPresets] = useState<AiPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [providerType, setProviderType] = useState("openai");
  const [models, setModels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load presets and current config on mount
  useEffect(() => {
    async function load() {
      try {
        const [presetsData, config] = await Promise.all([
          api.getAiPresets(),
          api.getAiConfig(),
        ]);
        setPresets(presetsData);
        if (config.source !== "none") {
          setBaseUrl(config.base_url);
          setModel(config.model);
          setProviderType(config.provider_type);
          // Try to match to a preset
          const matchedPreset = presetsData.find(p => p.base_url === config.base_url);
          if (matchedPreset) {
            setSelectedPresetId(matchedPreset.id);
            setModels(matchedPreset.models);
          }
        }
      } catch {
        setError("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handlePresetChange = useCallback((presetId: string) => {
    if (presetId === "custom") {
      setSelectedPresetId("custom");
      setBaseUrl("");
      setModel("");
      setProviderType("openai");
      setModels([]);
      return;
    }
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setSelectedPresetId(preset.id);
      setBaseUrl(preset.base_url);
      setModel(preset.default_model);
      setProviderType(preset.provider_type);
      setModels(preset.models);
    }
  }, [presets]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await api.saveAiConfig({ base_url: baseUrl, api_key: apiKey, model, provider_type: providerType });
      onClose();
    } catch {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }, [baseUrl, apiKey, model, providerType, onClose]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await api.testAiConnection();
      setTestResult("Connection successful");
    } catch {
      setTestResult("Connection failed");
    } finally {
      setTesting(false);
    }
  }, []);

  const handleDelete = useCallback(async () => {
    try {
      await api.deleteAiConfig();
      onClose();
    } catch {
      setError("Failed to delete settings");
    }
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="AI Settings"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI Provider Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl cursor-pointer" aria-label="Close settings">
            &times;
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
        ) : (
          <div className="space-y-4">
            {/* Provider picker */}
            <div>
              <label htmlFor="settings-provider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Provider</label>
              <select
                id="settings-provider"
                value={selectedPresetId ?? ""}
                onChange={e => handlePresetChange(e.target.value)}
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
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
                <label htmlFor="settings-base-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base URL</label>
                <input
                  id="settings-base-url"
                  type="text"
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
            )}

            {/* API Key */}
            {selectedPresetId && (
              <>
                <div>
                  <label htmlFor="settings-api-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
                  <input
                    id="settings-api-key"
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="Enter your API key"
                    className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Model selector */}
                <div>
                  <label htmlFor="settings-model" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model</label>
                  {models.length > 0 ? (
                    <select
                      id="settings-model"
                      value={model}
                      onChange={e => setModel(e.target.value)}
                      className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
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
                      onChange={e => setModel(e.target.value)}
                      placeholder="Model name"
                      className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                    />
                  )}
                </div>

                {/* Provider type (for custom only) */}
                {selectedPresetId === "custom" && (
                  <div>
                    <label htmlFor="settings-provider-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Provider Type</label>
                    <select
                      id="settings-provider-type"
                      value={providerType}
                      onChange={e => setProviderType(e.target.value)}
                      className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                    >
                      <option value="openai">OpenAI Compatible</option>
                      <option value="anthropic">Anthropic</option>
                    </select>
                  </div>
                )}
              </>
            )}

            {/* Error/test messages */}
            {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}
            {testResult && <div className="text-sm text-green-600 dark:text-green-400">{testResult}</div>}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving || !selectedPresetId} className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                {saving ? "Saving..." : "Save"}
              </button>
              <button onClick={handleTest} disabled={testing} className="rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 cursor-pointer">
                {testing ? "Testing..." : "Test"}
              </button>
              <button onClick={handleDelete} className="rounded border border-red-300 dark:border-red-700 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 cursor-pointer">
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
