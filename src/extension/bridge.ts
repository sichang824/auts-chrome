// Bridge content script: forwards page postMessages to extension runtime

declare global {
  interface Window {
    AUTS_BRIDGE_INSTALLED?: boolean;
  }
}

(() => {
  if (window.AUTS_BRIDGE_INSTALLED) return;
  window.AUTS_BRIDGE_INSTALLED = true;
  const activeRequestPorts = new Map<string, chrome.runtime.Port>();

  function postToPage(message: unknown): void {
    window.postMessage(message, "*");
  }

  function closeRequestPort(requestId: string): void {
    const port = activeRequestPorts.get(requestId);
    activeRequestPorts.delete(requestId);
    if (!port) return;
    try {
      port.disconnect();
    } catch {
      // ignore
    }
  }

  window.addEventListener(
    "message",
    (event: MessageEvent) => {
      if (event.source !== window) return;
      const data: any = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "AUTS_EMERGENCY_STOP") {
        try {
          chrome.runtime.sendMessage({ type: "EMERGENCY_STOP" });
        } catch {
          // ignore
        }
        return;
      }
      if (data.__autsBridge !== true) return;
      if (data.type === "AUTS_GM_XMLHTTP_REQUEST") {
        try {
          closeRequestPort(data.requestId);
          const port = chrome.runtime.connect({ name: `AUTS_GM_XMLHTTP:${data.requestId}` });
          activeRequestPorts.set(data.requestId, port);

          port.onMessage.addListener((response) => {
            postToPage({
              __autsBridge: true,
              type: "AUTS_GM_XMLHTTP_RESPONSE",
              scriptId: data.scriptId,
              nonce: data.nonce,
              kind: response?.kind || "error",
              payload: response?.payload || {
                requestId: data.requestId,
                status: 0,
                statusText: "Request failed",
                finalUrl: data.details?.url || "",
              },
            });

            if (["load", "error", "abort", "timeout"].includes(response?.kind || "")) {
              closeRequestPort(data.requestId);
            }
          });

          port.onDisconnect.addListener(() => {
            const runtimeError = chrome.runtime.lastError?.message;
            const stillActive = activeRequestPorts.get(data.requestId) === port;
            activeRequestPorts.delete(data.requestId);
            if (!runtimeError || !stillActive) return;
            // eslint-disable-next-line no-console
            console.error("[AUTS bridge] GM_xmlhttpRequest runtime error", {
              scriptId: data.scriptId,
              requestId: data.requestId,
              url: data.details?.url,
              error: runtimeError,
            });
            postToPage({
              __autsBridge: true,
              type: "AUTS_GM_XMLHTTP_RESPONSE",
              scriptId: data.scriptId,
              nonce: data.nonce,
              kind: "error",
              payload: {
                requestId: data.requestId,
                status: 0,
                statusText: runtimeError,
                finalUrl: data.details?.url || "",
              },
            });
          });

          port.postMessage({
            type: "GM_XMLHTTP_REQUEST",
            scriptId: data.scriptId,
            nonce: data.nonce,
            requestId: data.requestId,
            pageUrl: data.pageUrl,
            details: data.details,
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("[AUTS bridge] Failed to forward GM_xmlhttpRequest", {
            scriptId: data.scriptId,
            requestId: data.requestId,
            url: data.details?.url,
            error,
          });
          postToPage({
            __autsBridge: true,
            type: "AUTS_GM_XMLHTTP_RESPONSE",
            scriptId: data.scriptId,
            nonce: data.nonce,
            kind: "error",
            payload: {
              requestId: data.requestId,
              status: 0,
              statusText: error instanceof Error ? error.message : "Request failed",
              finalUrl: data.details?.url || "",
            },
          });
        }
        return;
      }
      if (data.type === "AUTS_GM_XMLHTTP_ABORT") {
        try {
          const port = activeRequestPorts.get(data.requestId);
          if (port) {
            port.postMessage({
              type: "GM_XMLHTTP_ABORT",
              scriptId: data.scriptId,
              nonce: data.nonce,
              requestId: data.requestId,
            });
          }
        } catch {
          // ignore
        }
      }
    },
    false
  );
})();
