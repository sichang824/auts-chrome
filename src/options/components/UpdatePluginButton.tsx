import { Button } from "@/components/ui/button";
import type { AutsPlugin as Plugin } from "@/extension/types";
import { readState, upsertScript, writeScripts } from "../store";
import { updateServerPlugin, updateUrlPlugin } from "@/extension/plugin_updater";
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
    const updated = await updateUrlPlugin(plugin);
    if (updated) {
      const state = await readState();
      const regular = state.scripts.filter((s) => !s.cache?.subscriptionId);
      const nextList = upsertScript(regular, updated);
      await writeScripts(nextList);
      chrome.runtime.sendMessage({ type: "STATE_CHANGED", source: "options" });
      toast.success("更新完成", {
        id: tid,
        description: updated.name || plugin.id,
      });
    } else {
      toast.success("已是最新", { id: tid, description: href });
    }
    return;
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
  const tid = toast.loading("更新中...", {
    description: plugin.server.scriptId,
  });
  try {
    const updated = await updateServerPlugin(plugin, { serverBase: base });
    if (updated) {
      const state = await readState();
      const regular = state.scripts.filter((s) => !s.cache?.subscriptionId);
      const nextList = upsertScript(regular, updated);
      await writeScripts(nextList);
    } else {
      toast.success("已是最新", { id: tid, description: plugin.server.scriptId });
      return;
    }
    chrome.runtime.sendMessage({ type: "STATE_CHANGED", source: "options" });
    toast.success("更新完成", {
      id: tid,
      description: updated.name || plugin.server.scriptId,
    });
    try {
      window.location.reload();
    } catch {}
  } catch (e) {
    toast.error("更新失败", { id: tid, description: plugin.server.scriptId });
  }
}
