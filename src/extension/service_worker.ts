// Service worker for userscript manager (TypeScript)
import {
  addScript,
  deleteScript,
  getAllScripts,
  getAllAutsPlugins,
  toggleScript as toggleScriptStorage,
  updateScript,
} from "./script_storage";
import { refreshUrlPluginsAuto } from "./plugin_updater";
import type { UserScript } from "./types";
import { urlMatches } from "../lib/url_matcher";
import { buildJsSourcesFromUserScript } from "../lib/userscript_loader";
import {
  isVisualIndicatorEnabled,
  registerIndicatorForScript,
  unregisterIndicatorForScript,
  performEmergencyStop,
} from "./visual_indicator";
import { refreshAllSubscriptionsAuto } from "./subscription_storage";

// Track registered userscripts
const registeredScripts: Map<string, string> = new Map();
const registeredBridgeNonces: Map<string, string> = new Map();
const pendingNetworkRequests: Map<string, AbortController> = new Map();
const BRIDGE_NONCES_STORAGE_KEY = "auts_bridge_nonces";
let bridgeNoncesHydrated = false;

interface SerializedRequestBody {
  kind: "text" | "json" | "base64" | "form-data";
  value: string | [string, string][];
  contentType?: string;
}

interface GmXmlHttpRequestDetails {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  responseType?: string;
  timeout?: number;
  anonymous?: boolean;
  data?: SerializedRequestBody;
}

interface GmXmlHttpRequestMessage {
  type: "GM_XMLHTTP_REQUEST";
  scriptId: string;
  nonce: string;
  requestId: string;
  pageUrl?: string;
  details: GmXmlHttpRequestDetails;
}

type GmXmlHttpProgressMessage = {
  kind: "progress" | "load" | "error" | "abort" | "timeout";
  payload: Record<string, unknown>;
};

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
let autoRefreshing = false;

// Avoid reacting to our own automatic refresh writes to prevent loops
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (autoRefreshing) return;
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
    (changes.auts_enabled || changes.auts_visual_indicator || changes.auts_auto_update)
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
        | "GM_XMLHTTP_REQUEST"
        | "GM_XMLHTTP_ABORT"
  ) {
    case "GET_SCRIPTS":
      handleGetScripts(sendResponse as Send);
      return true;
    case "ADD_SCRIPT":
      handleAddScript(
        message.script as Partial<UserScript> & {
          name: string;
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
    case "GM_XMLHTTP_REQUEST":
      handleGmXmlHttpRequest(message as GmXmlHttpRequestMessage, sendResponse as Send);
      return true;
    case "GM_XMLHTTP_ABORT":
      handleGmXmlHttpAbort(
        message.requestId as string,
        message.scriptId as string,
        message.nonce as string,
        sendResponse as Send
      );
      return true;
    case "STATE_CHANGED":
      // Keep badge in sync and proactively re-register to avoid stale injections
      registerAllUserScripts();
      void updateBadgeForActiveTab();
      sendResponse?.({ ok: true });
      return true;
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (!port.name.startsWith("AUTS_GM_XMLHTTP:")) return;

  port.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") return;
    if (message.type === "GM_XMLHTTP_REQUEST") {
      void handleGmXmlHttpRequestViaPort(message as GmXmlHttpRequestMessage, port);
      return;
    }
    if (message.type === "GM_XMLHTTP_ABORT") {
      void handleGmXmlHttpAbortViaPort(
        String(message.requestId || ""),
        String(message.scriptId || ""),
        String(message.nonce || ""),
        port
      );
    }
  });
});

/**
 * Register all user scripts with chrome.userScripts API
 */
