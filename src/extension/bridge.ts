// Bridge content script: forwards page postMessages to extension runtime

declare global {
  interface Window {
    AUTS_BRIDGE_INSTALLED?: boolean;
  }
}

(() => {
  if (window.AUTS_BRIDGE_INSTALLED) return;
  window.AUTS_BRIDGE_INSTALLED = true;

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
      }
    },
    false
  );
})();
