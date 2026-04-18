import { parseUserScriptMeta } from "./userscript_parser";
import type { UserScript, UserscriptMeta } from "@/extension/types";

export interface JsSource {
  code: string;
}

/**
 * Build a single userscript source that injects GM helpers, then evaluates
 * @require contents followed by the main code inside the same closure.
 */
export async function buildJsSourcesFromUserScript(
  script: UserScript,
  bridgeNonce: string
): Promise<JsSource[]> {
  const segments: string[] = [];
  try {
    const code = script.code || "";
    const meta: UserscriptMeta = parseUserScriptMeta(code);
    const requires = Array.isArray(meta.requires) ? meta.requires : [];
    const grants = Array.isArray(meta.grants) ? meta.grants : [];
    const hasGmXmlHttpRequest =
      grants.includes("GM_xmlhttpRequest") || grants.includes("GM.xmlHttpRequest");

    segments.push(buildWrapperPrelude(script, bridgeNonce, hasGmXmlHttpRequest));

    for (const href of requires) {
      const content = await fetchWithTimeout(href, 15000);
      if (content) segments.push(content);
    }

    segments.push(code);
    segments.push("})();");
  } catch {
    segments.length = 0;
    segments.push(buildWrapperPrelude(script, bridgeNonce, false));
    segments.push(script.code || "");
    segments.push("})();");
  }

  return [{ code: segments.join("\n\n") }];
}

