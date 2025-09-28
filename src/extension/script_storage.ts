// Script storage module adapted to AUTS schema (reads from auts_scripts and maps to userscript shape)
export const AUTS_SCRIPTS_KEY = "auts_scripts";
import { parseUserScriptMeta } from "../lib/userscript_parser";
import { normalizePatterns } from "../lib/url_matcher";
import { getAllSubscriptions } from "./subscription_storage";
import type { AutsPlugin, ServerSubscription, ServerScript, UserScript, UserscriptMeta } from "./types";

// Local helper to build default metadata from code
function buildMetadataFromCode(code: string): UserscriptMeta {
  const meta = parseUserScriptMeta(code || "");
  return {
    matches: Array.isArray(meta.matches) ? meta.matches : [],
    excludes: Array.isArray(meta.excludes) ? meta.excludes : [],
    grants: Array.isArray(meta.grants) ? meta.grants : [],
    requires: Array.isArray(meta.requires) ? meta.requires : [],
    name: meta.name,
    version: meta.version,
    description: meta.description,
    author: meta.author,
  };
}

/**
 * Read raw AUTS plugins from local storage
 */
export async function getAllAutsPlugins(): Promise<AutsPlugin[]> {
  try {
    const data = await chrome.storage.local.get(AUTS_SCRIPTS_KEY);
    const value = data[AUTS_SCRIPTS_KEY];
    return Array.isArray(value) ? (value as AutsPlugin[]) : [];
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error getting AUTS plugins:", error);
    return [];
  }
}

/**
 * Save AUTS plugins to local storage
 */
export async function saveAllAutsPlugins(plugins: AutsPlugin[]): Promise<void> {
  try {
    await chrome.storage.local.set({ [AUTS_SCRIPTS_KEY]: plugins });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error saving AUTS plugins:", error);
  }
}

/**
 * Map AUTS plugin to userscript registration shape
 * Returns null when no executable code is present
 */
export function mapPluginToUserScript(
  plugin: AutsPlugin | null | undefined
): UserScript | null {
  if (!plugin) return null;
  const id = plugin.id || generateId();
  const name = plugin.name || id;

  // Only support inline and local for now
  let code = "";
  if (
    plugin.sourceType === "inline" &&
    plugin.inline &&
    typeof plugin.inline.content === "string"
  ) {
    code = plugin.inline.content;
  } else if (
    plugin.sourceType === "local" &&
    plugin.local &&
    plugin.local.entryFile &&
    plugin.local.files &&
    plugin.local.files[plugin.local.entryFile]
  ) {
    code = String(plugin.local.files[plugin.local.entryFile] || "");
  } else {
    // url/server types not handled by userScripts registration in this demo
    code = "";
  }

  if (!code) return null;

  const metadata = buildMetadataFromCode(code);
  if (!metadata.matches || metadata.matches.length === 0) return null;

  return {
    id,
    name,
    enabled: Boolean(plugin.enabled),
    sourceType: plugin.sourceType === "url" ? "url" : "inline",
    code,
    metadata: {
      ...metadata,
    },
    origin: { type: "plugin", pluginId: id },
  };
}

/**
 * Public: Get all mapped userscripts from AUTS plugins and subscriptions
 */
export async function getAllScripts(): Promise<UserScript[]> {
  const plugins = await getAllAutsPlugins();
  const results: UserScript[] = [];
  
  // Process plugins
  for (const plugin of plugins) {
    if (!plugin || plugin.enabled === false) continue;
    if (plugin.sourceType === "url") {
      const mapped = await mapUrlPlugin(plugin);
      if (mapped) results.push(mapped);
      continue;
    }
    // Fallback to inline/local mapping
    const localMapped = mapPluginToUserScript(plugin);
    if (localMapped) results.push(localMapped);
  }
  
  // Process subscriptions
  const subscriptions = await getSubscriptionsForScripts();
  for (const subscription of subscriptions) {
    if (!subscription.enabled) continue;
    for (const script of subscription.scripts) {
      if (!script.enabled) continue;
      const userScript = mapServerScriptToUserScript(script, subscription);
      if (userScript) results.push(userScript);
    }
  }
  
  return results;
}

/**
 * Public: Get all userscripts for popup display, including disabled ones
 */
