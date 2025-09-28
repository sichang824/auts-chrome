import { parseUserScriptMeta, type UserscriptMeta } from "./userscript_parser";

export interface JsSource {
  code: string;
}

/**
 * Build JS sources honoring @require order and returning the final code array.
 * The main code is always appended at the end.
 */
export async function buildJsSourcesFromUserScript(code: string): Promise<JsSource[]> {
  const sources: JsSource[] = [];
  try {
    const meta: UserscriptMeta = parseUserScriptMeta(code || "");
    const requires = Array.isArray(meta.requires) ? meta.requires : [];
    for (const href of requires) {
      const content = await fetchWithTimeout(href, 15000);
      if (content) sources.push({ code: content });
    }
  } catch {
    // ignore parsing/fetching errors and still push main code
  }
  sources.push({ code });
  return sources;
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


