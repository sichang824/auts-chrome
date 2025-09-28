import "@/index.css";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { urlMatches } from "@/lib/url_matcher";
import { Header } from "./components/Header";
import { GlobalStatus } from "./components/GlobalStatus";
import { CurrentTab } from "./components/CurrentTab";
import { ScriptsList } from "./components/ScriptsList";
import { QuickActions } from "./components/QuickActions";
import { Separator } from "./components/Separator";
import { getAllScriptsForPopup } from "@/extension/script_storage";
import { toggleSubscriptionScript } from "@/extension/subscription_storage";

interface PopupState {
  autsEnabled: boolean;
  activeUrl: string;
  scriptCount: number;
  totalScripts: number;
  matchingScripts: any[];
  isLoading: boolean;
  userScriptsAvailable: boolean;
}

function PopupApp() {
  const [state, setState] = useState<PopupState>({
    autsEnabled: true,
    activeUrl: "",
    scriptCount: 0,
    totalScripts: 0,
    matchingScripts: [],
    isLoading: true,
    userScriptsAvailable: true,
  });

  // Load initial data, check permissions, and listen for state changes
  useEffect(() => {
    const loadData = () => {
      Promise.all([
        // Get global enabled state
        new Promise<boolean>((resolve) => {
          chrome.storage.sync.get({ auts_enabled: true }, (data) => {
            resolve(Boolean(data.auts_enabled));
          });
        }),
        // Get aggregated scripts for popup (include disabled)
        getAllScriptsForPopup(),
        // Get active tab URL
        new Promise<string>((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            resolve(tabs?.[0]?.url || "");
          });
        }),
        // Check userScripts API availability via background
        new Promise<boolean>((resolve) => {
          try {
            chrome.runtime.sendMessage({ type: 'CHECK_USER_SCRIPTS_API' }, (resp) => {
              resolve(Boolean(resp && resp.available));
            });
          } catch (_e) {
            resolve(false);
          }
        })
      ]).then(([autsEnabled, scripts, activeUrl, userScriptsAvailable]) => {
        // Filter scripts that match current page
        const matchingScripts = (Array.isArray(scripts) ? scripts : []).filter((script: any) => {
          const matches = script?.metadata?.matches || [];
          const excludes = script?.metadata?.excludes || [];
          if (!Array.isArray(matches) || matches.length === 0) return false;
          return urlMatches(activeUrl, matches, excludes);
        });

        // Count enabled scripts (only matching ones)
        const enabledMatchingScripts = matchingScripts.filter((s: any) => s?.enabled);

        setState({
          autsEnabled,
          activeUrl,
          scriptCount: enabledMatchingScripts.length,
          totalScripts: matchingScripts.length,
          matchingScripts,
          isLoading: false,
          userScriptsAvailable,
        });
      });
    };

    // Initial load
    loadData();

    // Listen for state changes from other parts of the extension
    const messageListener = (message: any) => {
      if (message.type === 'STATE_CHANGED') {
        // Reload data when state changes are broadcast
        loadData();
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Listen for storage changes
    const storageListener = (changes: any) => {
      if (changes.auts_enabled || changes.auts_scripts || changes.auts_subscriptions) {
        loadData();
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, []);

  const toggleEnabled = (next: boolean) => {
    setState((prev) => ({ ...prev, autsEnabled: next }));
    chrome.storage.sync.set({ auts_enabled: next }, () => {
      // Broadcast state change to other extension contexts
      chrome.runtime.sendMessage({ type: 'STATE_CHANGED', source: 'popup' });
      chrome.tabs.reload();
    });
  };

  const openOptions = () => chrome.runtime.openOptionsPage();

  const openExtensionDetails = () => {
    try {
      const id = chrome.runtime.id;
      const url = `chrome://extensions/?id=${id}`;
      chrome.tabs.create({ url });
    } catch {
      // ignore
    }
  };

  const handleRunNow = () => {
    chrome.runtime.sendMessage({ type: "RUN_NOW" });
  };

  const handleReloadTab = () => {
    chrome.tabs.reload();
  };

  const toggleScriptEnabled = (scriptId: string, enabled: boolean) => {
    const script: any = state.matchingScripts.find((s: any) => s.id === scriptId);
    if (!script || !script.origin) return;

    if (script.origin.type === 'plugin') {
      chrome.storage.local.get({ auts_scripts: [] }, (data) => {
        const scripts = Array.isArray(data.auts_scripts) ? data.auts_scripts : [];
        const updatedScripts = scripts.map((p: any) =>
          p.id === script.origin.pluginId ? { ...p, enabled, updatedAt: Date.now() } : p
        );

        chrome.storage.local.set({ auts_scripts: updatedScripts }, () => {
          setState(prev => ({
            ...prev,
            matchingScripts: prev.matchingScripts.map((ms: any) =>
              ms.id === scriptId ? { ...ms, enabled } : ms
            ),
            scriptCount: enabled ? prev.scriptCount + 1 : prev.scriptCount - 1
          }));

          chrome.runtime.sendMessage({ type: 'RELOAD_SCRIPTS' }, () => {
            chrome.runtime.sendMessage({ type: 'STATE_CHANGED', source: 'popup' });
            chrome.tabs.reload();
          });
        });
      });
    } else if (script.origin.type === 'subscription') {
      toggleSubscriptionScript(script.origin.subscriptionId, script.origin.serverScriptId)
        .then(() => {
          setState(prev => ({
            ...prev,
            matchingScripts: prev.matchingScripts.map((ms: any) =>
              ms.id === scriptId ? { ...ms, enabled } : ms
            ),
            scriptCount: enabled ? prev.scriptCount + 1 : prev.scriptCount - 1
          }));

          chrome.runtime.sendMessage({ type: 'RELOAD_SCRIPTS' }, () => {
            chrome.runtime.sendMessage({ type: 'STATE_CHANGED', source: 'popup' });
            chrome.tabs.reload();
          });
        })
        .catch(() => {
          // ignore
        });
    }
  };

  const testRunScript = (script: any) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (tab?.id && tab.url) {
        // Send message to background to run specific script
        chrome.runtime.sendMessage({
          type: 'RUN_SCRIPT',
          scriptId: script.id,
          tabId: tab.id,
          url: tab.url
        });
        chrome.tabs.reload();
      }
    });
  };

  const openScriptDetails = (scriptId: string) => {
    const script: any = state.matchingScripts.find((s: any) => s.id === scriptId);
    chrome.runtime.openOptionsPage(() => {
      // Navigate to script details after a short delay
      setTimeout(() => {
        if (script && script.origin && script.origin.type === 'plugin') {
          location.hash = `#/plugin/${encodeURIComponent(script.origin.pluginId)}`;
        } else {
          location.hash = `#/subscriptions`;
        }
      }, 100);
    });
  };

  const handleCreateScript = () => {
    const domain = getDomain(state.activeUrl);
    const url = state.activeUrl;

    // Create a new script with basic template
    const scriptId = `script-${Date.now()}`;
    const scriptTemplate = `// ==UserScript==
// @name         New Script for ${domain}
// @namespace    https://github.com/anthropics/auts
// @version      1.0.0
// @description  Auto-generated script for ${domain}
// @author       You
// @match        ${
      url.includes("://") ? url.split("://")[0] : "https"
    }://${domain}/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('Script running on ${domain}');

    // Your code here...

})();`;

    const newScript = {
      id: scriptId,
      name: `New Script for ${domain}`,
      enabled: true,
      sourceType: "inline",
      inline: { content: scriptTemplate },
      matches: [
        `${url.includes("://") ? url.split("://")[0] : "https"}://${domain}/*`,
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Save the script
    chrome.storage.local.get({ auts_scripts: [] }, (data) => {
      const scripts = Array.isArray(data.auts_scripts) ? data.auts_scripts : [];
      const updatedScripts = [...scripts, newScript];
      chrome.storage.local.set({ auts_scripts: updatedScripts }, () => {
        // Update local state
        setState((prev) => ({
          ...prev,
          scriptCount: prev.scriptCount + 1,
          totalScripts: prev.totalScripts + 1,
        }));

        // Broadcast state change to other extension contexts
        chrome.runtime.sendMessage({ type: 'STATE_CHANGED', source: 'popup' });

        // Open options page to edit the new script
        chrome.runtime.openOptionsPage(() => {
          // Navigate to edit page after a short delay
          setTimeout(() => {
            location.hash = `#/plugin/${encodeURIComponent(scriptId)}/edit`;
          }, 100);
        });
      });
    });
  };

  const getDomain = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  };

  if (state.isLoading) {
    return (
      <div className="p-4 w-[380px] flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="w-[380px] bg-background min-h-[500px] relative">
      <Header onOpenOptions={openOptions} />

      <div className="pt-16 pb-20 overflow-y-auto">
        {!state.userScriptsAvailable && (
          <div className="mx-3 mt-3 rounded-md border border-orange-200 bg-orange-50 p-3 text-orange-800 text-xs">
            <div className="font-semibold mb-1">Allow User Scripts</div>
            <div>
              The extension will be able to run code which has not been reviewed by Google. It may be unsafe and you should only enable this if you know what you are doing.
            </div>
            <button
              className="mt-2 inline-flex items-center px-2 py-1 rounded bg-orange-500 text-white hover:bg-orange-600"
              onClick={openExtensionDetails}
            >
              Open extension details
            </button>
          </div>
        )}

        <GlobalStatus
          autsEnabled={state.autsEnabled}
          onToggleEnabled={toggleEnabled}
        />

        <Separator />

        <CurrentTab
          activeUrl={state.activeUrl}
          scriptCount={state.scriptCount}
          totalScripts={state.totalScripts}
          getDomain={getDomain}
        />

        <Separator />

        <ScriptsList
          matchingScripts={state.matchingScripts}
          onToggleScriptEnabled={toggleScriptEnabled}
          onTestRunScript={testRunScript}
          onOpenScriptDetails={openScriptDetails}
        />
      </div>

      <QuickActions
        autsEnabled={state.autsEnabled}
        activeUrl={state.activeUrl}
        onCreateScript={handleCreateScript}
        onRunNow={handleRunNow}
        onReloadTab={handleReloadTab}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<PopupApp />);