export async function getAllScriptsForPopup(): Promise<UserScript[]> {
  const plugins = await getAllAutsPlugins();
  const results: UserScript[] = [];

  // Include all plugins regardless of enabled state
  for (const plugin of plugins) {
    if (!plugin) continue;
    if (plugin.sourceType === "url") {
      const mapped = await mapUrlPlugin(plugin);
      if (mapped) results.push(mapped);
      continue;
    }
    const localMapped = mapPluginToUserScript(plugin);
    if (localMapped) results.push(localMapped);
  }

  // Include all subscription scripts regardless of subscription/script enabled state
  const subscriptions = await getSubscriptionsForScripts();
  for (const subscription of subscriptions) {
    for (const script of subscription.scripts) {
      const userScript = mapServerScriptToUserScript(script, subscription);
      if (userScript) results.push(userScript);
    }
  }

  return results;
}

async function mapUrlPlugin(plugin: AutsPlugin): Promise<UserScript | null> {
  try {
    const href = typeof plugin.url === "string" ? plugin.url : plugin.url?.href;
    if (!href) return null;

    // Prefer cached code to allow offline fallback
    let text = plugin.cache?.code || "";

    // If no cached code exists, try a best-effort fetch once
    if (!text) {
      try {
        const resp = await fetch(href, { cache: "no-store" });
        if (resp.ok) {
          text = await resp.text();
        }
      } catch (_e) {
        // Ignore; will fall back to empty
      }
    }

    if (!text) return null;

    const metadata = buildMetadataFromCode(text || "");
    if (!metadata.matches || metadata.matches.length === 0) return null;
    return {
      id: plugin.id || generateId(),
      name: plugin.name || plugin.id,
      enabled: Boolean(plugin.enabled),
      sourceType: "url",
      code: text,
      metadata: {
        ...metadata,
      },
      origin: { type: "plugin", pluginId: plugin.id || "" },
    };
  } catch (_e) {
    return null;
  }
}

/**
 * Add a new script (stored as AUTS inline plugin)
 */
export async function addScript(
  script: Partial<UserScript> & {
    name: string;
    code: string;
  }
): Promise<UserScript> {
  const plugins = await getAllAutsPlugins();
  const id = script.id || generateId();
  const plugin: AutsPlugin = {
    id,
    name: script.name || id,
    enabled: script.enabled !== false,
    sourceType: "inline",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    inline: { content: String(script.code || "") },
  };
  plugins.push(plugin);
  await saveAllAutsPlugins(plugins);
  const mapped = mapPluginToUserScript(plugin);
  if (!mapped) {
    // Should not happen because we just created it
    return {
      id,
      name: plugin.name,
      enabled: plugin.enabled,
      sourceType: "inline",
      code: plugin.inline?.content || "",
      metadata: buildMetadataFromCode(plugin.inline?.content || ""),
      origin: { type: "plugin", pluginId: id },
    };
  }
  return mapped;
}

/**
 * Update an existing script (AUTS inline plugin only)
 */
export async function updateScript(
  id: string,
  updatedScript: Partial<UserScript>
): Promise<UserScript | null> {
  const plugins = await getAllAutsPlugins();
  const index = plugins.findIndex((p) => p.id === id);
  if (index < 0) return null;
  const prev = plugins[index];
  const next: AutsPlugin = {
    ...prev,
    name: updatedScript.name != null ? updatedScript.name : prev.name,
    enabled:
      typeof updatedScript.enabled === "boolean"
        ? updatedScript.enabled
        : prev.enabled,
    inline: {
      content:
        updatedScript.code != null
          ? String(updatedScript.code)
          : prev.inline
          ? String(prev.inline.content || "")
          : "",
    },
    updatedAt: Date.now(),
  };
  plugins[index] = next;
  await saveAllAutsPlugins(plugins);
  return mapPluginToUserScript(next);
}

/**
 * Delete a script (by AUTS plugin id)
 */
export async function deleteScript(id: string): Promise<void> {
  const plugins = await getAllAutsPlugins();
  const filtered = plugins.filter((p) => p.id !== id);
  await saveAllAutsPlugins(filtered);
}

/**
 * Toggle script enabled status (AUTS plugin)
 */
export async function toggleScript(id: string): Promise<UserScript | null> {
  const plugins = await getAllAutsPlugins();
  const plugin = plugins.find((p) => p.id === id);
  if (!plugin) return null;
  plugin.enabled = !plugin.enabled;
  plugin.updatedAt = Date.now();
  await saveAllAutsPlugins(plugins);
  return mapPluginToUserScript(plugin);
}

