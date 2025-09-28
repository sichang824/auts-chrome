// Centralized AUTS type definitions

export type ThemeMode = "system" | "light" | "dark";

export type SourceType = "inline" | "url" | "server" | "local";

export interface UserscriptMeta {
  matches: string[];
  excludes: string[];
  grants?: string[];
  requires?: string[];
  name?: string;
  version?: string;
  description?: string;
  author?: string;
}

export type ScriptOrigin =
  | { type: "plugin"; pluginId: string }
  | { type: "subscription"; subscriptionId: string; serverScriptId: string };

export interface UserScript {
  id: string;
  name: string;
  enabled: boolean;
  sourceType: SourceType;
  code: string;
  metadata: UserscriptMeta;
  origin: ScriptOrigin;

  // Optional presentation / maintenance fields
  borderColor?: string;
  homepageUrl?: string;
  iconUrl?: string;
  createdAt?: number;
  updatedAt?: number;

  // Optional source descriptors for maintenance
  inline?: { content: string };
  url?: { href: string; etag?: string } | string;
  server?: { scriptId: string; licenseKey?: string };
  local?: {
    files?: { [path: string]: string };
    entryFile: string;
    isDirectory: boolean;
    linkedPath?: string;
    isLinked?: boolean;
    lastModified?: number;
  };
  cache?: {
    version?: string;
    etag?: string;
    sha256?: string;
    signature?: string;
    lastFetchedAt?: number;
    expiresAt?: number;
    // Cached code for URL plugins to allow offline fallback
    code?: string;
    // For subscription scripts
    subscriptionId?: string;
    subscriptionName?: string;
    serverBase?: string;
  };
}

// Backward-compatible persisted plugin shape (kept for Options UI storage)
export interface AutsPlugin {
  id: string;
  name: string;
  enabled: boolean;
  sourceType: SourceType;
  createdAt?: number;
  updatedAt?: number;
  version?: string;
  description?: string;
  author?: string;
  homepageUrl?: string;
  iconUrl?: string;
  borderColor?: string;
  // Deprecated: matches/excludes should live in metadata parsed from code
  matches?: string[];
  excludes?: string[];
  inline?: { content: string };
  local?: { entryFile: string; files: Record<string, string>; isDirectory?: boolean; isLinked?: boolean; linkedPath?: string; lastModified?: number };
  url?: { href: string; etag?: string } | string;
  server?: { scriptId: string; licenseKey?: string };
  cache?: {
    version?: string;
    etag?: string;
    sha256?: string;
    signature?: string;
    lastFetchedAt?: number;
    expiresAt?: number;
    code?: string;
    subscriptionId?: string;
    subscriptionName?: string;
    serverBase?: string;
  };
}

// Server subscription types
export interface ServerSubscription {
  id: string;
  name: string;
  enabled: boolean;
  serverBase: string;
  licenseKey: string;
  lastUpdated?: number;
  scripts: ServerScript[];
}

export interface ServerScript {
  id: string;
  version: string;
  code: string;
  enabled: boolean;
  licenseKey?: string;
}

