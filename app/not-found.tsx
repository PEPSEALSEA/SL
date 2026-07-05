"use client";

import { useEffect, useState } from "react";
import { getApiEndpoint } from "@/utils/api";
import { basePath, withBasePath } from "@/utils/paths";

const FileIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="18" x2="12" y2="12" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>
);

const ViewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const LinkBrokenIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

const ClockIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export default function NotFound() {
  const [error, setError] = useState("");
  const [isExpired, setIsExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [fileData, setFileData] = useState<{ url: string; driveId: string } | null>(null);

  useEffect(() => {
    const apiEndpoint = getApiEndpoint();
    const path = window.location.pathname;
    const segments = path.split("/").filter(Boolean);

    let shortCode = segments[segments.length - 1];
    const repoSegment = basePath.replace(/^\//, "");
    if (shortCode === repoSegment || shortCode === "Shorten-URLs") shortCode = "";
    setCode(shortCode);

    if (!shortCode || shortCode === "404" || shortCode === "index") {
      setLoading(false);
      setError("No short code provided");
      return;
    }

    async function handleRedirect() {
      try {
        const response = await fetch(
          `${apiEndpoint}?action=get&shortCode=${encodeURIComponent(shortCode)}`
        );
        const data = await response.json();

        if (data.success && data.originalUrl) {
          if (data.expiryDate) {
            const expiry = new Date(data.expiryDate);
            if (expiry < new Date()) {
              setIsExpired(true);
              setError("This link has expired");
              setLoading(false);
              return;
            }
          }

          if (data.driveId) {
            setFileData({
              url: `https://drive.google.com/file/d/${data.driveId}/view`,
              driveId: data.driveId,
            });
            setLoading(false);
          } else {
            window.location.replace(data.originalUrl);
          }
        } else {
          setError(data.error || "Short link not found");
          setLoading(false);
        }
      } catch (err: unknown) {
        console.error("Redirection error:", err);
        setError("Could not retrieve the original URL");
        setLoading(false);
      }
    }

    handleRedirect();
  }, []);

  return (
    <div className="redirect-page">
      <div className="redirect-card slide-up">
        <div className="redirect-brand">LinkSnap</div>

        {loading ? (
          <div className="fade-in">
            <div className="spinner" style={{ margin: "0 auto 16px" }} />
            <h2 className="redirect-title">Redirecting</h2>
            <p className="redirect-desc">
              Taking you to your destination
              {code && <span className="redirect-code">{code}</span>}
            </p>
          </div>
        ) : fileData ? (
          <>
            <div className="redirect-icon">
              <FileIcon />
            </div>
            <h1 className="redirect-title">File ready</h1>
            <p className="redirect-desc">
              This link points to a shared file. Choose how you&apos;d like to open it.
            </p>
            <div className="redirect-actions">
              <a
                href={fileData.url}
                target="_blank"
                rel="noopener noreferrer"
                className="button"
              >
                <ViewIcon />
                View full file
              </a>
              <a
                href={`https://drive.google.com/uc?export=download&id=${fileData.driveId}`}
                className="button secondary"
              >
                <DownloadIcon />
                Download directly
              </a>
            </div>
            <p className="redirect-hint">Direct view works best for multi-page PDFs.</p>
          </>
        ) : (
          <>
            <div className="redirect-icon">
              {isExpired ? <ClockIcon /> : <LinkBrokenIcon />}
            </div>
            <h1 className="redirect-title">{isExpired ? "Link expired" : "Link not found"}</h1>
            <p className="redirect-error-msg">{error}</p>
            <p className="redirect-desc">
              {isExpired
                ? "This short link has passed its expiry date and is no longer available."
                : "The link may have been deleted or never existed."}
            </p>
            <a href={withBasePath("/")} className="button">
              Back to LinkSnap
            </a>
          </>
        )}
      </div>
    </div>
  );
}
