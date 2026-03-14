// Main application wiring
// Notes:
// - Links are persisted in localStorage (see js/storage.js).
// - We validate URLs strictly: must start with http:// or https://.
// - Metadata fetching is best-effort; even if it fails, we still save the URL so "Open Link" always works.
document.addEventListener("DOMContentLoaded", () => {
  const addForm = document.getElementById("addLinkForm");
  const urlInput = document.getElementById("urlInput");
  const searchInput = document.getElementById("searchInput");
  const statusEl = document.getElementById("formStatus");
  const container = document.getElementById("linksContainer");

  /** @type {LinkItem[]} */
  let links = loadLinks();
  let searchQuery = "";

  /**
   * Validate a URL as an absolute http(s) URL.
   * @param {string} value
   * @returns {boolean}
   */
  function isValidHttpUrl(value) {
    if (!/^https?:\/\//i.test(value)) return false;
    try {
      const u = new URL(value);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }

  // Light repair for older saved links WITHOUT changing the stored URL:
  // - Ensure title/description exist (regenerated), but keep the original saved URL untouched.
  let didRepair = false;
  links = links.map((l) => {
    const domain = l.domain || getDomainFromUrl(normalizeUrlForOpen(l.url));
    const nextTitle = l.title || generateShortTitle(l.url, domain);
    const nextDesc = l.description || generateShortDescription(l.url, domain, "");
    const nextFavicon = l.favicon || buildFavicon(domain);

    if (
      nextTitle !== l.title ||
      nextDesc !== l.description ||
      nextFavicon !== l.favicon ||
      domain !== l.domain
    ) {
      didRepair = true;
      return {
        ...l,
        domain,
        favicon: nextFavicon,
        title: nextTitle,
        description: nextDesc,
      };
    }
    return l;
  });
  if (didRepair) saveLinks(links);

  function setStatus(message, variant) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.classList.remove("form-status--error", "form-status--success");
    if (variant === "error") statusEl.classList.add("form-status--error");
    if (variant === "success") statusEl.classList.add("form-status--success");
  }

  function applySearchFilter() {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return links;
    return links.filter((link) => {
      return (
        link.title.toLowerCase().includes(q) ||
        link.url.toLowerCase().includes(q) ||
        (link.description || "").toLowerCase().includes(q) ||
        link.domain.toLowerCase().includes(q)
      );
    });
  }

  function refresh() {
    const visible = applySearchFilter();
    renderLinks(visible, container, handleDelete, handleEdit);
  }

  function handleDelete(id) {
    links = links.filter((l) => l.id !== id);
    saveLinks(links);
    refresh();
  }

  async function handleEdit(id, updates) {
    const current = links.find((l) => l.id === id);
    if (!current) return;

    // Editing rule: user only edits the URL. Title/description regenerate automatically.
    const nextUrl =
      typeof updates.url === "string" ? updates.url.trim() : current.url;
    if (nextUrl !== current.url) {
      if (!isValidHttpUrl(nextUrl)) {
        setStatus(
          "Updated URL must start with http:// or https://",
          "error"
        );
        return;
      }
      setStatus("Updating link…", null);
      let meta = null;
      try {
        meta = await fetchLinkMetadata(nextUrl);
      } catch {
        meta = null;
      }

      links = links.map((l) =>
        l.id === id
          ? {
              ...l,
              url: nextUrl,
              domain: (meta && meta.domain) || getDomainFromUrl(nextUrl),
              favicon: (meta && meta.favicon) || buildFavicon(nextUrl),
              title: generateShortTitle(
                nextUrl,
                (meta && meta.domain) || getDomainFromUrl(nextUrl)
              ),
              description: generateShortDescription(
                nextUrl,
                (meta && meta.domain) || getDomainFromUrl(nextUrl),
                (meta && meta.description) || ""
              ),
            }
          : l
      );
      saveLinks(links);
      setStatus("Link updated.", "success");
      refresh();
      return;
    }

    // No URL change -> nothing to update (by design).
    setStatus("No changes.", null);
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value || "";
      refresh();
    });
  }

  if (addForm && urlInput) {
    addForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const rawUrl = urlInput.value.trim();
      if (!rawUrl) return;

      // Strict validation requirement: users must paste a URL starting with http:// or https://
      const normalisedUrl = rawUrl;
      if (!isValidHttpUrl(normalisedUrl)) {
        setStatus("Please enter a valid URL starting with http:// or https://", "error");
        return;
      }

      const existing = links.find(
        (l) => l.url.toLowerCase() === normalisedUrl.toLowerCase()
      );
      if (existing) {
        setStatus("This link is already saved.", "error");
        return;
      }

      const submitBtn = addForm.querySelector("button[type='submit']");
      if (submitBtn) submitBtn.disabled = true;
      setStatus("Fetching website metadata…", null);

      try {
        const meta = await fetchLinkMetadata(normalisedUrl);
        const now = new Date().toISOString();
        const domain = meta.domain || getDomainFromUrl(normalisedUrl);
        const newItem = {
          id: createId(),
          url: normalisedUrl,
          title: generateShortTitle(normalisedUrl, domain),
          description: generateShortDescription(
            normalisedUrl,
            domain,
            meta.description || ""
          ),
          favicon: meta.favicon,
          domain,
          createdAt: now,
        };
        links.push(newItem);
        saveLinks(links);
        urlInput.value = "";
        setStatus("Link added.", "success");
        refresh();
      } catch (err) {
        // Even if metadata fails unexpectedly, still save the URL so it can always be opened.
        console.warn("Unexpected error while fetching metadata, saving minimal link.", err);
        const now = new Date().toISOString();
        const domain = getDomainFromUrl(normalisedUrl);
        const minimal = {
          id: createId(),
          url: normalisedUrl,
          title: generateShortTitle(normalisedUrl, domain),
          description: generateShortDescription(normalisedUrl, domain, ""),
          favicon: buildFavicon(normalisedUrl),
          domain,
          createdAt: now,
        };
        links.push(minimal);
        saveLinks(links);
        urlInput.value = "";
        setStatus("Link added (metadata unavailable).", "success");
        refresh();
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // Initial render
  refresh();
});

