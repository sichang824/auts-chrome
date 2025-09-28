export const SOURCE = {
  INLINE: "inline",
  URL: "url",
  SERVER: "server",
} as const;

export const SYNC_KEYS = {
  ENABLED: "auts_enabled",
  SERVER: "auts_server",
  VISUAL_INDICATOR: "auts_visual_indicator",
} as const;

export const LOCAL_KEYS = {
  SCRIPTS: "auts_scripts",
  SUBSCRIPTIONS: "auts_subscriptions",
} as const;

export type SourceType = (typeof SOURCE)[keyof typeof SOURCE];

// Keep Settings keys here; detailed types moved to extension/types
export interface Settings {
  enabled: boolean;
  serverBase?: string;
  // Using any to avoid circular deps between lib and extension
  scripts: any[];
  subscriptions?: any[];
  visualIndicator?: boolean; // Show visual border indicator when scripts run
}

export interface ServerPackage {
  codeText: string;
  meta: {
    codeBase64?: string;
    code?: string;
    [key: string]: any;
  };
}
