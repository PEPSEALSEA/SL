"use client";

import { useState, useEffect, useCallback, FormEvent, useRef } from "react";
import { optimizedFetch, getGasEndpoint, getUploadEndpoint, invalidateCache } from "@/utils/api";
import { buildShortUrl, getShortUrls } from "@/utils/paths";

interface User {
  id: string;
  email: string;
  username: string;
}

interface Link {
  shortCode: string;
  originalUrl: string;
  created: string;
  clicks: number;
  expiryDate?: string;
  driveId?: string;
}

// Icons
const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
);

const QRIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><path d="M7 7h.01"></path><path d="M17 7h.01"></path><path d="M17 17h.01"></path><path d="M7 17h.01"></path></svg>
);

const DeleteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
);

const ExternalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
);

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
);

const LinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
);

const GalleryIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
);

const UploadIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
);

function ShortUrlCopies({
  shortCode,
  onCopy,
  compact = false,
}: {
  shortCode: string;
  onCopy: (text: string) => void;
  compact?: boolean;
}) {
  const urls = getShortUrls(window.location.origin, shortCode);

  if (compact) {
    return (
      <div style={{ display: "flex", gap: "8px" }}>
        <button className="button icon-only" onClick={() => onCopy(urls.fast)} title="Copy fast link">
          <CopyIcon />
        </button>
        <button className="button icon-only secondary" onClick={() => onCopy(urls.legacy)} title="Copy page link">
          <CopyIcon />
        </button>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginTop: "16px" }}>
        <div style={{ fontSize: "11px", fontWeight: 500, color: "var(--ink-subtle)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
          Fast redirect
        </div>
        <div className="short-url" style={{ marginTop: 0 }}>{urls.fast}</div>
        <button type="button" className="button" style={{ marginTop: "8px" }} onClick={() => onCopy(urls.fast)}>
          <CopyIcon /> Copy fast link
        </button>
      </div>
      <div style={{ marginTop: "16px" }}>
        <div style={{ fontSize: "11px", fontWeight: 500, color: "var(--ink-subtle)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
          Page link
        </div>
        <div className="short-url" style={{ marginTop: 0 }}>{urls.legacy}</div>
        <button type="button" className="button secondary" style={{ marginTop: "8px" }} onClick={() => onCopy(urls.legacy)}>
          <CopyIcon /> Copy page link
        </button>
      </div>
    </>
  );
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [mainTab, setMainTab] = useState<"create" | "manage">("create");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [shortCodeResult, setShortCodeResult] = useState("");
  const [userLinks, setUserLinks] = useState<Link[]>([]);
  const [activeQrUrl, setActiveQrUrl] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState<"url" | "file">("url");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [activePreset, setActivePreset] = useState("never");
  const [toasts, setToasts] = useState<{ id: number; type: "success" | "error"; message: string }[]>([]);

  const addToast = useCallback((type: "success" | "error", message: string) => {
    if (!message) return;
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  useEffect(() => {
    if (error) {
      addToast("error", error);
      setError("");
    }
  }, [error, addToast]);

  useEffect(() => {
    if (success) {
      addToast("success", success);
      setSuccess("");
    }
  }, [success, addToast]);

  // Form states
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  const [originalUrl, setOriginalUrl] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const showLoading = (show: boolean, text = "Loading...") => {
    setLoading(show);
    setLoadingText(text);
  };

  const loadUserLinks = useCallback(async (forceRefresh = false) => {
    if (!currentUser) return;

    const gasEndpoint = getGasEndpoint();
    const cacheKey = `userLinks_${currentUser.id}`;

    showLoading(true, "Loading your links...");
    setError("");

    try {
      const data = await optimizedFetch(
        `${gasEndpoint}?action=getUserLinks&userId=${currentUser.id}`,
        { method: "GET" },
        !forceRefresh,
        cacheKey
      );

      if (data.success) {
        setUserLinks(data.links || []);
      } else {
        setError(data.error || "Failed to load links");
      }
    } catch (err: unknown) {
      setError("Error loading links: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      showLoading(false);
    }
  }, [currentUser]);

  const handlePresetClick = (preset: string) => {
    setActivePreset(preset);
    const now = new Date();

    if (preset === "never") {
      setExpiryDate("");
    } else if (preset === "1h") {
      const date = new Date(now.getTime() + 60 * 60 * 1000);
      setExpiryDate(date.toISOString().slice(0, 16));
    } else if (preset === "1d") {
      const date = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      setExpiryDate(date.toISOString().slice(0, 16));
    } else if (preset === "1w") {
      const date = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      setExpiryDate(date.toISOString().slice(0, 16));
    }
  };

  useEffect(() => {
    if (currentUser && mainTab === "manage") {
      loadUserLinks();
    }
  }, [currentUser, mainTab, loadUserLinks]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    const gasEndpoint = getGasEndpoint();

    showLoading(true, "Logging in...");
    setError("");
    setSuccess("");

    try {
      const data = await optimizedFetch(gasEndpoint, {
        method: "POST",
        body: `action=login&identifier=${encodeURIComponent(loginIdentifier)}&password=${encodeURIComponent(loginPassword)}`,
      });

      if (data.success) {
        const user = data.user;
        setCurrentUser(user);
        localStorage.setItem("currentUser", JSON.stringify(user));
        setSuccess("Welcome back!");
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err: unknown) {
      setError("Error connecting to server: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      showLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    const gasEndpoint = getGasEndpoint();

    showLoading(true, "Creating account...");
    setError("");
    setSuccess("");

    try {
      const data = await optimizedFetch(gasEndpoint, {
        method: "POST",
        body: `action=register&email=${encodeURIComponent(registerEmail)}&username=${encodeURIComponent(registerUsername)}&password=${encodeURIComponent(registerPassword)}`,
      });

      if (data.success) {
        setSuccess("Account created! Please login.");
        setAuthTab("login");
        setRegisterEmail("");
        setRegisterUsername("");
        setRegisterPassword("");
      } else {
        setError(data.error || "Registration failed");
      }
    } catch (err: unknown) {
      setError("Error connecting to server: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      showLoading(false);
    }
  };

  const handleCreateUrl = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const gasEndpoint = getGasEndpoint();
    const uploadEndpoint = getUploadEndpoint();

    showLoading(true, "Processing request...");
    setError("");
    setSuccess("");
    setShortCodeResult("");

    try {
      let finalUrl = originalUrl;
      let driveId = "";

      if (selectedFile) {
        setLoadingText("Preparing your file...");
        setUploadProgress(0);

        // Convert file to Base64
        const base64Content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });

        // Use XMLHttpRequest via fetchWithProgress for percentage bar
        const uploadUrl = `${uploadEndpoint}?action=upload&filename=${encodeURIComponent(selectedFile.name)}&contentType=${encodeURIComponent(selectedFile.type)}`;

        const { fetchWithProgress } = await import("@/utils/api");
        const uploadData = await fetchWithProgress(uploadUrl, base64Content, (percent) => {
          setUploadProgress(percent);
        });

        if (uploadData.success) {
          finalUrl = uploadData.url;
          driveId = uploadData.driveId;
          setUploadProgress(100);
          setSuccess("File uploaded! Link ready.");
        } else {
          throw new Error(uploadData.error || "Upload failed. Please try again.");
        }
      }

      setLoadingText("Finalizing link...");
      const bodyParams = new URLSearchParams();
      bodyParams.append("action", "create");
      bodyParams.append("originalUrl", finalUrl);
      bodyParams.append("customSlug", customSlug);
      bodyParams.append("userId", currentUser.id);
      if (expiryDate) {
        // Convert local datetime to ISO string to ensure timezone consistency
        const isoDate = new Date(expiryDate).toISOString();
        bodyParams.append("expiryDate", isoDate);
      }
      if (driveId) bodyParams.append("driveId", driveId);

      const data = await optimizedFetch(gasEndpoint, {
        method: "POST",
        body: bodyParams.toString(),
      });

      if (data.success) {
        setShortCodeResult(data.shortCode);
        setOriginalUrl("");
        setCustomSlug("");
        setExpiryDate("");
        setActivePreset("never");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        invalidateCache(`userLinks_${currentUser.id}`);
        setSuccess("Short URL generated successfully!");
      } else {
        setError(data.error || "Failed to create short URL");
      }
    } catch (err: unknown) {
      setError("Error: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      showLoading(false);
    }
  };

  const deleteLink = async (shortCode: string, driveId?: string) => {
    if (!currentUser || !confirm("Are you sure you want to delete this link?")) return;

    const gasEndpoint = getGasEndpoint();
    const uploadEndpoint = getUploadEndpoint();

    showLoading(true, "Deleting...");

    try {
      if (driveId) {
        setLoadingText("Removing file...");
        await optimizedFetch(uploadEndpoint, {
          method: "POST",
          body: `action=deleteFiles&driveIds=${JSON.stringify([driveId])}`,
        });
      }

      setLoadingText("Removing link...");
      const data = await optimizedFetch(gasEndpoint, {
        method: "POST",
        body: `action=delete&shortCode=${encodeURIComponent(shortCode)}&userId=${currentUser.id}`,
      });

      if (data.success) {
        setSuccess("Link deleted");
        invalidateCache(`userLinks_${currentUser.id}`);
        loadUserLinks(true);
      } else {
        setError(data.error || "Failed to delete link");
      }
    } catch (err: unknown) {
      setError("Error deleting: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      showLoading(false);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem("currentUser");
    setUserLinks([]);
    setSuccess("Goodbye!");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setSuccess("Copied to clipboard!");
      setTimeout(() => setSuccess(""), 3000);
    });
  };

  if (!currentUser) {
    return (
      <div className="auth-wrapper">
        <div className="container">
          <div className="sidebar-brand" style={{ justifyContent: 'center', marginBottom: '24px' }}>LinkSnap</div>
          <div className="tab-buttons">
            <button
              className={`tab-button ${authTab === "login" ? "active" : ""}`}
              onClick={() => setAuthTab("login")}
            >
              Login
            </button>
            <button
              className={`tab-button ${authTab === "register" ? "active" : ""}`}
              onClick={() => setAuthTab("register")}
            >
              Register
            </button>
          </div>

          <div className="tab-content">
            {authTab === "login" ? (
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label htmlFor="loginIdentifier">Email or Username</label>
                  <input
                    type="text"
                    id="loginIdentifier"
                    placeholder="Enter your email or username"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="loginPassword">Password</label>
                  <input
                    type="password"
                    id="loginPassword"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="button" disabled={loading}>
                  Sign In
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <div className="form-group">
                  <label htmlFor="registerEmail">Email</label>
                  <input
                    type="email"
                    id="registerEmail"
                    placeholder="user@example.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="registerUsername">Username</label>
                  <input
                    type="text"
                    id="registerUsername"
                    placeholder="johndoe"
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="registerPassword">Password</label>
                  <input
                    type="password"
                    id="registerPassword"
                    placeholder="••••••••"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="button" disabled={loading}>
                  Create Account
                </button>
              </form>
            )}
          </div>
        </div>
        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p style={{ color: 'var(--ink-subtle)', fontSize: '13px' }}>{loadingText}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-layout fade-in">
      <aside className="app-sidebar">
        <div className="sidebar-brand">LinkSnap</div>

        {/* Mobile User Avatar */}
        <div className="mobile-user-info" style={{ display: 'none' }}>
          <div className="avatar small">{currentUser!.username[0].toUpperCase()}</div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${mainTab === "create" ? "active" : ""}`}
            onClick={() => setMainTab("create")}
          >
            <LinkIcon /> Shorten Link
          </button>
          <button
            className={`nav-item ${mainTab === "manage" ? "active" : ""}`}
            onClick={() => setMainTab("manage")}
          >
            <GalleryIcon /> My Gallery
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="avatar">{currentUser!.username[0].toUpperCase()}</div>
            <div className="user-details">
              <span className="user-name">{currentUser!.username}</span>
              <span style={{ fontSize: '12px', color: 'var(--ink-tertiary)' }}>{currentUser!.email}</span>
            </div>
          </div>
          <button className="nav-item logout-btn" onClick={logout}>
            <LogoutIcon /> Sign Out
          </button>
        </div>
      </aside>

      <main className="app-content">
        <div className="content-wrapper">
          {mainTab === "create" ? (
            <div className="slide-up">
              <div className="content-header">
                <h2>Create New Link</h2>
                <p>Shorten a URL or host a file in seconds.</p>
              </div>

              <div className="create-mode-toggle">
                <div className="tab-buttons sub-tabs">
                  <button
                    className={`tab-button ${createMode === "url" ? "active" : ""}`}
                    onClick={() => {
                      setCreateMode("url");
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    URL
                  </button>
                  <button
                    className={`tab-button ${createMode === "file" ? "active" : ""}`}
                    onClick={() => {
                      setCreateMode("file");
                      setOriginalUrl("");
                    }}
                  >
                    File
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateUrl} className="create-grid">
                <div className="main-section">
                  {createMode === "url" ? (
                    <div className="form-group slide-up">
                      <label htmlFor="originalUrl">Target URL</label>
                      <input
                        type="url"
                        id="originalUrl"
                        placeholder="https://very-long-url.com/path?query=1"
                        value={originalUrl}
                        onChange={(e) => setOriginalUrl(e.target.value)}
                        required
                      />
                    </div>
                  ) : (
                    <div className="file-uploader-wrapper slide-up">
                      <div
                        className={`file-uploader ${selectedFile ? 'has-file' : ''} ${isDragging ? 'dragging' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            setSelectedFile(file);
                            // Sync with native file input
                            if (fileInputRef.current) {
                              const dataTransfer = new DataTransfer();
                              dataTransfer.items.add(file);
                              fileInputRef.current.files = dataTransfer.files;
                            }
                          }
                        }}
                      >
                        <div className="upload-icon"><UploadIcon /></div>
                        <h3>Upload File</h3>
                        <p>{selectedFile ? `Selected: ${selectedFile.name}` : "Drop your files here or click to browse"}</p>
                        <input
                          type="file"
                          id="fileInput"
                          ref={fileInputRef}
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        />
                      </div>

                      {uploadProgress > 0 && uploadProgress < 100 && (
                        <div className="upload-progress-container">
                          <div className="upload-status">
                            <span>Uploading file...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="progress-bar-wrapper">
                            <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {shortCodeResult && (
                    createMode === "file" ? (
                      <div className="result-card">
                        <h3>Your File Link</h3>
                        <ShortUrlCopies shortCode={shortCodeResult} onCopy={copyToClipboard} />
                      </div>
                    ) : (
                      <div className="result-card">
                        <h3>Your Short Link</h3>
                        <ShortUrlCopies shortCode={shortCodeResult} onCopy={copyToClipboard} />
                      </div>
                    )
                  )}
                </div>

                <div className="sidebar-section">
                  <div className="form-group slide-up">
                    <label htmlFor="customSlug">Custom Slash (Optional)</label>
                    <input
                      type="text"
                      id="customSlug"
                      placeholder="e.g. my-awesome-link"
                      value={customSlug}
                      onChange={(e) => {
                        const val = e.target.value;
                        const sanitized = val.replace(/\s|%20/g, '-');
                        setCustomSlug(sanitized);
                      }}
                    />
                    {customSlug.includes('-') && (
                      <div className="slug-warning">
                        Your link will be <strong>{customSlug}</strong>
                      </div>
                    )}
                  </div>

                  <div className="freshness-card slide-up">
                    <div className="freshness-header">
                      <h3>Expiration</h3>
                    </div>

                    <div className="freshness-presets">
                      <button
                        type="button"
                        className={`preset-btn ${activePreset === "never" ? "active" : ""}`}
                        onClick={() => handlePresetClick("never")}
                      >
                        Never
                      </button>
                      <button
                        type="button"
                        className={`preset-btn ${activePreset === "1h" ? "active" : ""}`}
                        onClick={() => handlePresetClick("1h")}
                      >
                        1H
                      </button>
                      <button
                        type="button"
                        className={`preset-btn ${activePreset === "1d" ? "active" : ""}`}
                        onClick={() => handlePresetClick("1d")}
                      >
                        1D
                      </button>
                      <button
                        type="button"
                        className={`preset-btn ${activePreset === "1w" ? "active" : ""}`}
                        onClick={() => handlePresetClick("1w")}
                      >
                        1W
                      </button>
                    </div>

                    {(activePreset === "custom" || expiryDate) && (
                      <div className="custom-picker-container fade-in">
                        <input
                          type="datetime-local"
                          id="expiryDate"
                          className="custom-datetime-input"
                          value={expiryDate}
                          onChange={(e) => {
                            setExpiryDate(e.target.value);
                            setActivePreset("custom");
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <button type="submit" className="button" disabled={loading}>
                    {createMode === "file" ? 'Upload & Shorten' : 'Shorten Link'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="slide-up">
              <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2>My Gallery</h2>
                  <p>Manage and track your shortened links.</p>
                </div>
                <button className="button secondary small" onClick={() => loadUserLinks(true)} disabled={loading}>
                  <RefreshIcon /> Refresh Links
                </button>
              </div>

              <div className="links-table-container">
                {userLinks.length === 0 ? (
                  <div className="no-links">
                    <h3>No links yet</h3>
                    <p>Create your first link to get started.</p>
                  </div>
                ) : (
                  <table className="links-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Destination</th>
                        <th>Expires</th>
                        <th>Clicks</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userLinks.map((link) => {
                        const shortUrl = buildShortUrl(link.shortCode);
                        const urls = getShortUrls(window.location.origin, link.shortCode);

                        const isExpired = link.expiryDate && new Date(link.expiryDate) < new Date();

                        return (
                          <tr key={link.shortCode} style={{ opacity: isExpired ? 0.5 : 1 }}>
                            <td>
                              <a href={shortUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: "500", textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                                {link.shortCode} <ExternalIcon />
                              </a>
                            </td>
                            <td className="url-cell">
                              <details>
                                <summary>{link.originalUrl.length > 30 ? link.originalUrl.substring(0, 30) + "..." : link.originalUrl}</summary>
                                <div style={{ padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--hairline)', borderRadius: '8px', marginTop: '8px', fontSize: '13px', wordBreak: 'break-all' }}>
                                  {link.originalUrl}
                                  {link.driveId && <div style={{ color: 'var(--ink-subtle)', marginTop: '6px', fontSize: '12px' }}>Google Drive file</div>}
                                </div>
                              </details>
                            </td>
                            <td style={{ fontSize: '0.9rem', color: isExpired ? 'var(--danger)' : 'inherit' }}>
                              {link.expiryDate ? new Date(link.expiryDate).toLocaleDateString() : 'Never'}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: '500', color: 'var(--ink-subtle)' }}>{link.clicks}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <ShortUrlCopies shortCode={link.shortCode} onCopy={copyToClipboard} compact />
                                <button className="button icon-only" onClick={() => setActiveQrUrl(urls.fast)} title="View QR (fast link)">
                                  <QRIcon />
                                </button>
                                <button className="button icon-only danger" onClick={() => deleteLink(link.shortCode, link.driveId)} title="Delete Forever">
                                  <DeleteIcon />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav">
        <button
          className={`mobile-nav-item ${mainTab === "create" ? "active" : ""}`}
          onClick={() => setMainTab("create")}
        >
          <LinkIcon />
          <span>Shorten</span>
        </button>
        <button
          className={`mobile-nav-item ${mainTab === "manage" ? "active" : ""}`}
          onClick={() => setMainTab("manage")}
        >
          <GalleryIcon />
          <span>Gallery</span>
        </button>
        <button className="mobile-nav-item" onClick={logout}>
          <LogoutIcon />
          <span>Logout</span>
        </button>
      </nav>

      {/* QR Modal */}
      {activeQrUrl && (
        <div className="modal-overlay" onClick={() => setActiveQrUrl(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setActiveQrUrl(null)}>×</button>
            <h3 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>QR Code</h3>
            <p style={{ color: 'var(--ink-subtle)', fontSize: '13px' }}>Scan to open this link.</p>
            <div className="qr-container">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(activeQrUrl)}`}
                alt="QR Code"
                style={{ width: '100%', height: 'auto' }}
              />
            </div>
            <div className="short-url">{activeQrUrl}</div>
            <div className="modal-actions">
              <button className="button" onClick={() => copyToClipboard(activeQrUrl)}>
                <CopyIcon /> Copy Link
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p style={{ color: 'var(--ink-subtle)', fontSize: '13px' }}>{loadingText}</p>
        </div>
      )}

      {/* Toast Notification Prefab */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
            <button
              className="toast-close"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
