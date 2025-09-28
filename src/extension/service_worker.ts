// Service worker for userscript manager (TypeScript)
import {
  addScript,
  deleteScript,
  getAllScripts,
  toggleScript as toggleScriptStorage,
  updateScript,
} from "./script_storage";
import type { UserScript } from "./script_storage";
import { urlMatches } from "../lib/url_matcher";
import { buildJsSourcesFromUserScript } from "../lib/userscript_loader";
import {
  isVisualIndicatorEnabled,
  registerIndicatorForScript,
  unregisterIndicatorForScript,
  performEmergencyStop,
} from "./visual_indicator";

// Track registered userscripts
const registeredScripts: Map<string, string> = new Map();

// Read global AUTS enabled flag from sync storage
async function isAutsEnabled(): Promise<boolean> {
  try {
    const data = await chrome.storage.sync.get({ auts_enabled: true });
    return Boolean((data as { auts_enabled: unknown }).auts_enabled);
  } catch (_e) {
    return true;
  }
}

let registering = false;
let pendingRegister = false;

// Listen for extension installation
chrome.runtime.onInstalled.addListener(async () => {
  // eslint-disable-next-line no-console
  console.log("Userscript Manager installed");
  await registerAllUserScripts();
  await initializeBadge();
});

// Listen for extension startup
chrome.runtime.onStartup.addListener(async () => {
  await registerAllUserScripts();
  await initializeBadge();
});

// Re-register when scripts or global switch change
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (
    areaName === "local" &&
    (changes.auts_scripts || changes.auts_subscriptions)
  ) {
    registerAllUserScripts();
    // Update badge for active tab when scripts change
    void updateBadgeForActiveTab();
  }
  if (
    areaName === "sync" &&
    (changes.auts_enabled || changes.auts_visual_indicator)
  ) {
    registerAllUserScripts();
    void updateBadgeForActiveTab();
  }
});

// Listen for messages from popup/options pages
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  type Send = (response?: unknown) => void;
  switch (
    message.type as
      | "GET_SCRIPTS"
      | "ADD_SCRIPT"
      | "UPDATE_SCRIPT"
      | "DELETE_SCRIPT"
      | "TOGGLE_SCRIPT"
      | "RELOAD_SCRIPTS"
      | "CHECK_USER_SCRIPTS_API"
      | "STATE_CHANGED"
      | "EMERGENCY_STOP"
  ) {
    case "GET_SCRIPTS":
      handleGetScripts(sendResponse as Send);
      return true;
    case "ADD_SCRIPT":
      handleAddScript(
        message.script as Partial<UserScript> & {
          name: string;
          matches: string[];
          code: string;
        },
        sendResponse as Send
      );
      return true;
    case "UPDATE_SCRIPT":
      handleUpdateScript(
        message.id as string,
        message.script as Partial<UserScript>,
        sendResponse as Send
      );
      return true;
    case "DELETE_SCRIPT":
      handleDeleteScript(message.id as string, sendResponse as Send);
      return true;
    case "TOGGLE_SCRIPT":
      handleToggleScript(message.id as string, sendResponse as Send);
      return true;
    case "RELOAD_SCRIPTS":
      handleReloadScripts(sendResponse as Send);
      return true;
    case "CHECK_USER_SCRIPTS_API":
      handleCheckUserScriptsAPI(sendResponse as Send);
      return true;
    case "EMERGENCY_STOP":
      // eslint-disable-next-line no-console
      console.log("[BG] Received EMERGENCY_STOP");
      handleEmergencyStop(sendResponse as Send);
      return true;
    case "STATE_CHANGED":
      // Keep badge in sync and proactively re-register to avoid stale injections
      registerAllUserScripts();
      void updateBadgeForActiveTab();
      sendResponse?.({ ok: true });
      return true;
  }
});

/**
 * Register all user scripts with chrome.userScripts API
 */
