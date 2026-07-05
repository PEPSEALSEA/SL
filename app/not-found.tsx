"use client";

import { useEffect, useState } from "react";
import { getGasEndpoint } from "@/utils/api";
import { basePath, withBasePath } from "@/utils/paths";

export default function NotFound() {
    const [error, setError] = useState("");
    const [isExpired, setIsExpired] = useState(false);
    const [loading, setLoading] = useState(true);
    const [code, setCode] = useState("");
    const [fileData, setFileData] = useState<{ url: string, driveId: string } | null>(null);

    useEffect(() => {
        const gasEndpoint = getGasEndpoint();
        const path = window.location.pathname;
        const segments = path.split('/').filter(Boolean);

        let shortCode = segments[segments.length - 1];
        const repoSegment = basePath.replace(/^\//, '');
        if (shortCode === repoSegment || shortCode === 'Shorten-URLs') shortCode = '';
        setCode(shortCode);

        if (!shortCode || shortCode === '404' || shortCode === 'index') {
            setLoading(false);
            setError("No short code provided");
            return;
        }

        async function handleRedirect() {
            try {
                const response = await fetch(
                    `${gasEndpoint}?action=get&shortCode=${encodeURIComponent(shortCode)}`
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

                    // If it's a Drive file, we show a landing page instead of instant redirect
                    if (data.driveId) {
                        setFileData({
                            // Always use the official Drive viewer for files to see all pages
                            url: `https://drive.google.com/file/d/${data.driveId}/view`,
                            driveId: data.driveId
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
        <div className="not-found-wrapper">
            <div className="container">
                {loading ? (
                    <div className="loading-state fade-in">
                        <div className="spinner"></div>
                        <h2>Redirecting...</h2>
                        <p>Redirecting to &quot;{code || 'link'}&quot;</p>
                    </div>
                ) : fileData ? (
                    <div className="file-box slide-up">
                        <div className="file-icon">🍱</div>
                        <h1>File Ready!</h1>
                        <p className="description">This link points to a private file. How would you like to open it?</p>

                        <div className="file-actions">
                            <a href={fileData.url} target="_blank" rel="noopener noreferrer" className="button view-button">
                                👁️ View Full File
                            </a>
                            <a href={`https://drive.google.com/uc?export=download&id=${fileData.driveId}`} className="button download-button">
                                📥 Download Directly
                            </a>
                        </div>

                        <p style={{ marginTop: '20px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Direct view is better for multi-page PDFs.
                        </p>
                    </div>
                ) : (
                    <div className="error-state slide-up">
                        <div className="error-icon">{isExpired ? "⌛" : "🛰️"}</div>
                        <h1>{isExpired ? "Link Expired" : "Lost in Space"}</h1>
                        <p className="error-message">{error}</p>
                        <p className="description">The link you&apos;re looking for might have been deleted, expired, or never existed in this timeline.</p>
                        <a href={withBasePath('/')} className="button">
                            Take Me Home
                        </a>
                    </div>
                )}
            </div>
            <style jsx>{`
                .not-found-wrapper {
                    display: flex;
                    height: 100vh;
                    width: 100vw;
                    align-items: center;
                    justify-content: center;
                    background: #020617;
                    background-image: 
                        radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.1) 0%, transparent 70%),
                        radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.05) 0px, transparent 50%);
                }
                .container {
                    text-align: center;
                    max-width: 450px;
                }
                .error-icon {
                    font-size: 4rem;
                    margin-bottom: 1.5rem;
                }
                h1 {
                    margin-bottom: 1rem;
                }
                h2 {
                    color: var(--text);
                    margin-bottom: 0.5rem;
                }
                .error-message {
                    color: var(--secondary);
                    font-weight: 600;
                    font-size: 1.1rem;
                    margin-bottom: 1rem;
                }
                .description {
                    color: var(--text-muted);
                    margin-bottom: 2rem;
                    font-size: 0.95rem;
                }
                .spinner {
                    width: 50px;
                    height: 50px;
                    border: 3px solid rgba(99, 102, 241, 0.2);
                    border-top: 3px solid #6366f1;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 2rem;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .fade-in { animation: fadeIn 0.5s ease; }
                .slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1); }

                .file-box {
                    background: #fff;
                    color: #1e293b;
                    padding: 40px;
                    border-radius: 20px;
                    border-top: 5px solid #ef4444;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                }
                .file-icon {
                    font-size: 4rem;
                    margin-bottom: 1rem;
                }
                .file-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-top: 20px;
                }
                .view-button {
                    background: #1e293b !important;
                    color: white !important;
                }
                .download-button {
                    background: #ef4444 !important;
                    color: white !important;
                }
                .file-box h1 { color: #1e293b; }
            `}</style>
        </div>
    );
}
