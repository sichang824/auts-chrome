import type { AutsPlugin } from "./types";
import { parseUserScriptMeta } from "../lib/userscript_parser";
import { getAllAutsPlugins, saveAllAutsPlugins } from "./script_storage";

type FetchOptions = {
  serverBase?: string;
};

function getUrlAndEtag(plugin: AutsPlugin): { href: string | undefined; etag?: string } {
  const href = typeof plugin.url === "string" ? plugin.url : plugin.url?.href;
  const etagFromUrl = typeof plugin.url === "object" ? plugin.url?.etag : undefined;
  const etag = etagFromUrl || plugin.cache?.etag || undefined;
  return { href, etag };
}

function mergeUrlPluginWithCode(plugin: AutsPlugin, code: string, etag?: string): AutsPlugin {
  const meta = parseUserScriptMeta(code || "");
  const href = typeof plugin.url === "string" ? plugin.url : plugin.url?.href;
  const next: AutsPlugin = {
    ...plugin,
    name: meta.name || plugin.name || plugin.id,
    version: meta.version || plugin.version,
    description: meta.description ?? plugin.description,
    author: meta.author ?? plugin.author,
    matches: Array.isArray(meta.matches) && meta.matches.length > 0 ? meta.matches : plugin.matches,
    url: href ? { href, etag } : plugin.url,
    cache: {
      ...(plugin.cache || {}),
      code,
      etag,
      lastFetchedAt: Date.now(),
    },
    updatedAt: Date.now(),
  };
  return next;
}

function mergeServerPluginWithPayload(plugin: AutsPlugin, payload: { code: string; etag?: string; version?: string; sha256?: string; signature?: string; expiresAt?: number | string | undefined; name?: string; }): AutsPlugin {
  const meta = parseUserScriptMeta(payload.code || "");
  const next: AutsPlugin = {
    ...plugin,
    name: payload.name || meta.name || plugin.name || plugin.server?.scriptId || plugin.id,
    version: payload.version || meta.version || plugin.version,
    description: meta.description ?? plugin.description,
    author: meta.author ?? plugin.author,
    matches: Array.isArray(meta.matches) && meta.matches.length > 0 ? meta.matches : plugin.matches,
    cache: {
      ...plugin.cache,
      version: payload.version || plugin.cache?.version,
      etag: payload.etag || plugin.cache?.etag,
      sha256: payload.sha256 || plugin.cache?.sha256,
      signature: payload.signature || plugin.cache?.signature,
      lastFetchedAt: Date.now(),
      expiresAt: typeof payload.expiresAt === "number"
        ? payload.expiresAt
        : typeof payload.expiresAt === "string"
        ? Number(payload.expiresAt) || plugin.cache?.expiresAt
        : plugin.cache?.expiresAt,
      code: payload.code,
    },
    updatedAt: Date.now(),
  };
  return next;
}

async function persistUpdatedPlugin(updated: AutsPlugin): Promise<void> {
  const plugins = await getAllAutsPlugins();
  const index = plugins.findIndex((p) => p?.id === updated.id);
  if (index >= 0) {
    plugins[index] = updated;
  } else {
    plugins.push(updated);
  }
  await saveAllAutsPlugins(plugins);
}

export async function updateUrlPlugin(plugin: AutsPlugin): Promise<AutsPlugin | null> {
  const { href, etag: prevEtag } = getUrlAndEtag(plugin);
  if (!href) return null;
  const headers: Record<string, string> = {};
  if (prevEtag) headers["If-None-Match"] = prevEtag;
  const resp = await fetch(href, { cache: "no-store", headers });
  if (resp.status === 304) return null;
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const text = await resp.text();
  const etag = resp.headers.get("ETag") || undefined;
  const updated = mergeUrlPluginWithCode(plugin, text, etag);
  await persistUpdatedPlugin(updated);
  return updated;
}

export async function updateServerPlugin(plugin: AutsPlugin, options: FetchOptions): Promise<AutsPlugin | null> {
  if (!plugin.server?.scriptId) return null;
  const base = options.serverBase || "";
  if (!base) throw new Error("Server base is required");
  const url = `${base.replace(/\/$/, "")}/scripts/${encodeURIComponent(plugin.server.scriptId)}`;
  const qs = new URLSearchParams();
  if (plugin.server.licenseKey) qs.set("license", plugin.server.licenseKey);
  const fullUrl = qs.toString() ? `${url}?${qs}` : url;

  const headers: Record<string, string> = {};
  if (plugin.cache?.etag) headers["If-None-Match"] = plugin.cache.etag;

  const resp = await fetch(fullUrl, { cache: "no-store", headers });
  if (resp.status === 304) return null;
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const etag = resp.headers.get("ETag") || undefined;
  const pkg = await resp.json();

  let code = "";
  if (typeof pkg.codeBase64 === "string") {
    code = atob(pkg.codeBase64);
  } else if (typeof pkg.code === "string") {
    code = String(pkg.code);
  }

  const updated = mergeServerPluginWithPayload(plugin, {
    code,
    etag,
    version: pkg?.version,
    sha256: pkg?.sha256,
    signature: pkg?.signature,
    expiresAt: pkg?.expiresAt,
    name: pkg?.name,
  });
  await persistUpdatedPlugin(updated);
  return updated;
}

export async function refreshUrlPluginsAuto(): Promise<void> {
  const plugins = await getAllAutsPlugins();
  let changed = false;
  for (let i = 0; i < plugins.length; i++) {
    const p = plugins[i];
    try {
      if (!p || p.sourceType !== "url") continue;
      const { href, etag: prevEtag } = getUrlAndEtag(p);
      if (!href) continue;

      const headers: Record<string, string> = {};
      if (prevEtag) headers["If-None-Match"] = prevEtag;
      const resp = await fetch(href, { cache: "no-store", headers });
      if (resp.status === 304) continue;
      if (!resp.ok) continue;

      const text = await resp.text();
      const etag = resp.headers.get("ETag") || undefined;

      // Detect whether anything effectively changed
      const prevCode = p.cache?.code || "";
      if (prevCode === text && (typeof p.url === "object" ? p.url?.etag : undefined) === etag) {
        continue;
      }

      plugins[i] = mergeUrlPluginWithCode(p, text, etag);
      changed = true;
    } catch (_e) {
      // ignore individual failures
    }
  }
  if (changed) {
    await saveAllAutsPlugins(plugins);
  }
}


