import { useEffect, useState } from "react";
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from "lucide-react";
import ErrorCard from "../components/ErrorCard";

interface Settings {
  apiKey: string;
  defaultModel: string;
  defaultProjectsPath: string;
  hasEnvKey: boolean;
}

const AVAILABLE_MODELS = [
  { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)" },
  { value: "claude-opus-4-6-20250715", label: "Claude Opus 4.6 (claude-opus-4-6-20250715)" },
  { value: "claude-haiku-3-5-20241022", label: "Claude Haiku 3.5 (claude-haiku-3-5-20241022)" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [defaultModel, setDefaultModel] = useState("claude-sonnet-4-5-20250929");
  const [defaultProjectsPath, setDefaultProjectsPath] = useState("");
  
  // Save state
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Test connection state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  async function fetchSettings() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) {
        throw new Error(`Failed to fetch settings: ${res.statusText}`);
      }
      const data: Settings = await res.json();
      setSettings(data);
      setApiKey(""); // Don't prefill the masked key
      setDefaultModel(data.defaultModel);
      setDefaultProjectsPath(data.defaultProjectsPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (saveMessage || testResult) {
      const timer = setTimeout(() => {
        setSaveMessage(null);
        setTestResult(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage, testResult]);

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    setTestResult(null);

    try {
      const payload: { apiKey?: string; defaultModel?: string; defaultProjectsPath?: string } = {
        defaultModel,
        defaultProjectsPath: defaultProjectsPath.trim(),
      };
      
      // Only include apiKey if user entered a new one
      if (apiKey.trim()) {
        payload.apiKey = apiKey.trim();
      }

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save settings");
      }

      const data: Settings = await res.json();
      setSettings(data);
      setApiKey(""); // Clear the input after save
      setSaveMessage({ type: "success", text: "Settings saved successfully" });
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save settings",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
      });

      const data = await res.json();

      if (data.success) {
        setTestResult({ success: true });
      } else {
        setTestResult({ success: false, error: data.error || "Connection failed" });
      }
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : "Failed to test connection",
      });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="mb-6 font-heading text-[28px] font-semibold text-black">
          Settings
        </h1>
        <p className="font-body text-base text-text-secondary">Loading settings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="mb-6 font-heading text-[28px] font-semibold text-black">
          Settings
        </h1>
        <ErrorCard message={error} onRetry={fetchSettings} />
      </div>
    );
  }

  const hasConfiguredKey = settings?.apiKey && settings.apiKey.length > 0;

  // Detect unsaved changes
  const hasChanges =
    apiKey.trim().length > 0 ||
    defaultModel !== (settings?.defaultModel ?? "claude-sonnet-4-5-20250929") ||
    defaultProjectsPath !== (settings?.defaultProjectsPath ?? "");

  return (
    <div className="pb-20">
      <h1 className="mb-6 font-heading text-[28px] font-semibold text-black">
        Settings
      </h1>

      <div className="max-w-2xl">
        <form onSubmit={handleSave}>
          {/* API Key Section */}
          <div className="mb-8 rounded-lg border border-border bg-bg-primary p-6">
            <h2 className="mb-4 font-heading text-lg font-semibold text-black">
              Anthropic API Key
            </h2>

            {settings?.hasEnvKey && (
              <div className="mb-4 rounded-md border border-info-light bg-info-light px-4 py-3">
                <p className="font-body text-sm text-info">
                  Using API key from environment variable (ANTHROPIC_API_KEY)
                </p>
              </div>
            )}

            <div className="mb-4">
              <label
                htmlFor="api-key"
                className="mb-1 block font-body text-sm font-medium text-text-primary"
              >
                {settings?.hasEnvKey ? "Override Key (optional)" : "API Key"}
              </label>
              <div className="relative">
                <input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={hasConfiguredKey ? `Current: ${settings?.apiKey}` : "sk-ant-api03-..."}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 pr-10 font-body text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                  aria-label={showApiKey ? "Hide API key" : "Show API key"}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 font-body text-xs text-text-secondary">
                Get your API key from{" "}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Anthropic Console
                </a>
              </p>
            </div>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !hasConfiguredKey}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-4 py-2 font-body text-sm font-medium text-text-primary transition-colors hover:bg-bg-secondary disabled:opacity-50"
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </button>

            {testResult && (
              <div
                className={`mt-4 flex items-center gap-2 rounded-md border px-4 py-3 font-body text-sm ${
                  testResult.success
                    ? "border-success-light bg-success-light text-success"
                    : "border-error-light bg-error-light text-error"
                }`}
              >
                {testResult.success ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Connection successful!
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    {testResult.error}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Default Model Section */}
          <div className="mb-8 rounded-lg border border-border bg-bg-primary p-6">
            <h2 className="mb-4 font-heading text-lg font-semibold text-black">
              Default Model
            </h2>

            <div className="mb-4">
              <label
                htmlFor="default-model"
                className="mb-1 block font-body text-sm font-medium text-text-primary"
              >
                Model
              </label>
              <select
                id="default-model"
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                className="w-full rounded-md border border-border bg-white px-3 py-2 font-body text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-light"
              >
                {AVAILABLE_MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 font-body text-xs text-text-secondary">
                This model will be used for AI generation features when no model is specified.
              </p>
            </div>
          </div>

          {/* Default Projects Path Section */}
          <div className="mb-8 rounded-lg border border-border bg-bg-primary p-6">
            <h2 className="mb-4 font-heading text-lg font-semibold text-black">
              Default Projects Path
            </h2>

            <div className="mb-4">
              <label
                htmlFor="default-projects-path"
                className="mb-1 block font-body text-sm font-medium text-text-primary"
              >
                Path
              </label>
              <input
                id="default-projects-path"
                type="text"
                value={defaultProjectsPath}
                onChange={(e) => setDefaultProjectsPath(e.target.value)}
                placeholder="/home/user/projects"
                className="w-full rounded-md border border-border bg-white px-3 py-2 font-body text-sm font-mono text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-light"
              />
              <p className="mt-1 font-body text-xs text-text-secondary">
                Base directory where new projects will be created
              </p>
            </div>
          </div>

        </form>
      </div>

      {/* Sticky save bar — appears when there are unsaved changes */}
      {(hasChanges || saveMessage) && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white px-6 py-3 shadow-lg">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <div className="flex items-center gap-3">
              {saveMessage ? (
                <span
                  className={`font-body text-sm font-medium ${
                    saveMessage.type === "success" ? "text-success" : "text-error"
                  }`}
                >
                  {saveMessage.type === "success" ? (
                    <CheckCircle className="mr-1.5 inline h-4 w-4" />
                  ) : (
                    <XCircle className="mr-1.5 inline h-4 w-4" />
                  )}
                  {saveMessage.text}
                </span>
              ) : hasChanges ? (
                <span className="font-body text-sm font-medium text-amber-600">
                  ● You have unsaved changes
                </span>
              ) : null}
            </div>
            {hasChanges && (
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={saving}
                className="rounded-lg bg-primary px-6 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
