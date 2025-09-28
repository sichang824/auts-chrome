import type { UserScript } from "./types";

export async function isVisualIndicatorEnabled(): Promise<boolean> {
  try {
    const data = await chrome.storage.sync.get({
      auts_visual_indicator: false,
    });
    return Boolean(
      (data as { auts_visual_indicator: unknown }).auts_visual_indicator
    );
  } catch (_e) {
    return false;
  }
}

export function computeIndicatorId(scriptId: string): string {
  return `userscript_${scriptId}_indicator`;
}

export async function registerIndicatorForScript(
  script: UserScript
): Promise<void> {
  try {
    const indicatorId = computeIndicatorId(script.id);
    const code = getIndicatorCode();
    // eslint-disable-next-line no-console
    console.log("[Indicator] Registering for:", script.name, {
      matches: script.metadata.matches,
      excludes: script.metadata.excludes || [],
    });
    await chrome.userScripts.register([
      {
        id: indicatorId,
        matches: script.metadata.matches,
        excludeMatches: script.metadata.excludes || [],
        js: [{ code }],
        runAt: "document_idle",
        // For chrome.userScripts, valid worlds are MAIN and USER_SCRIPT
        world: "USER_SCRIPT" as unknown as chrome.userScripts.ExecutionWorld,
      },
    ]);
    // eslint-disable-next-line no-console
    console.log("[Indicator] Registered:", indicatorId);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("Failed to register indicator for", script.name, e);
  }
}

export async function unregisterIndicatorForScript(
  scriptId: string
): Promise<void> {
  try {
    const id = computeIndicatorId(scriptId);
    await chrome.userScripts.unregister({ ids: [id] });
  } catch {
    // ignore
  }
}

export async function performEmergencyStop(): Promise<void> {
  await chrome.storage.sync.set({ auts_enabled: false });
  // eslint-disable-next-line no-console
  console.log(
    "[Indicator] Emergency stop triggered: disabling AUTS and reloading tab"
  );
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs && tabs[0];
  if (tab?.id) {
    await chrome.tabs.reload(tab.id);
  }
}

function getIndicatorCode(): string {
  return `
(() => {
  const BORDER_ID = '__auts_visual_border__';
  const BTN_ID = '__auts_emergency_stop__';
  if (document.getElementById(BORDER_ID)) return;
  const border = document.createElement('div');
  border.id = BORDER_ID;
  Object.assign(border.style, {
      position: 'fixed',
      inset: '0',
      border: '4px solid #10B981',
      pointerEvents: 'none',
      zIndex: '2147483646',
      boxSizing: 'border-box'
  });
  document.documentElement.appendChild(border);

  const btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.textContent = 'Emergency Stop';
  Object.assign(btn.style, {
      position: 'fixed',
      top: '10px',
      right: '10px',
      zIndex: '2147483647',
      padding: '8px 10px',
      background: '#EF4444',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system',
      fontSize: '12px',
      cursor: 'pointer',
      boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
  });
  btn.addEventListener('click', () => {
      try {
      console.log('[Indicator] Emergency Stop clicked');
      window.postMessage({ type: 'AUTS_EMERGENCY_STOP' }, '*');
      btn.textContent = 'Stopping...';
      } catch (e) {
      console.warn('[Indicator] sendMessage failed, fallback to storage.set', e);
      chrome.storage.sync.set({ auts_enabled: false });
      }
  });
  document.documentElement.appendChild(btn);
})();
`;
}
