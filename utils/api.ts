const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://sl-worker.sealseapep.workers.dev";

// Cache for API responses
const apiCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Request queue to prevent duplicate calls
const requestQueue = new Map<string, Promise<any>>();

export type ProgressCallback = (percent: number) => void;

export async function optimizedFetch(url: string, options: RequestInit = {}, useCache = false, cacheKey: string | null = null) {
    const requestKey = `${url}_${JSON.stringify(options)}`;

    // Check if request is already in progress
    if (requestQueue.has(requestKey)) {
        return requestQueue.get(requestKey);
    }

    // Check cache first
    if (useCache && cacheKey && apiCache.has(cacheKey)) {
        const cached = apiCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached.data;
        }
        apiCache.delete(cacheKey);
    }

    const fetchPromise = fetchWithRetry(url, options);
    requestQueue.set(requestKey, fetchPromise);

    try {
        const result = await fetchPromise;

        // Cache successful responses
        if (useCache && cacheKey && result.success) {
            apiCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
        }

        return result;
    } finally {
        requestQueue.delete(requestKey);
    }
}

async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 2): Promise<any> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const isMultipart = options.body instanceof FormData;

            const response = await fetch(url, {
                ...options,
                headers: {
                    ...(isMultipart ? {} : { 'Content-Type': 'application/x-www-form-urlencoded' }),
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error: any) {
            if (attempt === maxRetries) {
                throw error;
            }

            // Exponential backoff
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

export function getApiEndpoint() {
    return API_URL;
}

export function getGasEndpoint() {
    return API_URL;
}

export function getUploadEndpoint() {
    return API_URL;
}

export async function fetchWithProgress(urlBase: string, base64Data: string, onProgress: ProgressCallback): Promise<any> {
    // Simulated progress since real XHR upload listeners trigger CORS preflight
    let simulatedPercent = 0;
    const interval = setInterval(() => {
        if (simulatedPercent < 90) {
            simulatedPercent += Math.random() * 10;
            onProgress(Math.min(90, Math.round(simulatedPercent)));
        }
    }, 400);

    try {
        // We move everything to the body to keep the URL simple.
        // We MUST use url manipulation here to extract params if they were in urlBase
        const urlObj = new URL(urlBase);
        const params = new URLSearchParams(urlObj.search);

        // Add the base64 content to the form data
        params.append("content", base64Data);

        // Fetch using a simple request format to avoid preflight
        const response = await fetch(urlObj.origin + urlObj.pathname, {
            method: "POST",
            mode: "cors",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString()
        });

        clearInterval(interval);
        onProgress(100);

        if (!response.ok) {
            const text = await response.text();
            let message = `HTTP ${response.status}`;
            try {
                const parsed = JSON.parse(text);
                if (parsed.error) message = parsed.error;
            } catch {
                if (text) message = text.slice(0, 200);
            }
            throw new Error(message);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        clearInterval(interval);
        throw error;
    }
}

export function clearCache() {
    apiCache.clear();
}

export function invalidateCache(key: string) {
    apiCache.delete(key);
}
