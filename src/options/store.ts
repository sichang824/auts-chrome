export type ThemeMode = "system" | "light" | "dark";

export type SourceType = "inline" | "url" | "server" | "local";

export type Plugin = {
  id: string;
  name: string;
  enabled: boolean;
  sourceType: SourceType;
  version?: string;
  description?: string;
  author?: string;
  createdAt?: number;
  updatedAt?: number;
  homepageUrl?: string;
  iconUrl?: string;
  matches?: string[];
  borderColor?: string; // Visual indicator border color
  inline?: { content: string };
  url?: { href: string; etag?: string } | string;
  server?: { scriptId: string; licenseKey?: string };
  local?: {
    // 方式1: 上传模式（原有）
    files?: { [path: string]: string }; // 文件路径 -> 文件内容
    entryFile: string; // 入口文件路径，如 "auts.tsx"
    isDirectory: boolean; // 是否为目录模式

    // 方式2: 关联模式（新增）
    linkedPath?: string; // 关联的本地文件/目录路径
    isLinked?: boolean; // 是否为关联模式
    lastModified?: number; // 最后修改时间，用于检测文件变化
  };
  cache?: {
    version?: string;
    etag?: string;
    sha256?: string;
    signature?: string;
    lastFetchedAt?: number;
    expiresAt?: number;
    // For subscription scripts
    subscriptionId?: string;
    subscriptionName?: string;
    serverBase?: string;
  };
};

export type AutsState = {
  autsEnabled: boolean;
  autsServer?: string;
  autsTheme: ThemeMode;
  autsVisualIndicator?: boolean;
  scripts: Plugin[];
  subscriptions?: any[]; // Will be loaded from subscription storage
};

const SYNC_DEFAULTS = {
  auts_enabled: true as boolean,
  auts_server: undefined as string | undefined,
  auts_theme: "system" as ThemeMode,
  auts_visual_indicator: false as boolean,
};

const LOCAL_DEFAULTS = {
  auts_scripts: [] as Plugin[],
};

export async function readState(): Promise<AutsState> {
  const sync = await new Promise<any>((resolve) =>
    chrome.storage.sync.get(SYNC_DEFAULTS, (d) => resolve(d))
  );
  const local = await new Promise<any>((resolve) =>
    chrome.storage.local.get(
      { ...LOCAL_DEFAULTS, auts_subscriptions: [] },
      (d) => resolve(d)
    )
  );

  // Get local plugins
  const localScripts = Array.isArray(local.auts_scripts)
    ? (local.auts_scripts as Plugin[])
    : [];

  // Get subscription scripts and convert to plugins
  const subscriptions = Array.isArray(local.auts_subscriptions)
    ? local.auts_subscriptions
    : [];
  const subscriptionPlugins = convertSubscriptionsToPlugins(subscriptions);

  // Combine all scripts
  const allScripts = [...localScripts, ...subscriptionPlugins];

  return {
    autsEnabled: Boolean(sync.auts_enabled),
    autsServer: sync.auts_server,
    autsTheme: (sync.auts_theme as ThemeMode) || "system",
    autsVisualIndicator: Boolean(sync.auts_visual_indicator),
    scripts: allScripts,
    subscriptions: subscriptions,
  };
}

export async function writeSync(
  patch: Partial<{
    auts_enabled: boolean;
    auts_server?: string;
    auts_theme: ThemeMode;
    auts_visual_indicator: boolean;
  }>
): Promise<void> {
  await new Promise<void>((resolve) =>
    chrome.storage.sync.set(patch, () => resolve())
  );
}

export async function writeScripts(next: Plugin[]): Promise<void> {
  await new Promise<void>((resolve) =>
    chrome.storage.local.set({ auts_scripts: next }, () => resolve())
  );
}

export function upsertScript(list: Plugin[], plugin: Plugin): Plugin[] {
  const index = list.findIndex((p) => p.id === plugin.id);
  if (index === -1) return list.concat(plugin);
  const next = list.slice();
  next[index] = plugin;
  return next;
}

export function removeScriptById(list: Plugin[], id: string): Plugin[] {
  return list.filter((p) => p.id !== id);
}

export function sortByUpdatedAtDesc(list: Plugin[]): Plugin[] {
  return list.slice().sort((a, b) => {
    const ta = a.updatedAt || a.createdAt || 0;
    const tb = b.updatedAt || b.createdAt || 0;
    return tb - ta;
  });
}

export function nowMs(): number {
  return Date.now();
}

function convertSubscriptionsToPlugins(subscriptions: any[]): Plugin[] {
  const plugins: Plugin[] = [];

  for (const subscription of subscriptions) {
    if (!subscription.enabled || !Array.isArray(subscription.scripts)) continue;

    for (const script of subscription.scripts) {
      // Show all scripts (enabled and disabled) from active subscriptions
      const plugin: Plugin = {
        id: `subscription_${subscription.id}_${script.id}`,
        name: script.id, // Will be parsed from script metadata if available
        enabled: script.enabled,
        sourceType: "server" as SourceType,
        version: script.version,
        createdAt: subscription.lastUpdated || Date.now(),
        updatedAt: subscription.lastUpdated || Date.now(),
        server: {
          scriptId: script.id,
          licenseKey: subscription.licenseKey,
        },
        // Store subscription info for management
        cache: {
          subscriptionId: subscription.id,
          subscriptionName: subscription.name,
          serverBase: subscription.serverBase,
        },
      };

      plugins.push(plugin);
    }
  }

  return plugins;
}
