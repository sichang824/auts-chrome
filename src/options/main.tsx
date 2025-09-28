import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import "@/index.css";
import { applyTheme, watchSystemTheme } from "@/lib/theme";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { DetailsPage } from "./pages/Details";
import { EditorPage } from "./pages/Editor";
import { PluginsPage } from "./pages/Plugins";
import { SubscriptionsPage } from "./pages/SubscriptionsPage";
import { AddUrlDialog, type AddUrlPayload } from "./pages/AddUrlDialog";
import {
  AddServerDialog,
  type AddSubscriptionPayload,
} from "./pages/AddServerDialog";
import { SettingsPage } from "./pages/Settings";
import { Toaster, toast } from "sonner";
import type { AutsState } from "./store";
import type { AutsPlugin as Plugin, ThemeMode } from "@/extension/types";
import {
  readState,
  removeScriptById,
  upsertScript,
  writeScripts,
  writeSync,
} from "./store";
import { parseUserScriptMeta } from "@/lib/userscript_parser";
import {
  toggleSubscriptionScript,
  addSubscription,
} from "@/extension/subscription_storage";
import {
  Puzzle,
  Settings as SettingsIcon,
  Code2,
  Github,
  ExternalLink,
  ChevronRight,
  Server,
} from "lucide-react";

// IndexedDB helpers for file handles
const DB_NAME = "auts-file-handles";
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("fileHandles")) {
        db.createObjectStore("fileHandles");
      }
      if (!db.objectStoreNames.contains("dirHandles")) {
        db.createObjectStore("dirHandles");
      }
    };
  });
};