function buildWrapperPrelude(
  script: UserScript,
  bridgeNonce: string,
  hasGmXmlHttpRequest: boolean
): string {
  const scriptId = JSON.stringify(script.id);
  const scriptName = JSON.stringify(script.name || script.id);
  const scriptMeta = JSON.stringify({
    name: script.metadata?.name || script.name || script.id,
    version: script.metadata?.version,
    description: script.metadata?.description,
    author: script.metadata?.author,
    matches: script.metadata?.matches || [],
    excludes: script.metadata?.excludes || [],
    connects: script.metadata?.connects || [],
    grants: script.metadata?.grants || [],
  });
  const nonce = JSON.stringify(bridgeNonce);
  const enabled = JSON.stringify(hasGmXmlHttpRequest);

  return `
(function() {
  const __AUTS_SCRIPT_ID__ = ${scriptId};
  const __AUTS_SCRIPT_NAME__ = ${scriptName};
  const __AUTS_GM_NONCE__ = ${nonce};
  const __AUTS_GM_ENABLED__ = ${enabled};
  const __AUTS_GM_INFO__ = {
    scriptHandler: "AUTS",
    version: "0.1.0",
    script: ${scriptMeta}
  };
  const __AUTS_PENDING_REQUESTS__ = new Map();

  function __AUTS_arrayBufferToBase64__(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let index = 0; index < bytes.byteLength; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    return btoa(binary);
  }

  function __AUTS_base64ToArrayBuffer__(base64) {
    const binary = atob(base64 || "");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes.buffer;
  }

  function __AUTS_normalizeBody__(data) {
    if (data == null) return undefined;
    if (typeof data === "string") return { kind: "text", value: data };
    if (typeof URLSearchParams !== "undefined" && data instanceof URLSearchParams) {
      return {
        kind: "text",
        value: data.toString(),
        contentType: "application/x-www-form-urlencoded;charset=UTF-8"
      };
    }
    if (typeof ArrayBuffer !== "undefined" && data instanceof ArrayBuffer) {
      return { kind: "base64", value: __AUTS_arrayBufferToBase64__(data) };
    }
    if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(data)) {
      return {
        kind: "base64",
        value: __AUTS_arrayBufferToBase64__(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
      };
    }
    if (typeof FormData !== "undefined" && data instanceof FormData) {
      const entries = [];
      data.forEach((value, key) => {
        if (typeof value === "string") {
          entries.push([key, value]);
        }
      });
      return { kind: "form-data", value: entries };
    }
    if (typeof data === "object") {
      return { kind: "json", value: JSON.stringify(data) };
    }
    return { kind: "text", value: String(data) };
  }

  function __AUTS_buildResponse__(payload) {
    const response = {
      readyState: typeof payload.readyState === "number" ? payload.readyState : 4,
      responseHeaders: payload.responseHeaders || "",
      responseText: typeof payload.responseText === "string" ? payload.responseText : "",
      responseXML: null,
      status: Number(payload.status || 0),
      statusText: payload.statusText || "",
      finalUrl: payload.finalUrl || payload.url || "",
      loaded: Number(payload.loaded || 0),
      total: Number(payload.total || 0),
      lengthComputable: Boolean(payload.lengthComputable),
    };

    if (payload.responseType === "arraybuffer") {
      response.response = __AUTS_base64ToArrayBuffer__(payload.responseBase64 || "");
      return response;
    }
    if (payload.responseType === "blob") {
      const blobBuffer = __AUTS_base64ToArrayBuffer__(payload.responseBase64 || "");
      response.response = new Blob([blobBuffer], {
        type: payload.responseMimeType || "application/octet-stream"
      });
      return response;
    }
    if (payload.responseType === "json") {
      response.response = payload.responseJson;
      return response;
    }

    response.response = response.responseText;
    return response;
  }

  function __AUTS_finishRequest__(kind, payload) {
    const pending = __AUTS_PENDING_REQUESTS__.get(payload.requestId);
    if (!pending) return;

    const details = pending.details;
    const response = __AUTS_buildResponse__(payload);

    if (kind === "progress") {
      if (typeof details.onreadystatechange === "function") details.onreadystatechange(response);
      if (typeof details.onprogress === "function") details.onprogress(response);
      return;
    }

    __AUTS_PENDING_REQUESTS__.delete(payload.requestId);

    if (kind === "load") {
      if (typeof details.onreadystatechange === "function") details.onreadystatechange(response);
      if (typeof details.onload === "function") details.onload(response);
      pending.resolve(response);
      return;
    }

    if (kind === "abort" && typeof details.onabort === "function") details.onabort(response);
    if (kind === "timeout" && typeof details.ontimeout === "function") details.ontimeout(response);
    if (kind === "error" && typeof details.onerror === "function") details.onerror(response);
    pending.reject(response);
  }

  window.addEventListener("message", function(event) {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.__autsBridge !== true) return;
    if (data.scriptId !== __AUTS_SCRIPT_ID__ || data.nonce !== __AUTS_GM_NONCE__) return;
    if (data.type === "AUTS_GM_XMLHTTP_RESPONSE") {
      __AUTS_finishRequest__(data.kind || "load", data.payload || {});
    }
  });

  function GM_xmlhttpRequest(details) {
    if (!__AUTS_GM_ENABLED__) {
      throw new Error("GM_xmlhttpRequest is not granted for this userscript");
    }
    if (!details || typeof details !== "object") {
      throw new Error("GM_xmlhttpRequest requires a details object");
    }
    if (typeof details.url !== "string" || !details.url) {
      throw new Error("GM_xmlhttpRequest requires a url");
    }

    const requestId = __AUTS_SCRIPT_ID__ + ":" + Date.now() + ":" + Math.random().toString(16).slice(2);
    const payload = {
      __autsBridge: true,
      type: "AUTS_GM_XMLHTTP_REQUEST",
      scriptId: __AUTS_SCRIPT_ID__,
      nonce: __AUTS_GM_NONCE__,
      requestId,
      pageUrl: window.location.href,
      details: {
        url: String(details.url),
        method: typeof details.method === "string" ? details.method : "GET",
        headers: details.headers && typeof details.headers === "object" ? details.headers : {},
        responseType: typeof details.responseType === "string" ? details.responseType : "",
        timeout: typeof details.timeout === "number" ? details.timeout : 0,
        anonymous: Boolean(details.anonymous),
        data: __AUTS_normalizeBody__(details.data)
      }
    };

    const promise = new Promise(function(resolve, reject) {
      __AUTS_PENDING_REQUESTS__.set(requestId, { details, resolve, reject });
    });

    window.postMessage(payload, "*");

    return {
      abort: function() {
        if (!__AUTS_PENDING_REQUESTS__.has(requestId)) return;
        window.postMessage(
          {
            __autsBridge: true,
            type: "AUTS_GM_XMLHTTP_ABORT",
            scriptId: __AUTS_SCRIPT_ID__,
            nonce: __AUTS_GM_NONCE__,
            requestId
          },
          "*"
        );
      },
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally.bind(promise)
    };
  }

  const GM_info = __AUTS_GM_INFO__;
  const GM = {
    info: GM_info,
    xmlHttpRequest: function(details) {
      return new Promise(function(resolve, reject) {
        GM_xmlhttpRequest({
          ...details,
          onload: function(response) {
            if (typeof details?.onload === "function") details.onload(response);
            resolve(response);
          },
          onerror: function(response) {
            if (typeof details?.onerror === "function") details.onerror(response);
            reject(response);
          },
          ontimeout: function(response) {
            if (typeof details?.ontimeout === "function") details.ontimeout(response);
            reject(response);
          },
          onabort: function(response) {
            if (typeof details?.onabort === "function") details.onabort(response);
            reject(response);
          }
        });
      });
    }
  };
`;
}

async function fetchWithTimeout(url: string, ms: number): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    const resp = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[AUTS] Failed to fetch @require:", url, e);
    return "";
  }
}


