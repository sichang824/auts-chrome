export const SOURCE = {
  INLINE: 'inline',
  URL: 'url',
  SERVER: 'server',
} as const;

export const SYNC_KEYS = {
  ENABLED: 'auts_enabled',
  SERVER: 'auts_server',
  VISUAL_INDICATOR: 'auts_visual_indicator',
} as const;

export const LOCAL_KEYS = {
  SCRIPTS: 'auts_scripts',
  SUBSCRIPTIONS: 'auts_subscriptions',
} as const;

export type SourceType = typeof SOURCE[keyof typeof SOURCE];

export interface Script {
  id?: string;
  name?: string;
  enabled?: boolean;
  sourceType?: SourceType;
  matches?: string[];
  borderColor?: string; // Visual indicator border color
  inline?: {
    content?: string;
  };
  url?: {
    href?: string;
  } | string;
  server?: {
    scriptId?: string;
    licenseKey?: string;
  };
}

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

export interface Settings {
  enabled: boolean;
  serverBase?: string;
  scripts: Script[];
  subscriptions?: ServerSubscription[];
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