async function registerAllUserScripts(): Promise<void> {
  try {
    await hydrateBridgeNonces();
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
      registeredBridgeNonces.clear();
      await persistBridgeNonces();
      // eslint-disable-next-line no-console
      console.log("AUTS disabled, no userscripts registered");
      return;
    }

    const scripts = await getAllScripts();
    const activeScriptIds = new Set<string>();
    for (const script of scripts) {
      if (script.enabled && script.metadata?.matches && script.metadata.matches.length > 0) {
        activeScriptIds.add(script.id);
        await registerUserScript(script, indicatorEnabled);
      }
    }
    pruneBridgeNonces(activeScriptIds);
    await persistBridgeNonces();
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
    const bridgeNonce = await getOrCreateBridgeNonce(script.id);

    const jsSources = await buildJsSourcesFromUserScript(script, bridgeNonce);

    await chrome.userScripts.register([
      {
        id: scriptId,
        matches: script.metadata.matches,
        excludeMatches: script.metadata.excludes || [],
        js: jsSources,
        runAt: "document_idle",
        // Cast to the enum because TS type expects ExecutionWorld enum
        world: "MAIN" as unknown as chrome.userScripts.ExecutionWorld,
      },
    ]);

    registeredScripts.set(script.id, scriptId);
    await rememberBridgeNonce(script.id, bridgeNonce);
    // eslint-disable-next-line no-console
    console.log(`Registered userscript: ${script.name}`);
    // eslint-disable-next-line no-console
    console.log(
      "  matches:",
      script.metadata.matches,
      "excludes:",
      script.metadata.excludes || []
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
    await hydrateBridgeNonces();
    const registeredId = registeredScripts.get(scriptId);
    if (registeredId) {
      await chrome.userScripts.unregister({ ids: [registeredId] });
      await unregisterIndicatorForScript(scriptId);
      registeredScripts.delete(scriptId);
      registeredBridgeNonces.delete(scriptId);
      await persistBridgeNonces();
      // eslint-disable-next-line no-console
      console.log(`Unregistered userscript: ${scriptId}`);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to unregister userscript ${scriptId}:`, error);
  }
}

async function rememberBridgeNonce(scriptId: string, nonce: string): Promise<void> {
  await hydrateBridgeNonces();
  registeredBridgeNonces.set(scriptId, nonce);
  await persistBridgeNonces();
}

async function hasValidBridgeNonce(scriptId: string, nonce: string): Promise<boolean> {
  await hydrateBridgeNonces();
  const validNonce = registeredBridgeNonces.get(scriptId);
  return Boolean(validNonce && validNonce === nonce);
}

async function getOrCreateBridgeNonce(scriptId: string): Promise<string> {
  await hydrateBridgeNonces();
  const existing = registeredBridgeNonces.get(scriptId);
  if (existing) return existing;
  const nonce = crypto.randomUUID();
  registeredBridgeNonces.set(scriptId, nonce);
  await persistBridgeNonces();
  return nonce;
}

function pruneBridgeNonces(activeScriptIds: Set<string>): void {
  for (const scriptId of registeredBridgeNonces.keys()) {
    if (!activeScriptIds.has(scriptId)) {
      registeredBridgeNonces.delete(scriptId);
    }
  }
}

async function hydrateBridgeNonces(): Promise<void> {
  if (bridgeNoncesHydrated) return;
  bridgeNoncesHydrated = true;
  try {
    if (!chrome.storage?.session) return;
    const data = await chrome.storage.session.get(BRIDGE_NONCES_STORAGE_KEY);
    const raw = data[BRIDGE_NONCES_STORAGE_KEY];
    if (!raw || typeof raw !== "object") return;
    for (const [scriptId, values] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof values === "string" && values.length > 0) {
        registeredBridgeNonces.set(scriptId, values);
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[AUTS background] Failed to hydrate bridge nonces", error);
  }
}

async function persistBridgeNonces(): Promise<void> {
  try {
    if (!chrome.storage?.session) return;
    const serialized: Record<string, string> = {};
    for (const [scriptId, values] of registeredBridgeNonces.entries()) {
      if (values) {
        serialized[scriptId] = values;
      }
    }
    await chrome.storage.session.set({ [BRIDGE_NONCES_STORAGE_KEY]: serialized });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[AUTS background] Failed to persist bridge nonces", error);
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

async function handleGmXmlHttpRequest(
  message: GmXmlHttpRequestMessage,
  sendResponse: (response: unknown) => void
): Promise<void> {
  let settled = false;
  const emit = (response: GmXmlHttpProgressMessage): void => {
    if (response.kind === "progress") return;
    if (settled) return;
    settled = true;
    sendResponse(response);
  };

  await executeGmXmlHttpRequest(message, emit, false);
}

async function handleGmXmlHttpRequestViaPort(
  message: GmXmlHttpRequestMessage,
  port: chrome.runtime.Port
): Promise<void> {
  await executeGmXmlHttpRequest(message, (response) => {
    try {
      port.postMessage(response);
    } catch {
      // ignore port errors
    }
  }, true);
}

async function executeGmXmlHttpRequest(
  message: GmXmlHttpRequestMessage,
  emit: (response: GmXmlHttpProgressMessage) => void,
  allowProgress: boolean
): Promise<void> {
  const { scriptId, nonce, requestId, details, pageUrl } = message;
  const finalUrl = typeof details?.url === "string" ? details.url : "";

  try {
    if (!scriptId || !requestId || !finalUrl) {
      throw new Error("Invalid GM_xmlhttpRequest payload");
    }

    if (!(await hasValidBridgeNonce(scriptId, nonce))) {
      throw new Error("Invalid GM bridge nonce");
    }

    const scripts = await getAllScripts();
    const script = scripts.find((candidate) => candidate.id === scriptId && candidate.enabled);
    if (!script) {
      throw new Error("Userscript is not registered");
    }

    const grants = script.metadata?.grants || [];
    if (!grants.includes("GM_xmlhttpRequest") && !grants.includes("GM.xmlHttpRequest")) {
      throw new Error("Userscript does not grant GM_xmlhttpRequest");
    }

    if (!isConnectAllowed(finalUrl, pageUrl || "", script.metadata?.connects || [])) {
      throw new Error(`Request blocked by @connect: ${finalUrl}`);
    }

    const abortController = new AbortController();
    const requestKey = getPendingRequestKey(scriptId, requestId);
    pendingNetworkRequests.set(requestKey, abortController);

    const timeoutMs = Math.max(0, Number(details.timeout || 0));
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => abortController.abort("timeout"), timeoutMs);
    }

    const response = await fetch(finalUrl, {
      method: normalizeMethod(details.method),
      headers: buildRequestHeaders(details.headers || {}, details.data),
      body: buildRequestBody(details.data, normalizeMethod(details.method)),
      credentials: details.anonymous ? "omit" : "include",
      cache: "no-store",
      redirect: "follow",
      signal: abortController.signal,
    });

    if (timeoutId) clearTimeout(timeoutId);
    pendingNetworkRequests.delete(requestKey);

    const payload = await buildFetchResponsePayload(
      requestId,
      finalUrl,
      response,
      details.responseType || "",
      allowProgress ? emit : undefined
    );
    emit({ kind: "load", payload });
  } catch (error) {
    const requestKey = getPendingRequestKey(scriptId, requestId);
    const controller = pendingNetworkRequests.get(requestKey);
    pendingNetworkRequests.delete(requestKey);

    const wasTimeout = controller?.signal?.reason === "timeout";
    const wasAbort = error instanceof DOMException && error.name === "AbortError";
    const kind = wasTimeout ? "timeout" : wasAbort ? "abort" : "error";

    // eslint-disable-next-line no-console
    console.error("[AUTS background] GM_xmlhttpRequest failed", {
      scriptId,
      requestId,
      url: finalUrl,
      method: details?.method,
      kind,
      error,
      statusText: error instanceof Error ? error.message : String(error),
    });

    emit({
      kind,
      payload: {
        requestId,
        url: finalUrl,
        finalUrl,
        status: 0,
        statusText: error instanceof Error ? error.message : String(error),
        responseHeaders: "",
        responseText: "",
      },
    });
  }
}

async function handleGmXmlHttpAbort(
  requestId: string,
  scriptId: string,
  nonce: string,
  sendResponse: (response: unknown) => void
): Promise<void> {
  handleGmXmlHttpAbortInternal(requestId, scriptId, nonce);
  sendResponse({ success: true });
}

async function handleGmXmlHttpAbortViaPort(
  requestId: string,
  scriptId: string,
  nonce: string,
  _port: chrome.runtime.Port
): Promise<void> {
  handleGmXmlHttpAbortInternal(requestId, scriptId, nonce);
}

function handleGmXmlHttpAbortInternal(
  requestId: string,
  scriptId: string,
  nonce: string
): void {
  void (async () => {
    if (!(await hasValidBridgeNonce(scriptId, nonce))) {
      return;
    }

    const requestKey = getPendingRequestKey(scriptId, requestId);
    const controller = pendingNetworkRequests.get(requestKey);
    if (controller) {
      controller.abort("abort");
      pendingNetworkRequests.delete(requestKey);
    }
  })();
}

function getPendingRequestKey(scriptId: string, requestId: string): string {
  return `${scriptId}:${requestId}`;
}

function normalizeMethod(method: string | undefined): string {
  const normalized = typeof method === "string" ? method.trim().toUpperCase() : "GET";
  return normalized || "GET";
}

function buildRequestHeaders(
  headers: Record<string, string>,
  body: SerializedRequestBody | undefined
): Headers {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers || {})) {
    result.set(key, String(value));
  }
  if (body?.contentType && !result.has("content-type")) {
    result.set("content-type", body.contentType);
  }
  if (body?.kind === "json" && !result.has("content-type")) {
    result.set("content-type", "application/json;charset=UTF-8");
  }
  return result;
}

function buildRequestBody(
  body: SerializedRequestBody | undefined,
  method: string
): BodyInit | undefined {
  if (!body || method === "GET" || method === "HEAD") return undefined;
  if (body.kind === "text" || body.kind === "json") {
    return String(body.value);
  }
  if (body.kind === "base64") {
    return decodeBase64ToUint8Array(String(body.value));
  }
  if (body.kind === "form-data") {
    const formData = new FormData();
    for (const [key, value] of body.value as [string, string][]) {
      formData.append(key, value);
    }
    return formData;
  }
  return undefined;
}

async function buildFetchResponsePayload(
  requestId: string,
  url: string,
  response: Response,
  responseType: string,
  emitProgress?: (response: GmXmlHttpProgressMessage) => void
): Promise<Record<string, unknown>> {
  const normalizedType = String(responseType || "").toLowerCase();
  const basePayload: Record<string, unknown> = {
    requestId,
    url,
    finalUrl: response.url || url,
    status: response.status,
    statusText: response.statusText,
    responseHeaders: Array.from(response.headers.entries())
      .map(([key, value]) => `${key}: ${value}`)
      .join("\r\n"),
    responseType: normalizedType,
    responseMimeType: response.headers.get("content-type") || undefined,
  };

  if (normalizedType === "arraybuffer" || normalizedType === "blob") {
    const buffer = await response.arrayBuffer();
    return {
      ...basePayload,
      responseBase64: encodeArrayBufferToBase64(buffer),
      responseText: "",
      readyState: 4,
    };
  }

  if (emitProgress && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let loaded = 0;

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const value = chunk.value || new Uint8Array();
      loaded += value.byteLength;
      text += decoder.decode(value, { stream: true });
      emitProgress({
        kind: "progress",
        payload: {
          ...basePayload,
          responseText: text,
          readyState: 3,
          loaded,
          total: 0,
          lengthComputable: false,
        },
      });
    }

    text += decoder.decode();
    const finalPayload: Record<string, unknown> = {
      ...basePayload,
      responseText: text,
      readyState: 4,
      loaded,
      total: 0,
      lengthComputable: false,
    };

    if (normalizedType === "json") {
      try {
        finalPayload.responseJson = text ? JSON.parse(text) : null;
      } catch {
        finalPayload.responseJson = null;
      }
    }
    return finalPayload;
  }

  const text = await response.text();
  const payload: Record<string, unknown> = {
    ...basePayload,
    responseText: text,
    readyState: 4,
  };
  if (normalizedType === "json") {
    try {
      payload.responseJson = text ? JSON.parse(text) : null;
    } catch {
      payload.responseJson = null;
    }
  }
  return payload;
}

function encodeArrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary);
}

function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64 || "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function isConnectAllowed(targetUrl: string, pageUrl: string, connects: string[]): boolean {
  let target: URL;
  try {
    target = new URL(targetUrl, pageUrl || undefined);
  } catch {
    return false;
  }

  if (pageUrl) {
    try {
      const page = new URL(pageUrl);
      if (page.origin === target.origin) return true;
    } catch {
      // ignore invalid page URL
    }
  }

  if (!Array.isArray(connects) || connects.length === 0) return false;

  return connects.some((entry) => connectEntryMatches(entry, target, pageUrl));
}

function connectEntryMatches(entry: string, target: URL, pageUrl: string): boolean {
  const value = String(entry || "").trim();
  if (!value) return false;
  if (value === "*") return true;
  if (value === "self") {
    try {
      return new URL(pageUrl).origin === target.origin;
    } catch {
      return false;
    }
  }

  if (value.includes("://")) {
    try {
      const parsed = new URL(value);
      return parsed.origin === target.origin;
    } catch {
      return false;
    }
  }

  if (value.startsWith("*.")) {
    const suffix = value.slice(2);
    return target.hostname === suffix || target.hostname.endsWith(`.${suffix}`);
  }

  return target.hostname === value;
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
      (s) => s.enabled && urlMatches(url, s.metadata?.matches || [], s.metadata?.excludes || [])
    );
    return matching.length;
  } catch {
    return 0;
  }
}

// Read auto update flag from sync storage (default true)
async function isAutoUpdateEnabled(): Promise<boolean> {
  try {
    const data = await chrome.storage.sync.get({ auts_auto_update: true });
    return Boolean((data as { auts_auto_update: unknown }).auts_auto_update);
  } catch (_e) {
    return true;
  }
}

async function maybeRefreshForUrl(url: string): Promise<void> {
  if (!url) return;
  const autoUpdate = await isAutoUpdateEnabled();
  if (!autoUpdate) return;

  // Check if any remote script would match this URL; if none, skip refresh
  try {
    const scripts = await getAllScripts();
    const hasRemoteMatching = scripts.some(
      (s) => (s.sourceType === "url" || s.sourceType === "server") && s.enabled && urlMatches(url, s.metadata?.matches || [], s.metadata?.excludes || [])
    );
    // If no matching userscripts are currently mapped, but there are enabled URL plugins,
    // we still refresh to allow metadata changes to be picked up.
    let hasEnabledUrlPlugins = false;
    const raw = await getAllAutsPlugins();
    hasEnabledUrlPlugins = raw.some((p) => p && p.sourceType === "url" && p.enabled !== false);

    if (!hasRemoteMatching && !hasEnabledUrlPlugins) {
      return;
    }
  } catch {
    // If we fail to read scripts, be conservative and skip
    return;
  }

  autoRefreshing = true;
  try {
    await Promise.allSettled([refreshUrlPluginsAuto(), refreshAllSubscriptionsAuto()]);
    await registerAllUserScripts();
  } finally {
    autoRefreshing = false;
  }
}

// Update when tab changes
chrome.tabs.onActivated.addListener(async () => {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs && tabs[0];
    const url = tab?.url || "";
    void maybeRefreshForUrl(url);
  } finally {
    void updateBadgeForActiveTab();
  }
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    const url = tab?.url || changeInfo.url || "";
    void maybeRefreshForUrl(url);
    void updateBadgeForActiveTab();
  }
});
