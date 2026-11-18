"use client";

import React, { useState } from "react";
import { Eye, EyeOff, Save, Zap, Info } from "lucide-react";
import {
  saveProviderSettingsAction,
  testConnectionAction,
  type MaskedProviderConfigData,
} from "../actions";

interface Props {
  initialConfig: MaskedProviderConfigData | null;
}

type ProviderType = "anthropic" | "openai-compatible" | "gemini";

const MODEL_SUGGESTIONS: Record<ProviderType, string[]> = {
  anthropic: [
    "claude-3-7-sonnet-20250219",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "deepseek-v4.1-flash",
  ],
  "openai-compatible": [
    "deepseek-v4.1-flash",
    "deepseek-chat",
    "deepseek-reasoner",
    "gpt-4o",
    "gpt-4o-mini",
    "qwen/qwen-2.5-72b-instruct",
  ],
  gemini: [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash-thinking-exp",
  ],
};

export default function ProviderSettingsForm({ initialConfig }: Props) {
  const [provider, setProvider] = useState<ProviderType>(
    initialConfig?.provider ?? "anthropic",
  );
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl ?? "");
  const [gatewayToken, setGatewayToken] = useState("");
  const [showGatewayToken, setShowGatewayToken] = useState(false);
  const [model, setModel] = useState(
    initialConfig?.model ?? "deepseek-v4.1-flash",
  );
  const [temperature, setTemperature] = useState(
    initialConfig?.temperature?.toString() ?? "0.9",
  );
  const [maxTokens, setMaxTokens] = useState(
    initialConfig?.maxTokens?.toString() ?? "51200",
  );
  const [thinkingBudget, setThinkingBudget] = useState(
    initialConfig?.thinkingBudget?.toString() ?? "0",
  );
  const [googleDriveApiKey, setGoogleDriveApiKey] = useState("");
  const [showDriveKey, setShowDriveKey] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const handleProviderSelect = (p: ProviderType) => {
    setProvider(p);
    const first = MODEL_SUGGESTIONS[p]?.[0];
    if (first && !initialConfig?.model) {
      setModel(first);
    }
  };

  const buildFormData = () => {
    const fd = new FormData();
    fd.append("provider", provider);
    fd.append("apiKey", apiKey);
    fd.append("baseUrl", baseUrl);
    fd.append("gatewayToken", gatewayToken);
    fd.append("model", model);
    fd.append("temperature", temperature);
    fd.append("maxTokens", maxTokens);
    fd.append("thinkingBudget", thinkingBudget);
    fd.append("googleDriveApiKey", googleDriveApiKey);
    return fd;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await saveProviderSettingsAction(buildFormData());
      if (res.success) {
        setMessage({
          text: res.message ?? "Konfigurasi berhasil disimpan.",
          type: "success",
        });
        setApiKey("");
        setGatewayToken("");
        setGoogleDriveApiKey("");
      } else {
        setMessage({
          text: res.error ?? "Gagal menyimpan konfigurasi.",
          type: "error",
        });
      }
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Terjadi kesalahan.",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setMessage(null);

    try {
      const res = await testConnectionAction(buildFormData());
      setMessage({
        text: res.success
          ? res.message ?? "Terhubung."
          : res.error ?? "Gagal terhubung.",
        type: res.success ? "success" : "error",
      });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Uji koneksi gagal.",
        type: "error",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Provider Settings (BYOK)
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Konfigurasi kunci AI Anda secara dinamis. Kunci dienkripsi di server (AES-256-GCM),
          tidak pernah dikirim kembali ke browser setelah disimpan, dan tidak pernah dicatat di log.
        </p>
      </div>

      {message && (
        <div
          role="status"
          aria-live="polite"
          className={`mb-6 p-4 rounded-xl text-sm border ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          {message.text}
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="glass-card rounded-2xl p-6 space-y-6 bg-slate-900/95 text-slate-100 border-slate-800"
      >
        {/* Provider Tabs */}
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-2">
            Provider
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(
              [
                { id: "anthropic", label: "Anthropic (Claude)" },
                { id: "openai-compatible", label: "OpenAI-compatible" },
                { id: "gemini", label: "Gemini" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleProviderSelect(tab.id)}
                className={`py-3 px-4 rounded-xl font-medium text-sm transition-all border cursor-pointer ${
                  provider === tab.id
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div>
          <label
            htmlFor="apiKey"
            className="block text-sm font-medium text-slate-200 mb-2"
          >
            API Key{" "}
            {initialConfig?.hasApiKey && (
              <span className="ml-2 text-xs font-mono text-emerald-400">
                (Tersimpan: {initialConfig.apiKeyMask})
              </span>
            )}
          </label>
          <div className="relative">
            <input
              id="apiKey"
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                initialConfig?.hasApiKey
                  ? "Biarkan kosong untuk memakai kunci tersimpan, atau masukkan kunci baru"
                  : "Masukkan API Key Anda..."
              }
              required={!initialConfig?.hasApiKey}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-12 font-mono text-sm"
            />
            <button
              type="button"
              aria-label="Toggle API Key visibility"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Base URL */}
        <div>
          <label
            htmlFor="baseUrl"
            className="block text-sm font-medium text-slate-200 mb-2"
          >
            Base URL{" "}
            <span className="text-xs text-slate-400 font-normal">
              (optional gateway)
            </span>
          </label>
          <input
            id="baseUrl"
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://zro.moonmath.ai/v1"
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
          />
        </div>

        {/* ANTHROPIC_AUTH_TOKEN */}
        <div>
          <label
            htmlFor="gatewayToken"
            className="block text-sm font-medium text-slate-200 mb-2"
          >
            ANTHROPIC_AUTH_TOKEN{" "}
            <span className="text-xs text-slate-400 font-normal">
              (used when calling the gateway)
            </span>
            {initialConfig?.hasGatewayToken && (
              <span className="ml-2 text-xs font-mono text-emerald-400">
                (Tersimpan)
              </span>
            )}
          </label>
          <div className="relative">
            <input
              id="gatewayToken"
              type={showGatewayToken ? "text" : "password"}
              value={gatewayToken}
              onChange={(e) => setGatewayToken(e.target.value)}
              placeholder="gateway bearer / passthrough token"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-12 font-mono text-sm"
            />
            <button
              type="button"
              aria-label="Toggle Gateway Token visibility"
              onClick={() => setShowGatewayToken(!showGatewayToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              {showGatewayToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Model */}
        <div>
          <label
            htmlFor="modelInput"
            className="block text-sm font-medium text-slate-200 mb-2"
          >
            Model
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              id="modelInput"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. deepseek-v4.1-flash"
              required
              className="sm:col-span-2 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
            />
            <select
              aria-label="Suggest model"
              onChange={(e) => {
                if (e.target.value) setModel(e.target.value);
              }}
              defaultValue=""
              className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            >
              <option value="" disabled>
                Suggest...
              </option>
              {MODEL_SUGGESTIONS[provider]?.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Hyperparameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="temperature"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
            >
              Temperature
            </label>
            <input
              id="temperature"
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="maxTokens"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
            >
              Max tokens
            </label>
            <input
              id="maxTokens"
              type="number"
              step="1000"
              min="100"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="thinkingBudget"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
            >
              Thinking budget{" "}
              <span className="text-[10px] lowercase font-normal">(0 = off)</span>
            </label>
            <input
              id="thinkingBudget"
              type="number"
              min="0"
              value={thinkingBudget}
              onChange={(e) => setThinkingBudget(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-sm"
            />
          </div>
        </div>

        {/* Google Drive API Key */}
        <div className="pt-2">
          <div className="flex items-start gap-2 text-xs text-slate-400 mb-2">
            <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <p>
              Google Drive API key (optional) — required to read public Drive
              folders. Generate a Drive API key in Google Cloud Console with the
              Drive API enabled; no OAuth required for public folders.
            </p>
          </div>
          <label
            htmlFor="googleDriveApiKey"
            className="block text-sm font-medium text-slate-200 mb-2"
          >
            Google Drive API key (optional){" "}
            {initialConfig?.hasGoogleDriveApiKey && (
              <span className="ml-2 text-xs font-mono text-emerald-400">
                (Tersimpan)
              </span>
            )}
          </label>
          <div className="relative">
            <input
              id="googleDriveApiKey"
              type={showDriveKey ? "text" : "password"}
              value={googleDriveApiKey}
              onChange={(e) => setGoogleDriveApiKey(e.target.value)}
              placeholder="••••••••••••••••••••••••••••••••"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 pr-12 font-mono text-sm"
            />
            <button
              type="button"
              aria-label="Toggle Drive API Key visibility"
              onClick={() => setShowDriveKey(!showDriveKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              {showDriveKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-800">
          <button
            type="submit"
            disabled={isSaving}
            className="py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Menyimpan..." : "Save"}</span>
          </button>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || (!apiKey && !initialConfig?.hasApiKey)}
            className="py-3 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium disabled:opacity-40 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>{isTesting ? "Menguji..." : "Test connection"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