const saveFileHandle = async (id: string, fileHandle: any): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction(["fileHandles"], "readwrite");
  const store = transaction.objectStore("fileHandles");
  await new Promise<void>((resolve, reject) => {
    const request = store.put(fileHandle, id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const getFileHandle = async (id: string): Promise<any> => {
  const db = await openDB();
  const transaction = db.transaction(["fileHandles"], "readonly");
  const store = transaction.objectStore("fileHandles");
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const getDirHandle = async (
  id: string
): Promise<{ dirHandle: any; fileHandles: { [path: string]: any } } | null> => {
  const db = await openDB();
  const transaction = db.transaction(["dirHandles"], "readonly");
  const store = transaction.objectStore("dirHandles");
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

const processDirectory = async (
  dirHandle: any,
  path: string,
  fileMap: { [path: string]: string },
  fileHandles: { [path: string]: any }
): Promise<void> => {
  for await (const [name, handle] of dirHandle.entries()) {
    const currentPath = path ? `${path}/${name}` : name;

    if (
      handle.kind === "file" &&
      (name.endsWith(".ts") || name.endsWith(".tsx"))
    ) {
      const file = await handle.getFile();
      const content = await file.text();
      fileMap[currentPath] = content;
      fileHandles[currentPath] = handle;
    } else if (handle.kind === "directory") {
      await processDirectory(handle, currentPath, fileMap, fileHandles);
    }
  }
};

type Route =
  | { name: "plugins" }
  | { name: "settings" }
  | { name: "subscriptions" }
  | { name: "details"; id: string }
  | { name: "editor"; id: string };

function parseHash(): Route {
  const h = (location.hash || "").replace(/^#/, "") || "/plugins";
  if (h.startsWith("/settings")) return { name: "settings" };
  if (h.startsWith("/subscriptions")) return { name: "subscriptions" };
  if (h.startsWith("/plugin/")) {
    const rest = h.slice("/plugin/".length);
    const parts = rest.split("/");
    const id = decodeURIComponent(parts[0] || "");
    if (parts[1] === "edit") return { name: "editor", id };
    return { name: "details", id };
  }
  return { name: "plugins" };
}

function OptionsApp() {
  const [state, setState] = useState<AutsState>({
    autsEnabled: true,
    autsServer: undefined,
    autsTheme: "system",
    autsVisualIndicator: false,
    scripts: [],
  });
  const [route, setRoute] = useState<Route>(parseHash());
  const [openAddUrl, setOpenAddUrl] = useState(false);
  const [openAddServer, setOpenAddServer] = useState(false);

  useEffect(() => {
    const loadState = () => {
      readState().then((s) => {
        setState(s);
        applyTheme(s.autsTheme);
      });
    };

    // Initial load
    loadState();

    // Listen for messages from other parts of the extension
    const messageListener = (message: any) => {
      if (message.type === "STATE_CHANGED" && message.source !== "options") {
        // Reload state when changes are broadcast from popup or other sources
        loadState();
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Listen for storage changes
    const storageListener = (changes: any) => {
      if (
        changes.auts_enabled ||
        changes.auts_scripts ||
        changes.auts_visual_indicator
      ) {
        loadState();
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    const offSys = watchSystemTheme((isDark) => {
      if (state.autsTheme === "system") applyTheme(isDark ? "dark" : "light");
    });
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.storage.onChanged.removeListener(storageListener);
      offSys();
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  const current = useMemo(() => {
    if (route.name === "details" || route.name === "editor") {
      const p = state.scripts.find((x) => x.id === (route as any).id);
      return p;
    }
    return undefined;
  }, [route, state.scripts]);

  const go = (hash: string) => {
    location.hash = hash;
  };

  const createInline = () => {
    const id = `script-${Date.now()}`;
    const p: Plugin = {
      id,
      name: "New Script",
      enabled: true,
      sourceType: "inline",
      inline: { content: "// console.log('hello');" },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = upsertScript(state.scripts, p);
    setState({ ...state, scripts: next });
    writeScripts(next).then(() => {
      // Broadcast state change to other extension contexts
      chrome.runtime.sendMessage({ type: "STATE_CHANGED", source: "options" });
    });
  };

  const createLocal = async () => {
    try {
      // 检查是否支持 File System Access API
      if ("showOpenFilePicker" in window) {
        await createLocalWithFileSystemAPI();
      } else {
        await createLocalWithFileAPI();
      }
    } catch (error) {
      console.error("创建本地插件失败:", error);
      toast.error("创建本地插件失败，请重试");
    }
  };

  const createFromUrl = async (payload: AddUrlPayload) => {
    const href = payload.href;
    let fetchedText = "";
    let etag: string | undefined;
    try {
      const resp = await fetch(href, { cache: "no-store" });
      if (resp.status === 200) {
        fetchedText = await resp.text();
        etag = resp.headers.get("ETag") || undefined;
      }
    } catch (e) {
      console.warn("[Options] Failed to fetch URL script:", href, e);
    }

    const meta = parseUserScriptMeta(fetchedText || "");

    // matches are parsed from metadata inside code; optional UI input no longer used
    void payload.matchesText;

    const id = `url-${Date.now()}`;
    const plugin: Plugin = {
      id,
      name: payload.name || meta.name || href.split("/").pop() || id,
      enabled: true,
      sourceType: "url",
      url: { href, etag },
      cache: fetchedText
        ? { code: fetchedText, etag, lastFetchedAt: Date.now() }
        : undefined,
      version: payload.version || meta.version,
      description: payload.description || meta.description,
      author: payload.author || meta.author,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const next = upsertScript(state.scripts, plugin);
    setState({ ...state, scripts: next });
    await writeScripts(next);
    chrome.runtime.sendMessage({ type: "STATE_CHANGED", source: "options" });
  };

  const createLocalWithFileSystemAPI = async () => {
    // 直接多文件选择，每个文件一个脚本
    const handles: any[] = await (window as any).showOpenFilePicker({
      multiple: true,
      types: [
        {
          description: "Scripts",
          accept: {
            "text/javascript": [".js", ".mjs", ".cjs"],
            "text/typescript": [".ts", ".tsx"],
            "application/json": [".json"],
            "text/plain": [".txt"],
          },
        },
      ],
    });

    if (!handles || handles.length === 0) return;

    const newPlugins: Plugin[] = [];

    for (let i = 0; i < handles.length; i++) {
      const handle = handles[i];
      const file = await handle.getFile();
      const content = await file.text();

      // 提取可选元数据
      let metadata: any = null;
      try {
        const metadataMatch = content.match(
          /const\s+metadata\s*=\s*({[\s\S]*?});/
        );
        if (metadataMatch) {
          metadata = eval("(" + metadataMatch[1] + ")");
        }
      } catch (e) {
        console.warn("Failed to parse metadata from file:", e);
      }

      const id = `local-${Date.now()}-${i}`;

      const plugin: Plugin = {
        id,
        name:
          metadata?.name ||
          file.name.replace(/\.(ts|tsx|js|jsx|mjs|cjs|json)$/i, ""),
        enabled: true,
        sourceType: "local",
        version: metadata?.version,
        description: metadata?.description,
        author: metadata?.author,
        local: {
          files: { [file.name]: content },
          entryFile: file.name,
          isDirectory: false,
          linkedPath: handle.name,
          isLinked: true,
          lastModified: file.lastModified,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveFileHandle(id, handle);
      newPlugins.push(plugin);
    }

    // 合并一次性写入
    const nextScripts = newPlugins.reduce(
      (acc, p) => upsertScript(acc, p),
      state.scripts
    );
    setState({ ...state, scripts: nextScripts });
    await writeScripts(nextScripts);
    chrome.runtime.sendMessage({ type: "STATE_CHANGED", source: "options" });
  };

  const createLocalWithFileAPI = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".ts,.tsx,.js,.jsx,.mjs,.cjs,.json,.txt";

    const files = await new Promise<FileList | null>((resolve) => {
      input.onchange = (e) => resolve((e.target as HTMLInputElement).files);
      input.click();
    });

    if (!files || files.length === 0) return;

    const newPlugins: Plugin[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const content = await file.text();

      let metadata: any = null;
      try {
        const metadataMatch = content.match(
          /const\s+metadata\s*=\s*({[\s\S]*?});/
        );
        if (metadataMatch) {
          metadata = eval("(" + metadataMatch[1] + ")");
        }
      } catch (e) {
        console.warn("Failed to parse metadata from file:", e);
      }

      const id = `local-${Date.now()}-${i}`;

      const plugin: Plugin = {
        id,
        name:
          metadata?.name ||
          file.name.replace(/\.(ts|tsx|js|jsx|mjs|cjs|json)$/i, ""),
        enabled: true,
        sourceType: "local",
        version: metadata?.version,
        description: metadata?.description,
        author: metadata?.author,
        local: {
          files: { [file.name]: content },
          entryFile: file.name,
          isDirectory: false,
          isLinked: false,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      newPlugins.push(plugin);
    }

    const nextScripts = newPlugins.reduce(
      (acc, p) => upsertScript(acc, p),
      state.scripts
    );
    setState({ ...state, scripts: nextScripts });
    await writeScripts(nextScripts);
    chrome.runtime.sendMessage({ type: "STATE_CHANGED", source: "options" });
  };

  const toggleScript = async (id: string, enabled: boolean) => {
    const p = state.scripts.find((x) => x.id === id);
    if (!p) return;

    // Check if this is a subscription script
    if (p.cache?.subscriptionId && p.server?.scriptId) {
      try {
        await toggleSubscriptionScript(
          p.cache.subscriptionId,
          p.server.scriptId
        );

        // Reload state to reflect changes
        const updatedState = await readState();
        setState(updatedState);
        chrome.runtime.sendMessage({
          type: "STATE_CHANGED",
          source: "options",
        });
        return;
      } catch (error) {
        console.error("Failed to toggle subscription script:", error);
        toast.error(
          `切换订阅脚本状态失败：${
            error instanceof Error ? error.message : "未知错误"
          }`
        );
        return;
      }
    }

    // Handle regular plugins
    const next = upsertScript(
      state.scripts.filter((s) => !s.cache?.subscriptionId),
      {
        ...p,
        enabled,
        updatedAt: Date.now(),
        createdAt: p.createdAt || Date.now(),
      }
    );
    setState({
      ...state,
      scripts: [
        ...next,
        ...state.scripts.filter((s) => s.cache?.subscriptionId),
      ],
    });
    writeScripts(next).then(() => {
      // Broadcast state change to other extension contexts
      chrome.runtime.sendMessage({ type: "STATE_CHANGED", source: "options" });
    });
  };

  const removeScript = async (id: string) => {
    const p = state.scripts.find((x) => x.id === id);
    if (!p) return;

    // Check if this is a subscription script
    if (p.cache?.subscriptionId) {
      // Subscription scripts should be toggled via the switch
      toast.info("订阅脚本请通过右上角开关进行启用/禁用");
      return;
    }

    // Handle regular plugins
    const regularScripts = state.scripts.filter(
      (s) => !s.cache?.subscriptionId
    );
    const next = removeScriptById(regularScripts, id);
    setState({
      ...state,
      scripts: [
        ...next,
        ...state.scripts.filter((s) => s.cache?.subscriptionId),
      ],
    });
    writeScripts(next).then(() => {
      // Broadcast state change to other extension contexts
      chrome.runtime.sendMessage({ type: "STATE_CHANGED", source: "options" });
    });
    go("/plugins");
  };

  const saveEdited = (nextPlugin: Plugin) => {
    const next = upsertScript(state.scripts, nextPlugin);
    setState({ ...state, scripts: next });
    writeScripts(next).then(() => {
      // Broadcast state change to other extension contexts
      chrome.runtime.sendMessage({ type: "STATE_CHANGED", source: "options" });
    });
    go(`/plugin/${encodeURIComponent(nextPlugin.id)}`);
  };

  const setEnabled = (next: boolean) => {
    setState({ ...state, autsEnabled: next });
    writeSync({ auts_enabled: next }).then(() => {
      // Broadcast state change to other extension contexts
      chrome.runtime.sendMessage({ type: "STATE_CHANGED", source: "options" });
    });
  };

  const setServer = (next: string) => {
    setState({ ...state, autsServer: next });
    writeSync({ auts_server: next });
  };

  const setTheme = (next: ThemeMode) => {
    setState({ ...state, autsTheme: next });
    writeSync({ auts_theme: next });
    applyTheme(next);
  };

  const setVisualIndicator = (next: boolean) => {
    setState({ ...state, autsVisualIndicator: next });
    writeSync({ auts_visual_indicator: next }).then(() => {
      // Broadcast state change to other extension contexts
      chrome.runtime.sendMessage({ type: "STATE_CHANGED", source: "options" });
    });
  };

  const refreshLocalPlugin = async (plugin: Plugin) => {
    if (plugin.sourceType !== "local" || !plugin.local?.isLinked) return;

    try {
      if (plugin.local.isDirectory) {
        // 刷新目录插件
        const handles = await getDirHandle(plugin.id);
        if (!handles) {
          toast.error("无法找到关联的目录，请重新关联");
          return;
        }

        const fileMap: { [path: string]: string } = {};
        const newFileHandles: { [path: string]: any } = {};
        await processDirectory(handles.dirHandle, "", fileMap, newFileHandles);

        const updatedPlugin: Plugin = {
          ...plugin,
          local: {
            ...plugin.local,
            files: fileMap,
            lastModified: Date.now(),
          },
          updatedAt: Date.now(),
        };

        const next = upsertScript(state.scripts, updatedPlugin);
        setState({ ...state, scripts: next });
        await writeScripts(next);
        chrome.runtime.sendMessage({
          type: "STATE_CHANGED",
          source: "options",
        });
      } else {
        // 刷新单文件插件
        const fileHandle = await getFileHandle(plugin.id);
        if (!fileHandle) {
          toast.error("无法找到关联的文件，请重新关联");
          return;
        }

        const file = await fileHandle.getFile();
        const content = await file.text();

        // 检查文件是否有变化
        if (
          plugin.local.lastModified &&
          file.lastModified <= plugin.local.lastModified
        ) {
          console.log("文件未变化，跳过更新");
          return;
        }

        const updatedPlugin: Plugin = {
          ...plugin,
          local: {
            ...plugin.local,
            files: { [plugin.local.entryFile]: content },
            lastModified: file.lastModified,
          },
          updatedAt: Date.now(),
        };

        const next = upsertScript(state.scripts, updatedPlugin);
        setState({ ...state, scripts: next });
        await writeScripts(next);
        chrome.runtime.sendMessage({
          type: "STATE_CHANGED",
          source: "options",
        });
      }

      console.log(`插件 ${plugin.name} 已刷新`);
    } catch (error) {
      console.error("刷新插件失败:", error);
      toast.error("刷新插件失败，可能文件已被移动或删除");
    }
  };

  const createFromSubscription = async (payload: AddSubscriptionPayload) => {
    try {
      await addSubscription(payload.subscriptionUrl, payload.name);

      // Reload state to show new subscription
      const updatedState = await readState();
      setState(updatedState);

      chrome.runtime.sendMessage({ type: "STATE_CHANGED", source: "options" });
      toast.success("订阅添加成功！");
    } catch (error) {
      console.error("Failed to add subscription:", error);
      toast.error(
        `添加订阅失败：${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  };

  const disableAll = () => {
    setEnabled(false);
  };

  const getBreadcrumb = () => {
    switch (route.name) {
      case "plugins":
        return [{ label: "插件管理", href: "#/plugins" }];
      case "subscriptions":
        return [{ label: "订阅管理", href: "#/subscriptions" }];
      case "settings":
        return [{ label: "系统设置", href: "#/settings" }];
      case "details":
        return [
          { label: "插件管理", href: "#/plugins" },
          { label: current?.name || current?.id || "详情", href: "" },
        ];
      case "editor":
        return [
          { label: "插件管理", href: "#/plugins" },
          {
            label: current?.name || current?.id || "编辑",
            href: current ? `#/plugin/${encodeURIComponent(current.id)}` : "",
          },
          { label: "代码编辑", href: "" },
        ];
      default:
        return [];
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-none items-center px-8">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Code2 className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Auts
              </h1>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-1">
              {getBreadcrumb().map((item, index, array) => (
                <div key={index} className="flex items-center gap-1">
                  {item.href ? (
                    <Button variant="ghost" size="sm" asChild className="h-8">
                      <a
                        href={item.href}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {item.label}
                      </a>
                    </Button>
                  ) : (
                    <span className="text-sm font-medium px-3 py-1">
                      {item.label}
                    </span>
                  )}
                  {index < array.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-4">
            {/* Global Status */}
            <div className="flex items-center gap-2 text-sm">
              <div
                className={`w-2 h-2 rounded-full ${
                  state.autsEnabled ? "bg-green-500" : "bg-gray-400"
                }`}
              />
              <span className="text-muted-foreground">
                {state.autsEnabled ? "自动注入已启用" : "自动注入已禁用"}
              </span>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              <Button
                variant={route.name === "plugins" ? "default" : "ghost"}
                size="sm"
                asChild
                className="gap-2"
              >
                <a href="#/plugins">
                  <Puzzle className="w-4 h-4" />
                  插件
                </a>
              </Button>
              <Button
                variant={route.name === "subscriptions" ? "default" : "ghost"}
                size="sm"
                asChild
                className="gap-2"
              >
                <a href="#/subscriptions">
                  <Server className="w-4 h-4" />
                  订阅
                </a>
              </Button>
              <Button
                variant={route.name === "settings" ? "default" : "ghost"}
                size="sm"
                asChild
                className="gap-2"
              >
                <a href="#/settings">
                  <SettingsIcon className="w-4 h-4" />
                  设置
                </a>
              </Button>
            </nav>

            {/* External Links */}
            <div className="flex items-center gap-1 ml-2 pl-2 border-l">
              <Button variant="ghost" size="sm" className="gap-2" asChild>
                <a
                  href="https://github.com/sichang824/auts-chrome.git"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="查看源码"
                >
                  <Github className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-none p-8">
        {route.name === "plugins" && (
          <PluginsPage
            scripts={state.scripts}
            onToggle={toggleScript}
            onRemove={removeScript}
            onCreate={createInline}
            onCreateLocal={createLocal}
            onOpenCreateUrl={() => setOpenAddUrl(true)}
            onOpenCreateServer={() => setOpenAddServer(true)}
            onRefreshLocal={refreshLocalPlugin}
            serverBase={state.autsServer}
          />
        )}
        {route.name === "subscriptions" && (
          <SubscriptionsPage
            serverBase={state.autsServer}
            onBack={() => go("/plugins")}
          />
        )}
        {route.name === "details" && (
          <DetailsPage
            plugin={current}
            serverBase={state.autsServer}
            onBack={() => go("/plugins")}
            onToggle={(v) => current && toggleScript(current.id, v)}
            onRemove={() => current && removeScript(current.id)}
          />
        )}
        {route.name === "editor" && (
          <EditorPage
            plugin={current}
            onSave={saveEdited}
            onBack={() =>
              current
                ? go(`/plugin/${encodeURIComponent(current.id)}`)
                : go("/plugins")
            }
          />
        )}
        {route.name === "settings" && (
          <SettingsPage
            autsEnabled={state.autsEnabled}
            autsServer={state.autsServer}
            autsTheme={state.autsTheme}
            autsVisualIndicator={state.autsVisualIndicator}
            onChangeEnabled={setEnabled}
            onChangeServer={setServer}
            onChangeTheme={setTheme}
            onChangeVisualIndicator={setVisualIndicator}
            onDisableAll={disableAll}
          />
        )}
      </main>
      <Toaster richColors closeButton position="bottom-right" />
      {/* Create URL Dialog */}
      <AddUrlDialog
        open={openAddUrl}
        onOpenChange={setOpenAddUrl}
        onSubmit={createFromUrl}
      />

      {/* Create Server Dialog */}
      <AddServerDialog
        open={openAddServer}
        serverBase={state.autsServer}
        onOpenChange={setOpenAddServer}
        onSubmit={createFromSubscription}
      />

      {/* Footer */}
      <footer className="border-t bg-background/95 backdrop-blur">
        <div className="container max-w-none px-8 py-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>© 2025 Auts - 用户脚本管理器</span>
              <span>•</span>
              <span>{state.scripts.length} 个插件</span>
              <span>•</span>
              <span>
                {state.scripts.filter((s) => s.enabled).length} 个已启用
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://docs.auts.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                文档
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://github.com/anthropics/auts/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                反馈问题
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<OptionsApp />);