async function registerAllUserScripts(): Promise<void> {
  try {
    if (registering) {
      pendingRegister = true;
      return;
    }
    registering = true;
    await chrome.userScripts.unregister();
    registeredScripts.clear();

    const enabled = await isAutsEnabled();
    const indicatorEnabled = await isVisualIndicatorEnabled();
    // eslint-disable-next-line no-console
    console.log(
      "[Register] auts_enabled:",
      enabled,
      "visual_indicator:",
      indicatorEnabled
    );
    if (!enabled) {
      // eslint-disable-next-line no-console
      console.log("AUTS disabled, no userscripts registered");
      return;
    }

    const scripts = await getAllScripts();
    for (const script of scripts) {
      if (script.enabled && script.matches && script.matches.length > 0) {
        await registerUserScript(script, indicatorEnabled);
      }
    }
    // eslint-disable-next-line no-console
    console.log(`Registered ${registeredScripts.size} userscripts`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error registering userscripts:", error);
  } finally {
    registering = false;
    if (pendingRegister) {
      pendingRegister = false;
      // debounce microtask
      setTimeout(() => {
        void registerAllUserScripts();
      }, 0);
    }
  }
}

/**
 * Register a single user script
 */
async function registerUserScript(
  script: UserScript,
  indicatorEnabled?: boolean
): Promise<void> {
  try {
    const scriptId = `userscript_${script.id}`;

    const jsSources = await buildJsSourcesFromUserScript(script.code);

    await chrome.userScripts.register([
      {
        id: scriptId,
        matches: script.matches,
        excludeMatches: script.excludes || [],
        js: jsSources,
        runAt: "document_idle",
        // Cast to the enum because TS type expects ExecutionWorld enum
        world: "MAIN" as unknown as chrome.userScripts.ExecutionWorld,
      },
    ]);

    registeredScripts.set(script.id, scriptId);
    // eslint-disable-next-line no-console
    console.log(`Registered userscript: ${script.name}`);
    // eslint-disable-next-line no-console
    console.log(
      "  matches:",
      script.matches,
      "excludes:",
      script.excludes || []
    );

    // Optionally register visual indicator script in isolated world
    if (indicatorEnabled) {
      await registerIndicatorForScript(script);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to register userscript ${script.name}:`, error);
  }
}

/**
 * Unregister a user script
 */
async function unregisterUserScript(scriptId: string): Promise<void> {
  try {
    const registeredId = registeredScripts.get(scriptId);
    if (registeredId) {
      await chrome.userScripts.unregister({ ids: [registeredId] });
      await unregisterIndicatorForScript(scriptId);
      registeredScripts.delete(scriptId);
      // eslint-disable-next-line no-console
      console.log(`Unregistered userscript: ${scriptId}`);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to unregister userscript ${scriptId}:`, error);
  }
}

// Message handlers
async function handleGetScripts(
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    const scripts = await getAllScripts();
    sendResponse({ success: true, scripts });
  } catch (error) {
    sendResponse({ success: false, error: (error as Error).message });
  }
}

async function handleAddScript(
  script: Partial<UserScript> & {
    name: string;
    matches: string[];
    code: string;
  },
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    const newScript = await addScript(script);
    await registerAllUserScripts();
    await updateBadgeForActiveTab();
    sendResponse({ success: true, script: newScript });
  } catch (error) {
    sendResponse({ success: false, error: (error as Error).message });
  }
}

async function handleUpdateScript(
  id: string,
  script: Partial<UserScript>,
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    await unregisterUserScript(id);
    const updatedScript = await updateScript(id, script);
    if (updatedScript && updatedScript.enabled) {
      await registerUserScript(updatedScript);
    }
    await updateBadgeForActiveTab();
    sendResponse({ success: true, script: updatedScript });
  } catch (error) {
    sendResponse({ success: false, error: (error as Error).message });
  }
}

async function handleDeleteScript(
  id: string,
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    await unregisterUserScript(id);
    await deleteScript(id);
    await updateBadgeForActiveTab();
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: (error as Error).message });
  }
}

async function handleToggleScript(
  id: string,
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    const script = await toggleScriptStorage(id);
    if (script) {
      if (script.enabled) {
        await registerUserScript(script);
      } else {
        await unregisterUserScript(id);
      }
    }
    await updateBadgeForActiveTab();
    sendResponse({ success: true, script });
  } catch (error) {
    sendResponse({ success: false, error: (error as Error).message });
  }
}

async function handleReloadScripts(
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    await registerAllUserScripts();
    await updateBadgeForActiveTab();
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: (error as Error).message });
  }
}

// Only support chrome.userScripts path; expose a simple availability check for UI
async function handleCheckUserScriptsAPI(
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    const available =
      typeof chrome.userScripts !== "undefined" &&
      typeof chrome.userScripts.register === "function";
    sendResponse({ available });
  } catch (error) {
    sendResponse({ available: false, error: (error as Error).message });
  }
}

async function handleEmergencyStop(
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    // eslint-disable-next-line no-console
    console.log("[BG] EMERGENCY_STOP begin");
    await performEmergencyStop();
    await registerAllUserScripts();
    // eslint-disable-next-line no-console
    console.log("[BG] EMERGENCY_STOP done");
    sendResponse({ success: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[BG] EMERGENCY_STOP failed", error);
    sendResponse({ success: false, error: (error as Error).message });
  }
}

// ------------------------- Badge helpers -------------------------

async function initializeBadge(): Promise<void> {
  try {
    await chrome.action.setBadgeBackgroundColor({ color: "#EF4444" }); // red-500
  } catch {
    // ignore
  }
  try {
    await chrome.action.setBadgeTextColor({ color: "#FFFFFF" }); // white text
  } catch {
    // ignore
  }
  await updateBadgeForActiveTab();
}

async function updateBadgeForActiveTab(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs && tabs[0];
    if (!tab || typeof tab.id !== "number") return;
    const url = tab.url || "";
    const count = await countEnabledMatchingForUrl(url);
    await chrome.action.setBadgeText({
      tabId: tab.id,
      text: count > 0 ? String(count) : "",
    });
  } catch {
    // ignore
  }
}

async function countEnabledMatchingForUrl(url: string): Promise<number> {
  const enabled = await isAutsEnabled();
  if (!enabled) return 0;
  try {
    const scripts = await getAllScripts();
    const matching = scripts.filter(
      (s) => s.enabled && urlMatches(url, s.matches, s.excludes)
    );
    return matching.length;
  } catch {
    return 0;
  }
}

// Update when tab changes
chrome.tabs.onActivated.addListener(() => {
  void updateBadgeForActiveTab();
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    void updateBadgeForActiveTab();
  }
});
