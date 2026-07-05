"use client";

import { useState, useEffect, useRef, useCallback, FormEvent } from "react";
import type QRCodeStylingType from "qr-code-styling";
import ImageCropModal from "./ImageCropModal";
import QRMiniPreview from "./QRMiniPreview";
import { buildQROptions } from "@/utils/qrRender";
import { renderQRToBlob } from "@/utils/qrRender";
import {
  DEFAULT_QR_CONFIG,
  QRConfig,
  SavedQR,
  compressLogoDataUrl,
  getLogoUrl,
} from "@/utils/qrTypes";
import { optimizedFetch, getGasEndpoint, invalidateCache } from "@/utils/api";

interface QRGeneratorPanelProps {
  userId: string;
  onNotify: (type: "success" | "error", message: string) => void;
  onLoading: (show: boolean, text?: string) => void;
}

const DOT_STYLES: QRConfig["dotStyle"][] = [
  "square", "dots", "rounded", "extra-rounded", "classy", "classy-rounded",
];

const CORNER_STYLES: QRConfig["cornerSquareStyle"][] = ["square", "dot", "extra-rounded"];

function stripLogoFromConfig(config: QRConfig): QRConfig {
  const next = { ...config };
  delete next.logoBase64;
  return next;
}

export default function QRGeneratorPanel({ userId, onNotify, onLoading }: QRGeneratorPanelProps) {
  const [qrContent, setQrContent] = useState("https://");
  const [qrName, setQrName] = useState("");
  const [config, setConfig] = useState<QRConfig>({ ...DEFAULT_QR_CONFIG });
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [savedQRs, setSavedQRs] = useState<SavedQR[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [logoDriveId, setLogoDriveId] = useState<string | null>(null);
  const [qrSubTab, setQrSubTab] = useState<"design" | "saved">("design");

  const previewRef = useRef<HTMLDivElement>(null);
  const qrInstanceRef = useRef<QRCodeStylingType | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!previewRef.current || !qrContent.trim()) return;

    let cancelled = false;

    (async () => {
      const QRCodeStyling = (await import("qr-code-styling")).default;
      if (cancelled || !previewRef.current) return;

      const logoUrl = getLogoUrl(config, logoDriveId || undefined);
      const options = buildQROptions(qrContent, config, logoUrl);

      if (!qrInstanceRef.current) {
        qrInstanceRef.current = new QRCodeStyling(options);
        previewRef.current.innerHTML = "";
        qrInstanceRef.current.append(previewRef.current);
      } else {
        qrInstanceRef.current.update(options);
      }
    })();

    return () => { cancelled = true; };
  }, [qrContent, config, logoDataUrl, logoDriveId]);

  const updateConfig = <K extends keyof QRConfig>(key: K, value: QRConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const loadSavedQRs = useCallback(async (force = false) => {
    const endpoint = getGasEndpoint();
    const cacheKey = `userQRs_${userId}`;
    onLoading(true, "Loading saved QR codes...");
    try {
      const data = await optimizedFetch(
        `${endpoint}?action=getUserQRs&userId=${userId}`,
        { method: "GET" },
        !force,
        cacheKey
      );
      if (data.success) {
        setSavedQRs(data.qrs || []);
      } else {
        onNotify("error", data.error || "Failed to load QR codes");
      }
    } catch (err) {
      onNotify("error", err instanceof Error ? err.message : "Failed to load QR codes");
    } finally {
      onLoading(false);
    }
  }, [userId, onLoading, onNotify]);

  useEffect(() => {
    loadSavedQRs();
  }, [loadSavedQRs]);

  const handleLogoSelect = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      onNotify("error", "Logo must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropSource(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (cropped: string) => {
    setLogoDataUrl(cropped);
    setLogoDriveId(null);
    setCropSource(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const resetForm = () => {
    setQrContent("https://");
    setQrName("");
    setConfig({ ...DEFAULT_QR_CONFIG });
    setLogoDataUrl(null);
    setLogoDriveId(null);
    setEditingId(null);
  };

  const loadSavedIntoEditor = (qr: SavedQR) => {
    setEditingId(qr.id);
    setQrName(qr.name);
    setQrContent(qr.content);
    setConfig(qr.config);
    if (qr.config.logoBase64) {
      setLogoDataUrl(qr.config.logoBase64);
      setLogoDriveId(null);
    } else {
      setLogoDataUrl(null);
      setLogoDriveId(qr.logoDriveId || null);
    }
    setQrSubTab("design");
    onNotify("success", `Loaded "${qr.name}"`);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!qrContent.trim()) {
      onNotify("error", "QR content is required");
      return;
    }
    if (!qrName.trim()) {
      onNotify("error", "Please enter a name for this QR code");
      return;
    }

    onLoading(true, "Saving QR code...");
    try {
      const saveConfig: QRConfig = { ...config };
      if (logoDataUrl?.startsWith("data:")) {
        saveConfig.logoBase64 = await compressLogoDataUrl(logoDataUrl);
      } else if (!logoDataUrl && !logoDriveId && !config.logoBase64) {
        delete saveConfig.logoBase64;
      }

      const endpoint = getGasEndpoint();
      const body = new URLSearchParams();
      body.append("action", "saveQR");
      body.append("userId", userId);
      body.append("name", qrName.trim());
      body.append("content", qrContent.trim());
      body.append("config", JSON.stringify(saveConfig));
      if (editingId) body.append("qrId", editingId);

      const data = await optimizedFetch(endpoint, { method: "POST", body: body.toString() });
      if (data.success) {
        invalidateCache(`userQRs_${userId}`);
        onNotify("success", editingId ? "QR code updated!" : "QR code saved!");
        resetForm();
        loadSavedQRs(true);
        setQrSubTab("saved");
      } else {
        onNotify("error", data.error || "Failed to save");
      }
    } catch (err) {
      onNotify("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      onLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!qrContent.trim()) return;
    try {
      const logoUrl = getLogoUrl(config, logoDriveId || undefined);
      const blob = await renderQRToBlob(qrContent, config, logoUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${qrName.trim() || "qr-code"}.png`;
      a.click();
      URL.revokeObjectURL(url);
      onNotify("success", "Downloaded!");
    } catch (err) {
      onNotify("error", err instanceof Error ? err.message : "Download failed");
    }
  };

  const handleDelete = async (qr: SavedQR) => {
    if (!confirm(`Delete "${qr.name}"?`)) return;
    onLoading(true, "Deleting...");
    try {
      const data = await optimizedFetch(getGasEndpoint(), {
        method: "POST",
        body: `action=deleteQR&qrId=${encodeURIComponent(qr.id)}&userId=${encodeURIComponent(userId)}`,
      });
      if (data.success) {
        invalidateCache(`userQRs_${userId}`);
        onNotify("success", "Deleted");
        if (editingId === qr.id) resetForm();
        loadSavedQRs(true);
      } else {
        onNotify("error", data.error || "Delete failed");
      }
    } catch (err) {
      onNotify("error", err instanceof Error ? err.message : "Delete failed");
    } finally {
      onLoading(false);
    }
  };

  return (
    <div className="slide-up">
      <div className="content-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2>QR Code Generator</h2>
          <p>Customize colors, gradients, logo and save to your library.</p>
        </div>
        <div className="tab-buttons sub-tabs">
          <button
            type="button"
            className={`tab-button ${qrSubTab === "design" ? "active" : ""}`}
            onClick={() => setQrSubTab("design")}
          >
            Design
          </button>
          <button
            type="button"
            className={`tab-button ${qrSubTab === "saved" ? "active" : ""}`}
            onClick={() => setQrSubTab("saved")}
          >
            Saved ({savedQRs.length})
          </button>
        </div>
      </div>

      {qrSubTab === "design" ? (
        <form onSubmit={handleSave} className="qr-generator-grid">
          <div className="qr-preview-section">
            <div className="qr-preview-card">
              <div ref={previewRef} className="qr-live-preview" />
            </div>
            <div className="qr-preview-actions">
              <button type="button" className="button secondary" onClick={handleDownload}>
                Download PNG
              </button>
              {editingId && (
                <button type="button" className="button secondary" onClick={resetForm}>
                  New QR
                </button>
              )}
            </div>
          </div>

          <div className="qr-controls-section">
            <div className="form-group">
              <label htmlFor="qrName">Name</label>
              <input
                id="qrName"
                type="text"
                placeholder="My QR Code"
                value={qrName}
                onChange={(e) => setQrName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="qrContent">Content (URL or text)</label>
              <input
                id="qrContent"
                type="text"
                placeholder="https://example.com"
                value={qrContent}
                onChange={(e) => setQrContent(e.target.value)}
                required
              />
            </div>

            <div className="qr-control-group">
              <label>Color Mode</label>
              <div className="freshness-presets">
                {(["solid", "gradient", "rainbow"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`preset-btn ${config.colorMode === mode ? "active" : ""}`}
                    onClick={() => updateConfig("colorMode", mode)}
                  >
                    {mode === "solid" ? "Solid" : mode === "gradient" ? "Gradient" : "Rainbow"}
                  </button>
                ))}
              </div>
            </div>

            {config.colorMode === "solid" && (
              <div className="qr-color-row">
                <div className="form-group">
                  <label htmlFor="fgColor">Foreground</label>
                  <div className="color-input-wrap">
                    <input id="fgColor" type="color" value={config.fgColor} onChange={(e) => updateConfig("fgColor", e.target.value)} />
                    <span>{config.fgColor}</span>
                  </div>
                </div>
              </div>
            )}

            {config.colorMode === "gradient" && (
              <div className="qr-color-row">
                <div className="form-group">
                  <label htmlFor="gradStart">Start</label>
                  <div className="color-input-wrap">
                    <input id="gradStart" type="color" value={config.gradientStart} onChange={(e) => updateConfig("gradientStart", e.target.value)} />
                    <span>{config.gradientStart}</span>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="gradEnd">End</label>
                  <div className="color-input-wrap">
                    <input id="gradEnd" type="color" value={config.gradientEnd} onChange={(e) => updateConfig("gradientEnd", e.target.value)} />
                    <span>{config.gradientEnd}</span>
                  </div>
                </div>
              </div>
            )}

            {(config.colorMode === "gradient" || config.colorMode === "rainbow") && (
              <div className="form-group">
                <label htmlFor="gradRot">Gradient Rotation ({config.gradientRotation}°)</label>
                <input
                  id="gradRot"
                  type="range"
                  min={0}
                  max={360}
                  value={config.gradientRotation}
                  onChange={(e) => updateConfig("gradientRotation", Number(e.target.value))}
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="bgColor">Background</label>
              <div className="color-input-wrap">
                <input id="bgColor" type="color" value={config.bgColor} onChange={(e) => updateConfig("bgColor", e.target.value)} />
                <span>{config.bgColor}</span>
              </div>
            </div>

            <div className="qr-control-group">
              <label>Dot Style</label>
              <div className="style-preset-grid">
                {DOT_STYLES.map((style) => (
                  <button
                    key={style}
                    type="button"
                    className={`preset-btn small ${config.dotStyle === style ? "active" : ""}`}
                    onClick={() => updateConfig("dotStyle", style)}
                  >
                    {style.replace("-", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="qr-control-group">
              <label>Corner Style</label>
              <div className="freshness-presets">
                {CORNER_STYLES.map((style) => (
                  <button
                    key={style}
                    type="button"
                    className={`preset-btn ${config.cornerSquareStyle === style ? "active" : ""}`}
                    onClick={() => updateConfig("cornerSquareStyle", style)}
                  >
                    {style.replace("-", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="qr-control-group">
              <label>Error Correction</label>
              <div className="freshness-presets">
                {(["L", "M", "Q", "H"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`preset-btn ${config.errorCorrection === level ? "active" : ""}`}
                    onClick={() => updateConfig("errorCorrection", level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="margin">Margin ({config.margin}px)</label>
              <input
                id="margin"
                type="range"
                min={0}
                max={40}
                value={config.margin}
                onChange={(e) => updateConfig("margin", Number(e.target.value))}
              />
            </div>

            <div className="qr-logo-section">
              <label>Center Logo</label>
              <div className="qr-logo-upload">
                {(logoDataUrl || logoDriveId || config.logoBase64) ? (
                  <div className="qr-logo-preview">
                    <img
                      src={logoDataUrl || getLogoUrl(config, logoDriveId || undefined) || ""}
                      alt="Logo preview"
                    />
                    <button
                      type="button"
                      className="button secondary small"
                      onClick={() => {
                        setLogoDataUrl(null);
                        setLogoDriveId(null);
                        setConfig(stripLogoFromConfig(config));
                        if (logoInputRef.current) logoInputRef.current.value = "";
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div
                    className="file-uploader qr-logo-drop"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <p>Upload logo (PNG/JPG)</p>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoSelect(file);
                      }}
                    />
                  </div>
                )}
              </div>

              {(logoDataUrl || logoDriveId || config.logoBase64) && (
                <>
                  <div className="form-group">
                    <label htmlFor="logoSize">Logo Size ({Math.round(config.logoSize * 100)}%)</label>
                    <input
                      id="logoSize"
                      type="range"
                      min={0.1}
                      max={0.5}
                      step={0.05}
                      value={config.logoSize}
                      onChange={(e) => updateConfig("logoSize", Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="logoMargin">Logo Margin ({config.logoMargin}px)</label>
                    <input
                      id="logoMargin"
                      type="range"
                      min={0}
                      max={20}
                      value={config.logoMargin}
                      onChange={(e) => updateConfig("logoMargin", Number(e.target.value))}
                    />
                  </div>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.hideBackgroundDots}
                      onChange={(e) => updateConfig("hideBackgroundDots", e.target.checked)}
                    />
                    Hide dots behind logo
                  </label>
                </>
              )}
            </div>

            <button type="submit" className="button" style={{ marginTop: "16px" }}>
              {editingId ? "Update Saved QR" : "Save to Library"}
            </button>
          </div>
        </form>
      ) : (
        <div className="qr-saved-list">
          {savedQRs.length === 0 ? (
            <div className="no-links">
              <h3>No saved QR codes</h3>
              <p>Design a QR code and save it to your library.</p>
            </div>
          ) : (
            <div className="qr-saved-grid">
              {savedQRs.map((qr) => (
                <div key={qr.id} className="qr-saved-card">
                  <div className="qr-saved-thumb">
                    <QRMiniPreview
                      content={qr.content}
                      config={qr.config}
                      logoDriveId={qr.logoDriveId}
                      size={100}
                    />
                  </div>
                  <div className="qr-saved-info">
                    <h4>{qr.name}</h4>
                    <p title={qr.content}>
                      {qr.content.length > 40 ? qr.content.slice(0, 40) + "..." : qr.content}
                    </p>
                    <span className="qr-saved-date">
                      {qr.created ? new Date(qr.created).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <div className="qr-saved-actions">
                    <button type="button" className="button secondary small" onClick={() => loadSavedIntoEditor(qr)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="button secondary small"
                      onClick={async () => {
                        const logoUrl = getLogoUrl(qr.config, qr.logoDriveId);
                        const blob = await renderQRToBlob(qr.content, qr.config, logoUrl);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${qr.name}.png`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Download
                    </button>
                    <button type="button" className="button icon-only danger small" onClick={() => handleDelete(qr)} title="Delete">
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {cropSource && (
        <ImageCropModal
          imageSrc={cropSource}
          onClose={() => {
            setCropSource(null);
            if (logoInputRef.current) logoInputRef.current.value = "";
          }}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
}
