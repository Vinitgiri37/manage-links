// Handles reading and writing links to localStorage

const STORAGE_KEY = "linkManager.links.v1";

/**
 * @typedef {Object} LinkItem
 * @property {string} id
 * @property {string} url
 * @property {string} title
 * @property {string} description
 * @property {string} domain
 * @property {string} favicon
 * @property {string} createdAt ISO string
 */

/**
 * Load all links from localStorage.
 * @returns {LinkItem[]}
 */
function loadLinks() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.error("Failed to parse stored links", err);
    return [];
  }
}

/**
 * Persist links to localStorage.
 * @param {LinkItem[]} links
 */
function saveLinks(links) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
  } catch (err) {
    console.error("Failed to save links", err);
  }
}

/**
 * Generate a simple unique id.
 */
function createId() {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(16).slice(2, 8)
  ).toLowerCase();
}

