// Popup script for userscript manager (TypeScript)
document.addEventListener('DOMContentLoaded', async () => {
  await loadScripts();
  setupEventListeners();
});

/** Load and display scripts */
async function loadScripts(): Promise<void> {
  const loadingEl = document.getElementById('loading') as HTMLElement;
  const scriptListEl = document.getElementById('scriptList') as HTMLElement;
  const emptyStateEl = document.getElementById('emptyState') as HTMLElement;
  const errorEl = document.getElementById('error') as HTMLElement;
  try {
    loadingEl.style.display = 'block';
    scriptListEl.style.display = 'none';
    emptyStateEl.style.display = 'none';
    errorEl.style.display = 'none';
    const response = await sendMessage({ type: 'GET_SCRIPTS' });
    if ((response as any).success) {
      const scripts = (response as any).scripts as any[];
      if (scripts.length === 0) {
        loadingEl.style.display = 'none';
        emptyStateEl.style.display = 'block';
      } else {
        renderScripts(scripts);
        loadingEl.style.display = 'none';
        scriptListEl.style.display = 'block';
      }
    } else {
      throw new Error((response as any).error || 'Failed to load scripts');
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error loading scripts:', error);
    showError('加载脚本失败: ' + (error as Error).message);
    loadingEl.style.display = 'none';
  }
}

/** Render scripts in the popup */
function renderScripts(scripts: any[]): void {
  const scriptListEl = document.getElementById('scriptList') as HTMLElement;
  scriptListEl.innerHTML = '';
  scripts.forEach((script) => {
    const scriptEl = createScriptElement(script);
    scriptListEl.appendChild(scriptEl);
  });
}

/** Create a script element for the popup */
function createScriptElement(script: any): HTMLElement {
  const scriptEl = document.createElement('div');
  scriptEl.className = 'script-item';
  scriptEl.innerHTML = `
    <div class="script-info">
      <div class="script-name">${escapeHtml(script.name)}</div>
      <div class="script-matches">${escapeHtml((script.matches || []).join(', '))}</div>
    </div>
    <div class="script-actions">
      <button class="toggle-btn ${script.enabled ? 'enabled' : 'disabled'}" data-id="${script.id}">
        ${script.enabled ? '启用' : '禁用'}
      </button>
    </div>
  `;
  const toggleBtn = scriptEl.querySelector('.toggle-btn') as HTMLButtonElement;
  toggleBtn.addEventListener('click', async () => { await toggleScript(script.id); });
  return scriptEl;
}

/** Toggle script enabled/disabled status */
async function toggleScript(scriptId: string): Promise<void> {
  try {
    const response = await sendMessage({ type: 'TOGGLE_SCRIPT', id: scriptId });
    if ((response as any).success) {
      await loadScripts();
    } else {
      throw new Error((response as any).error || 'Failed to toggle script');
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error toggling script:', error);
    showError('切换脚本状态失败: ' + (error as Error).message);
  }
}

/** Setup event listeners */
function setupEventListeners(): void {
  document.getElementById('openOptions')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
    // Delay closing to ensure the options tab becomes active before popup closes
    setTimeout(() => window.close(), 2000);
  });
  document.getElementById('addFirstScript')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
    // Delay closing to ensure the options tab becomes active before popup closes
    setTimeout(() => window.close(), 2000);
  });
}

/** Send message to background script */
function sendMessage(message: unknown): Promise<unknown> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

/** Show error message */
function showError(message: string): void {
  const errorEl = document.getElementById('error') as HTMLElement;
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}

/** Escape HTML to prevent XSS */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}


