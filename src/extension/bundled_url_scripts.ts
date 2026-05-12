import {
  getAllAutsPlugins,
  saveAllAutsPlugins,
} from "./script_storage";
import type { AutsPlugin } from "./types";

declare const __AUTS_BUNDLED_SCRIPT_URLS__: string[];

const BUNDLED_URL_SCRIPTS_SEEDED_KEY = "auts_bundled_url_scripts_seeded";

export async function seedBundledUrlScripts(): Promise<void> {
  const urls = normalizeUrlList(
    Array.isArray(__AUTS_BUNDLED_SCRIPT_URLS__) ? __AUTS_BUNDLED_SCRIPT_URLS__ : []
  );
  if (urls.length === 0) return;

  const seededUrls = new Set(await getSeededUrls());
  const urlsToSeed = urls.filter((url) => !seededUrls.has(url));
  if (urlsToSeed.length === 0) return;

  const plugins = await getAllAutsPlugins();
  const existingHrefs = new Set(
    plugins
      .map((plugin) => getPluginHref(plugin))
      .filter((href): href is string => Boolean(href))
  );

  const now = Date.now();
  const newPlugins = urlsToSeed
    .filter((href) => !existingHrefs.has(href))
    .map((href) => {
      const fallbackName = href.split("/").filter(Boolean).pop() || href;
      return {
        id: `bundled-url-${stableHash(href)}`,
        name: fallbackName,
        enabled: false,
        sourceType: "url",
        url: { href },
        createdAt: now,
        updatedAt: now,
      } satisfies AutsPlugin;
    });

  const nextSeededUrls = Array.from(new Set([...seededUrls, ...urls]));
  await setSeededUrls(nextSeededUrls);

  if (newPlugins.length > 0) {
    await saveAllAutsPlugins([...plugins, ...newPlugins]);
  }
}

function normalizeUrlList(urls: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const rawUrl of urls) {
    try {
      const href = new URL(String(rawUrl).trim()).href;
      if (seen.has(href)) continue;
      seen.add(href);
      normalized.push(href);
    } catch (error) {
      console.warn("[AUTS bundled]", "Skipping invalid bundled URL", rawUrl, error);
    }
  }
  return normalized;
}

function getPluginHref(plugin: AutsPlugin): string | undefined {
  if (plugin.sourceType !== "url") return undefined;
  return typeof plugin.url === "string" ? plugin.url : plugin.url?.href;
}

async function getSeededUrls(): Promise<string[]> {
  try {
    const data = await chrome.storage.local.get(BUNDLED_URL_SCRIPTS_SEEDED_KEY);
    const value = data[BUNDLED_URL_SCRIPTS_SEEDED_KEY];
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch (error) {
    console.warn("[AUTS bundled]", "Failed to read seeded URL state", error);
    return [];
  }
}

async function setSeededUrls(urls: string[]): Promise<void> {
  try {
    await chrome.storage.local.set({ [BUNDLED_URL_SCRIPTS_SEEDED_KEY]: urls });
  } catch (error) {
    console.warn("[AUTS bundled]", "Failed to persist seeded URL state", error);
  }
}

function stableHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}
