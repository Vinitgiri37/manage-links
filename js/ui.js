// UI helpers for rendering and interacting with link cards

/**
 * Render all links into the container.
 * @param {LinkItem[]} links
 * @param {HTMLElement} container
 * @param {(id:string) => void} onDelete
 * @param {(id:string, updates:Partial<LinkItem>) => void} onEdit
 */
function renderLinks(links, container, onDelete, onEdit) {
  container.innerHTML = "";

  const emptyState = document.getElementById("linksEmptyState");
  const countEl = document.getElementById("linkCount");

  if (countEl) {
    const label = links.length === 1 ? "item" : "items";
    countEl.textContent = `${links.length} ${label}`;
  }

  if (!links.length) {
    if (emptyState) emptyState.style.display = "block";
    return;
  } else if (emptyState) {
    emptyState.style.display = "none";
  }

  links
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((link) => {
      const card = createLinkCard(link, onDelete, onEdit);
      container.appendChild(card);
    });
}

/**
 * Create a DOM element for a link card.
 * @param {LinkItem} link
 * @param {(id:string) => void} onDelete
 * @param {(id:string, updates:Partial<LinkItem>) => void} onEdit
 * @returns {HTMLElement}
 */
function createLinkCard(link, onDelete, onEdit) {
  const card = document.createElement("article");
  card.className = "link-card";
  card.dataset.id = link.id;

  const header = document.createElement("div");
  header.className = "link-card-header";

  const faviconWrap = document.createElement("div");
  faviconWrap.className = "favicon";

  if (link.favicon) {
    const img = document.createElement("img");
    img.src = link.favicon;
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => {
      faviconWrap.innerHTML = "";
      const fallback = document.createElement("span");
      fallback.className = "favicon-fallback";
      fallback.textContent = link.domain[0]?.toUpperCase() || "?";
      faviconWrap.appendChild(fallback);
    };
    faviconWrap.appendChild(img);
  } else {
    const fallback = document.createElement("span");
    fallback.className = "favicon-fallback";
    fallback.textContent = link.domain[0]?.toUpperCase() || "?";
    faviconWrap.appendChild(fallback);
  }

  const titleGroup = document.createElement("div");
  titleGroup.className = "link-card-title-group";

  // Title is clickable and opens the link in a new tab.
  const titleEl = document.createElement("a");
  titleEl.className = "link-title-link";
  titleEl.href = normalizeUrlForOpen(link.url);
  titleEl.target = "_blank";
  titleEl.rel = "noopener noreferrer";
  titleEl.textContent = link.title || link.url;

  const domainEl = document.createElement("div");
  domainEl.className = "domain";
  domainEl.textContent = link.domain;

  titleGroup.appendChild(titleEl);
  titleGroup.appendChild(domainEl);

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = "Saved";

  header.appendChild(faviconWrap);
  header.appendChild(titleGroup);
  header.appendChild(badge);

  const descEl = document.createElement("p");
  descEl.className = "link-description";
  descEl.textContent = link.description || "No description available.";

  const urlEl = document.createElement("a");
  urlEl.className = "link-url";
  urlEl.href = normalizeUrlForOpen(link.url);
  urlEl.target = "_blank";
  urlEl.rel = "noopener noreferrer";
  urlEl.textContent = link.url;

  const metaRow = document.createElement("div");
  metaRow.className = "link-meta-row";

  const timestamp = document.createElement("span");
  timestamp.className = "timestamp";
  const dt = new Date(link.createdAt);
  timestamp.textContent = dt.toLocaleString();

  const actions = document.createElement("div");
  // Flex row for equal-width saved link actions
  actions.className = "card-actions saved-actions";

  // Dedicated "Open" button that ALWAYS opens the saved URL.
  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "saved-action-btn saved-action-btn--open";
  openBtn.textContent = "Open";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "saved-action-btn saved-action-btn--edit";
  editBtn.textContent = "Edit";

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "saved-action-btn saved-action-btn--delete";
  deleteBtn.textContent = "Delete";

  actions.appendChild(openBtn);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  metaRow.appendChild(timestamp);
  metaRow.appendChild(actions);

  card.appendChild(header);
  card.appendChild(descEl);
  card.appendChild(urlEl);
  card.appendChild(metaRow);

  // Inline edit UI
  const editMode = document.createElement("div");
  editMode.className = "edit-mode";
  editMode.style.display = "none";

  const editRow0 = document.createElement("div");
  editRow0.className = "edit-mode-row";
  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.placeholder = "https://example.com";
  urlInput.value = link.url || "";
  editRow0.appendChild(urlInput);

  // Editing rule: user only edits URL. Title/description regenerate automatically.

  const editActions = document.createElement("div");
  editActions.className = "edit-actions";

  const saveEditBtn = document.createElement("button");
  saveEditBtn.type = "button";
  saveEditBtn.className = "ghost-btn";
  saveEditBtn.textContent = "Save";

  const cancelEditBtn = document.createElement("button");
  cancelEditBtn.type = "button";
  cancelEditBtn.className = "ghost-btn";
  cancelEditBtn.textContent = "Cancel";

  editActions.appendChild(cancelEditBtn);
  editActions.appendChild(saveEditBtn);

  editMode.appendChild(editRow0);
  editMode.appendChild(editActions);

  card.appendChild(editMode);

  openBtn.addEventListener("click", () => {
    // Always open the saved URL in a new tab.
    window.open(normalizeUrlForOpen(link.url), "_blank");
  });

  editBtn.addEventListener("click", () => {
    const isOpen = editMode.style.display === "block";
    editMode.style.display = isOpen ? "none" : "block";
    if (!isOpen) {
      urlInput.value = link.url || "";
      urlInput.focus();
    }
  });

  cancelEditBtn.addEventListener("click", () => {
    editMode.style.display = "none";
  });

  saveEditBtn.addEventListener("click", async () => {
    const updates = {
      url: urlInput.value.trim(),
    };
    await onEdit(link.id, updates);
  });

  deleteBtn.addEventListener("click", () => {
    const ok = window.confirm("Delete this link?");
    if (!ok) return;
    onDelete(link.id);
  });

  return card;
}

