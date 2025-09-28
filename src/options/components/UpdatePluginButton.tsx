import { Button } from "@/components/ui/button";
import type { Plugin } from "../store";
import { readState, upsertScript, writeScripts } from "../store";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function UpdatePluginButton(props: {
  plugin: Plugin;
  serverBase?: string;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  children?: React.ReactNode;
}) {
  const { plugin, serverBase } = props;

  const onClick = async () => {
    if (plugin.sourceType === "url") {
      await refreshUrl(plugin);
    } else if (plugin.sourceType === "server") {
      await refreshServer(plugin, serverBase);
    }
  };

  return (
    <Button
      variant={props.variant || "ghost"}
      size={props.size || "sm"}
      className={
        props.className ||
        "h-8 px-3 text-xs text-green-600 hover:text-green-700"
      }
      onClick={onClick}
    >
      <RefreshCw className="w-3 h-3 mr-1.5" />
      {props.children || "更新"}
    </Button>
  );
}

async function refreshUrl(plugin: Plugin): Promise<void> {
  const href = typeof plugin.url === "string" ? plugin.url : plugin.url?.href;
  if (!href) return;
  const currentEtag =
    typeof plugin.url === "string" ? undefined : plugin.url?.etag;
  const tid = toast.loading("更新中...", { description: href });
  try {
    const headers: Record<string, string> = {};
    if (currentEtag) headers["If-None-Match"] = currentEtag;
    const resp = await fetch(href, { cache: "no-store", headers });
    if (resp.status === 304)
      return void toast.success("已是最新", { id: tid, description: href });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    const etag = resp.headers.get("ETag") || undefined;
    const meta = (await import("@/lib/userscript_parser")).parseUserScriptMeta(
      text || ""
    );

    const state = await readState();
    const updated: Plugin = {
      ...plugin,
      name: plugin.name || meta.name || plugin.id,
      version: plugin.version || meta.version,
      description: plugin.description || meta.description,
      author: plugin.author || meta.author,
      matches:
        plugin.matches && plugin.matches.length > 0
          ? plugin.matches
          : meta.matches,
      url: typeof plugin.url === "string" ? href : { href, etag },
      updatedAt: Date.now(),
    };
    const nextList = upsertScript(state.scripts, updated);
    await writeScripts(nextList);
    chrome.runtime.sendMessage({ type: "STATE_CHANGED", source: "options" });
    toast.success("更新完成", {
      id: tid,
      description: updated.name || plugin.id,
    });
  } catch (e) {
    toast.error("更新失败", { id: tid, description: href });
  }
}

async function refreshServer(
  plugin: Plugin,
  serverBase?: string
): Promise<void> {
  if (!plugin.server?.scriptId) return;
  const base = serverBase || "";
  if (!base) return void toast.error("未配置服务器地址");
  const url = `${base.replace(/\/$/, "")}/scripts/${encodeURIComponent(
    plugin.server.scriptId
  )}`;
  const qs = new URLSearchParams();
  if (plugin.server.licenseKey) qs.set("license", plugin.server.licenseKey);
  const fullUrl = qs.toString() ? `${url}?${qs}` : url;
  const headers: Record<string, string> = {};
  if (plugin.cache?.etag) headers["If-None-Match"] = plugin.cache.etag;
  const tid = toast.loading("更新中...", {
    description: plugin.server.scriptId,
  });
  try {
    const resp = await fetch(fullUrl, { cache: "no-store", headers });
    if (resp.status === 304)
      return void toast.success("已是最新", {
        id: tid,
        description: plugin.server.scriptId,
      });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const etag = resp.headers.get("ETag") || undefined;
    const pkg = await resp.json();
    let code = "";
    if (typeof pkg.codeBase64 === "string") {
      try {
        code = atob(pkg.codeBase64);
      } catch {}
    } else if (typeof pkg.code === "string") {
      code = String(pkg.code);
    }
    const meta = (await import("@/lib/userscript_parser")).parseUserScriptMeta(
      code || ""
    );

    const state = await readState();
    const updated: Plugin = {
      ...plugin,
      name: plugin.name || pkg?.name || meta.name || plugin.server.scriptId,
      version: pkg?.version || plugin.version || meta.version,
      description: plugin.description || meta.description,
      author: plugin.author || meta.author,
      matches:
        plugin.matches && plugin.matches.length > 0
          ? plugin.matches
          : meta.matches,
      cache: {
        ...plugin.cache,
        version: pkg?.version || plugin.cache?.version,
        etag: etag || pkg?.etag || plugin.cache?.etag,
        sha256: pkg?.sha256 || plugin.cache?.sha256,
        signature: pkg?.signature || plugin.cache?.signature,
        lastFetchedAt: Date.now(),
        expiresAt: pkg?.expiresAt || plugin.cache?.expiresAt,
      },
      updatedAt: Date.now(),
    };

    const nextList = upsertScript(state.scripts, updated);
    await writeScripts(nextList);
    chrome.runtime.sendMessage({ type: "STATE_CHANGED", source: "options" });
    toast.success("更新完成", {
      id: tid,
      description: updated.name || plugin.server.scriptId,
    });
  } catch (e) {
    toast.error("更新失败", { id: tid, description: plugin.server.scriptId });
  }
}