/**
 * Get subscriptions for script mapping
 */
async function getSubscriptionsForScripts(): Promise<ServerSubscription[]> {
  return await getAllSubscriptions();
}

/**
 * Map server script to userscript format
 */
function mapServerScriptToUserScript(script: ServerScript, subscription: ServerSubscription): UserScript | null {
  if (!script.code) return null;

  const metadata = buildMetadataFromCode(script.code);
  const normalized: UserscriptMeta = {
    ...metadata,
    matches: normalizePatterns(metadata.matches),
    excludes: normalizePatterns(metadata.excludes || []),
  };

  if (!normalized.matches || normalized.matches.length === 0) return null;

  return {
    id: `${subscription.id}_${script.id}`,
    name: metadata.name || script.id,
    enabled: script.enabled,
    code: script.code,
    sourceType: "server",
    metadata: normalized,
    origin: { type: "subscription", subscriptionId: subscription.id, serverScriptId: script.id },
  };
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return "script_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);
}

/**
 * Refresh cached code for URL plugins. If network fails, keep existing cache.
 */
export async function refreshUrlPluginsAuto(): Promise<void> {
  const plugins = await getAllAutsPlugins();
  let changed = false;
  for (const p of plugins) {
    try {
      if (!p || p.sourceType !== "url") continue;
      const href = typeof p.url === "string" ? p.url : p.url?.href;
      if (!href) continue;

      const headers: Record<string, string> = {};
      const prevEtag = typeof p.url === "object" ? p.url?.etag : undefined;
      if (prevEtag) headers["If-None-Match"] = prevEtag;

      const resp = await fetch(href, { cache: "no-store", headers });
      if (resp.status === 304) {
        // Not modified: only bump lastFetchedAt in memory, no storage write
        continue;
      }
      if (!resp.ok) continue;

      const text = await resp.text();
      const etag = resp.headers.get("ETag") || undefined;

      // Decide change by comparing code and metadata snapshot instead of per-field checks
      const prevCode = p.cache?.code || "";
      const prevMeta = parseUserScriptMeta(prevCode);
      const nextMeta = parseUserScriptMeta(text || "");
      const keyOf = (m: ReturnType<typeof parseUserScriptMeta>): string => {
        const mm = (m.matches || []).slice().sort();
        const ex = (m.excludes || []).slice().sort();
        return [m.name || "", m.version || "", m.description || "", `m:${mm.join(",")}`, `x:${ex.join(",")}`].join("|");
      };
      const codeChanged = prevCode !== text;
      const metaChanged = keyOf(prevMeta) !== keyOf(nextMeta);

      if (codeChanged || metaChanged) {
        // Apply scalar metadata via object spread/merge (only defined values)
        const scalarPatch: Partial<AutsPlugin> = {
          ...(nextMeta.name ? { name: nextMeta.name } : {}),
          ...(nextMeta.version ? { version: nextMeta.version } : {}),
          ...(nextMeta.description ? { description: nextMeta.description } : {}),
          ...(nextMeta.author ? { author: nextMeta.author } : {}),
        };
        Object.assign(p, scalarPatch);
        

        // Merge matches/excludes (union) and store raw; normalize happens at mapping
        if (Array.isArray(nextMeta.matches) && nextMeta.matches.length > 0) {
          const existing = Array.isArray(p.matches) ? p.matches.slice() : [];
          const set = new Set<string>(existing);
          for (const m of nextMeta.matches) set.add(m);
          p.matches = Array.from(set);
        }
        if (Array.isArray(nextMeta.excludes) && nextMeta.excludes.length > 0) {
          const existing = Array.isArray(p.excludes) ? p.excludes.slice() : [];
          const set = new Set<string>(existing);
          for (const e of nextMeta.excludes) set.add(e);
          p.excludes = Array.from(set) as any;
        }

        p.cache = { ...(p.cache || {}), code: text, etag, lastFetchedAt: Date.now() };
        if (typeof p.url === "object") {
          p.url = { href: p.url.href, etag };
        }
        p.updatedAt = Date.now();
        changed = true;
      }
    } catch (_e) {
      // Ignore individual failures
    }
  }
  if (changed) {
    await saveAllAutsPlugins(plugins);
  }
}
