// Script storage module adapted to AUTS schema (reads from auts_scripts and maps to userscript shape)
export const AUTS_SCRIPTS_KEY = "auts_scripts";
import { parseUserScriptMeta } from "../lib/userscript_parser";
import { normalizePatterns } from "../lib/url_matcher";
import { getAllSubscriptions } from "./subscription_storage";
import type { ServerSubscription, ServerScript } from "../lib/types";

export interface AutsInlineSource {
  content: string;
}

export interface AutsLocalSource {
  entryFile: string;
  files: Record<string, string>;
}

export interface AutsPlugin {
  id: string;
  name: string;
  enabled: boolean;
  sourceType: "inline" | "local" | "url" | "server";
  createdAt?: number;
  updatedAt?: number;
  matches?: string[];
  excludes?: string[];
  inline?: AutsInlineSource;
  local?: AutsLocalSource;
  // Optional fields persisted by options UI for remote sources
  url?: { href: string; etag?: string } | string;
  server?: { scriptId: string; licenseKey?: string };
  cache?: {
    version?: string;
    etag?: string;
    sha256?: string;
    signature?: string;
    lastFetchedAt?: number;
    expiresAt?: number;
  };
}

export interface UserScript {
  id: string;
  name: string;
  enabled: boolean;
  matches: string[];
  excludes: string[];
  code: string;
  // For popup labeling and handling
  sourceType: "inline" | "url" | "server";
  // Track origin for toggling and navigation
  origin:
    | { type: "plugin"; pluginId: string }
    | { type: "subscription"; subscriptionId: string; serverScriptId: string };
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
  let matches = Array.isArray(plugin.matches) ? plugin.matches.slice() : [];

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

  // Merge: parse @match and @exclude from UserScript metadata block and union with explicit fields
  let excludes: string[] = Array.isArray(plugin.excludes)
    ? plugin.excludes.slice()
    : [];
  if (code) {
    const meta = parseUserScriptMeta(code);
    if (meta.matches.length > 0) {
      const set = new Set<string>(matches);
      for (const m of meta.matches) set.add(m);
      matches = Array.from(set);
    }
    if (meta.excludes.length > 0) {
      const set = new Set<string>(excludes);
      for (const e of meta.excludes) set.add(e);
      excludes = Array.from(set);
    }
  }

  if (!code || !matches.length) return null;

  return {
    id,
    name,
    enabled: Boolean(plugin.enabled),
    matches: normalizePatterns(matches),
    excludes: normalizePatterns(excludes),
    code,
    // Treat local as inline for UI purposes
    sourceType: plugin.sourceType === "url" ? "url" : "inline",
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
    const resp = await fetch(href, { cache: "no-store" });
    if (!resp.ok) return null;
    const text = await resp.text();
    // Merge metadata
    let matches = Array.isArray(plugin.matches) ? plugin.matches.slice() : [];
    let excludes: string[] = Array.isArray(plugin.excludes)
      ? plugin.excludes.slice()
      : [];
    const meta = parseUserScriptMeta(text || "");
    if (meta.matches && meta.matches.length) {
      const set = new Set<string>(matches);
      for (const m of meta.matches) set.add(m);
      matches = Array.from(set);
    }
    if (meta.excludes && meta.excludes.length) {
      const set = new Set<string>(excludes);
      for (const e of meta.excludes) set.add(e);
      excludes = Array.from(set);
    }
    if (!matches.length) return null;
    return {
      id: plugin.id || generateId(),
      name: plugin.name || plugin.id,
      enabled: Boolean(plugin.enabled),
      matches: normalizePatterns(matches),
      excludes: normalizePatterns(excludes),
      code: text,
      sourceType: "url",
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
    matches: string[];
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
    matches: Array.isArray(script.matches) ? script.matches : [],
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
      matches: plugin.matches || [],
      excludes: [],
      code: plugin.inline?.content || "",
      sourceType: "inline",
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
    matches: Array.isArray(updatedScript.matches)
      ? updatedScript.matches
      : prev.matches,
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
  
  // Parse metadata from script code
  const meta = parseUserScriptMeta(script.code);
  
  // Use metadata matches if available, otherwise default pattern
  const matches = meta.matches.length > 0 ? meta.matches : ["*://*/*"];
  const excludes = meta.excludes || [];
  
  return {
    id: `${subscription.id}_${script.id}`,
    name: meta.name || script.id,
    enabled: script.enabled,
    matches: normalizePatterns(matches),
    excludes: normalizePatterns(excludes),
    code: script.code,
    sourceType: "server",
    origin: { type: "subscription", subscriptionId: subscription.id, serverScriptId: script.id },
  };
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return "script_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);
}
