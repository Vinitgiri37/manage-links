// Fetches metadata for a URL using a public API with fallbacks

/**
 * Try to extract a domain from a URL string.
 * @param {string} url
 * @returns {string}
 */
function getDomainFromUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Normalize a URL ONLY for opening (does not change stored value).
 * If the stored URL is missing scheme (from older saves), we add https:// at open-time.
 * @param {string} url
 * @returns {string}
 */
function normalizeUrlForOpen(url) {
  const value = (url || "").trim();
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return "https://" + value;
}

/**
 * Convert a domain to a friendly site name.
 * @param {string} domain
 * @returns {string}
 */
function siteNameFromDomain(domain) {
  const d = (domain || "").toLowerCase().replace(/^www\./, "");
  if (!d) return "Website";

  // Small set of friendly names
  if (d === "x.com" || d === "twitter.com") return "X";
  if (d === "github.com") return "GitHub";
  if (d === "youtube.com" || d === "youtu.be") return "YouTube";
  if (d === "linkedin.com") return "LinkedIn";
  if (d === "medium.com") return "Medium";

  const base = d.split(".")[0] || d;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Keep only the first maxWords words.
 * @param {string} text
 * @param {number} maxWords
 * @returns {string}
 */
function clampWords(text, maxWords) {
  const words = (text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (!words.length) return "";
  if (words.length <= maxWords) return words.join(" ");
  return words.slice(0, maxWords).join(" ").replace(/[.,;:!?]+$/, "") + ".";
}

/**
 * Generate a short, simple title from URL + domain.
 * Rule: Prefer website name/domain and a small content hint.
 * @param {string} url
 * @param {string} domain
 * @returns {string}
 */
function generateShortTitle(url, domain) {
  const site = siteNameFromDomain(domain || getDomainFromUrl(url));
  try {
    const u = new URL(normalizeUrlForOpen(url));
    const host = u.hostname.replace(/^www\./, "");
    const path = (u.pathname || "/").replace(/\/+$/, "") || "/";
    const parts = path.split("/").filter(Boolean);

    // Example: https://x.com/username -> "X Profile"
    if ((host === "x.com" || host === "twitter.com") && parts.length >= 1) {
      return `${site} Profile`;
    }

    if (host === "github.com") {
      if (parts.length >= 2) return `${site} Repository`;
      return `${site} Page`;
    }

    if (host === "youtube.com" && u.searchParams.get("v")) return `${site} Video`;
    if (host === "youtu.be" && parts.length >= 1) return `${site} Video`;

    // Generic fallback
    return `${site} Link`;
  } catch {
    return `${site} Link`;
  }
}

/**
 * Generate a one-sentence description (max 12–15 words).
 * Uses fetched meta description if available; otherwise uses a domain-based template.
 * @param {string} url
 * @param {string} domain
 * @param {string} metaDescription
 * @returns {string}
 */
function generateShortDescription(url, domain, metaDescription) {
  const site = siteNameFromDomain(domain || getDomainFromUrl(url));
  const source = (metaDescription || "").replace(/\s+/g, " ").trim();

  // If we have metadata, compress it to <= 15 words.
  if (source) {
    // 15 words max, ensure one sentence-ish.
    const clipped = clampWords(source, 15);
    return clipped.endsWith(".") ? clipped : clipped + ".";
  }

  // Otherwise use a simple, consistent template (12–15 words).
  // "Official page on X. Open to view the latest content and details." (12-14 words)
  const template = `Official page on ${site}. Open to view the latest content and details.`;
  return clampWords(template, 15);
}

/**
 * Create a short preview from page text.
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
function makePreview(text, maxLen) {
  const cleaned = (text || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
  if (!cleaned) return "";
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 1).trimEnd() + "…";
}

/**
 * Build a favicon URL using Google's favicon service as a fallback.
 * @param {string} url
 * @returns {string}
 */
function buildFavicon(url) {
  const domain = getDomainFromUrl(url);
  return (
    "https://www.google.com/s2/favicons?sz=64&domain=" +
    encodeURIComponent(domain)
  );
}

/**
 * Fetch HTML via a CORS-friendly proxy (Jina AI) and parse basic metadata.
 * This helps when direct client-side metadata fetching is blocked by CORS.
 * @param {string} url
 * @returns {Promise<{title:string, description:string, favicon:string}>}
 */
async function fetchMetadataViaProxy(url) {
  // Jina AI "r.jina.ai" proxy supports fetching pages without typical CORS restrictions.
  const proxyUrl = "https://r.jina.ai/" + url;
  const resp = await fetch(proxyUrl, { mode: "cors" });
  if (!resp.ok) throw new Error("Proxy fetch failed: " + resp.status);
  const html = await resp.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const title =
    doc.querySelector("meta[property='og:title']")?.getAttribute("content") ||
    doc.querySelector("title")?.textContent ||
    "";

  const description =
    doc.querySelector("meta[property='og:description']")?.getAttribute("content") ||
    doc.querySelector("meta[name='description']")?.getAttribute("content") ||
    "";

  const iconHref =
    doc.querySelector("link[rel='icon']")?.getAttribute("href") ||
    doc.querySelector("link[rel='shortcut icon']")?.getAttribute("href") ||
    doc.querySelector("link[rel='apple-touch-icon']")?.getAttribute("href") ||
    "";

  let favicon = "";
  if (iconHref) {
    try {
      favicon = new URL(iconHref, url).toString();
    } catch {
      favicon = "";
    }
  }

  // If no description meta exists, try to generate a short preview from visible text.
  const textPreview = makePreview(doc.body?.textContent || "", 160);

  return {
    title: (title || "").trim(),
    description: (description || textPreview || "").trim(),
    favicon,
  };
}

/**
 * Fetch metadata for a given URL.
 * Uses jsonlink.io (no auth required). If description/title are missing, tries a proxy HTML parse.
 * Always returns something usable so the link can be opened.
 * @param {string} url
 * @returns {Promise<{title:string, description:string, favicon:string, domain:string}>}
 */
async function fetchLinkMetadata(url) {
  const cleanUrl = url.trim();
  const domain = getDomainFromUrl(cleanUrl);
  const fallback = {
    title: cleanUrl,
    description: domain,
    favicon: buildFavicon(cleanUrl),
    domain,
  };

  // Public metadata API (subject to availability and CORS)
  const apiUrl =
    "https://jsonlink.io/api/extract?url=" + encodeURIComponent(cleanUrl);

  try {
    const response = await fetch(apiUrl, { mode: "cors" });
    if (!response.ok) {
      console.warn("Metadata API request failed", response.status);
      // Try proxy as a second attempt
      try {
        const proxyMeta = await fetchMetadataViaProxy(cleanUrl);
        return {
          title: proxyMeta.title || fallback.title,
          description: proxyMeta.description || fallback.description,
          favicon: proxyMeta.favicon || fallback.favicon,
          domain,
        };
      } catch {
        return fallback;
      }
    }

    const data = await response.json();

    const jsonlinkMeta = {
      title: data.title || "",
      description: data.description || data.excerpt || "",
      favicon: data.images && data.images.icon ? data.images.icon : "",
    };

    // If jsonlink didn't give a description/title, try proxy parse.
    if (!jsonlinkMeta.title || !jsonlinkMeta.description) {
      try {
        const proxyMeta = await fetchMetadataViaProxy(cleanUrl);
        return {
          title: (jsonlinkMeta.title || proxyMeta.title || fallback.title).trim(),
          description: (jsonlinkMeta.description || proxyMeta.description || fallback.description).trim(),
          favicon: (jsonlinkMeta.favicon || proxyMeta.favicon || fallback.favicon).trim(),
          domain,
        };
      } catch {
        // fall through to jsonlink/fallback merge below
      }
    }

    return {
      title: (jsonlinkMeta.title || fallback.title).trim(),
      description: (jsonlinkMeta.description || fallback.description).trim(),
      favicon: (jsonlinkMeta.favicon || fallback.favicon).trim(),
      domain,
    };
  } catch (err) {
    console.warn("Could not fetch metadata, using fallback", err);
    // Last attempt: proxy parse
    try {
      const proxyMeta = await fetchMetadataViaProxy(cleanUrl);
      return {
        title: proxyMeta.title || fallback.title,
        description: proxyMeta.description || fallback.description,
        favicon: proxyMeta.favicon || fallback.favicon,
        domain,
      };
    } catch {
      return fallback;
    }
  }
}

