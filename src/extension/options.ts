// Options page script for userscript manager (TypeScript)
let currentEditingScript: any | null = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadScripts();
  setupEventListeners();
});

/**
 * Load and display all scripts
 */
async function loadScripts(): Promise<void> {
  try {
    const response = await sendMessage({ type: 'GET_SCRIPTS' });
    if ((response as any).success) {
      const scripts = (response as any).scripts as any[];
      renderScripts(scripts);
      updateScriptCount(scripts.length);
    } else {
      throw new Error((response as any).error || 'Failed to load scripts');
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error loading scripts:', error);
    showError('加载脚本失败: ' + (error as Error).message);
  }
}

/**
 * Render scripts in the options page
 */
function renderScripts(scripts: any[]): void {
  const scriptListEl = document.getElementById('scriptList') as HTMLElement;
  const emptyStateEl = document.getElementById('emptyState') as HTMLElement;

  if (scripts.length === 0) {
    scriptListEl.style.display = 'none';
    emptyStateEl.style.display = 'block';
    return;
  }

  scriptListEl.style.display = 'block';
  emptyStateEl.style.display = 'none';
  scriptListEl.innerHTML = '';

  scripts.forEach((script) => {
    const scriptEl = createScriptElement(script);
    scriptListEl.appendChild(scriptEl);
  });
}

/**
 * Create a script element for the options page
 */
function createScriptElement(script: any): HTMLElement {
  const scriptEl = document.createElement('div');
  scriptEl.className = 'script-item';
  scriptEl.innerHTML = `
    <div class="script-header">
      <div class="script-info">
        <h3>${escapeHtml(script.name)}</h3>
        <div class="script-meta">
          创建时间: ${formatDate(script.created_at)} 
          ${script.updated_at ? '| 更新时间: ' + formatDate(script.updated_at) : ''}
        </div>
        <div class="script-matches">${escapeHtml((script.matches || []).join(', '))}</div>
      </div>
      <div class="script-actions">
        <span class="status-badge ${script.enabled ? 'status-enabled' : 'status-disabled'}">
          ${script.enabled ? '启用' : '禁用'}
        </span>
        <button class="btn toggle-btn" data-id="${script.id}">
          ${script.enabled ? '禁用' : '启用'}
        </button>
        <button class="btn edit-btn" data-id="${script.id}">编辑</button>
        <button class="btn expand-btn" data-id="${script.id}">展开</button>
        <button class="btn btn-danger delete-btn" data-id="${script.id}">删除</button>
      </div>
    </div>
    <div class="script-body" id="body-${script.id}">
      <div class="form-group">
        <label>脚本代码:</label>
        <textarea class="code-editor" readonly>${escapeHtml(script.code || '')}</textarea>
      </div>
    </div>
  `;

  const toggleBtn = scriptEl.querySelector('.toggle-btn') as HTMLButtonElement;
  const editBtn = scriptEl.querySelector('.edit-btn') as HTMLButtonElement;
  const expandBtn = scriptEl.querySelector('.expand-btn') as HTMLButtonElement;
  const deleteBtn = scriptEl.querySelector('.delete-btn') as HTMLButtonElement;

  toggleBtn.addEventListener('click', () => toggleScript(script.id));
  editBtn.addEventListener('click', () => editScript(script));
  expandBtn.addEventListener('click', () => toggleExpand(script.id));
  deleteBtn.addEventListener('click', () => deleteScript(script.id));

  return scriptEl;
}

/**
 * Toggle script expanded/collapsed state
 */
function toggleExpand(scriptId: string): void {
  const bodyEl = document.getElementById(`body-${scriptId}`) as HTMLElement;
  const expandBtn = document.querySelector(`[data-id="${scriptId}"].expand-btn`) as HTMLButtonElement;
  if (bodyEl.classList.contains('expanded')) {
    bodyEl.classList.remove('expanded');
    expandBtn.textContent = '展开';
  } else {
    bodyEl.classList.add('expanded');
    expandBtn.textContent = '收起';
  }
}

/**
 * Toggle script enabled/disabled status
 */
async function toggleScript(scriptId: string): Promise<void> {
  try {
    const response = await sendMessage({ type: 'TOGGLE_SCRIPT', id: scriptId });
    if ((response as any).success) {
      await loadScripts();
      showSuccess('脚本状态已更新');
    } else {
      throw new Error((response as any).error || 'Failed to toggle script');
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error toggling script:', error);
    showError('切换脚本状态失败: ' + (error as Error).message);
  }
}

/**
 * Delete a script
 */
async function deleteScript(scriptId: string): Promise<void> {
  if (!confirm('确定要删除这个脚本吗？此操作不可撤销。')) {
    return;
  }
  try {
    const response = await sendMessage({ type: 'DELETE_SCRIPT', id: scriptId });
    if ((response as any).success) {
      await loadScripts();
      showSuccess('脚本已删除');
    } else {
      throw new Error((response as any).error || 'Failed to delete script');
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error deleting script:', error);
    showError('删除脚本失败: ' + (error as Error).message);
  }
}

/**
 * Edit a script
 */
function editScript(script: any): void {
  currentEditingScript = script;
  (document.getElementById('modalTitle') as HTMLElement).textContent = '编辑脚本';
  (document.getElementById('scriptName') as HTMLInputElement).value = script.name || '';
  (document.getElementById('scriptMatches') as HTMLTextAreaElement).value = (script.matches || []).join('\n');
  (document.getElementById('scriptExcludes') as HTMLTextAreaElement).value = (script.excludes || []).join('\n');
  (document.getElementById('scriptCode') as HTMLTextAreaElement).value = script.code || '';
  showModal();
}

/** Show the add/edit script modal */
function showModal(): void {
  document.getElementById('scriptModal')?.classList.add('show');
}

/** Hide the add/edit script modal */
function hideModal(): void {
  document.getElementById('scriptModal')?.classList.remove('show');
  currentEditingScript = null;
  (document.getElementById('scriptForm') as HTMLFormElement).reset();
  (document.getElementById('modalTitle') as HTMLElement).textContent = '添加新脚本';
}

/** Save script (add or update) */
async function saveScript(): Promise<void> {
  const name = (document.getElementById('scriptName') as HTMLInputElement).value.trim();
  const matchesText = (document.getElementById('scriptMatches') as HTMLTextAreaElement).value.trim();
  const excludesText = (document.getElementById('scriptExcludes') as HTMLTextAreaElement).value.trim();
  const code = (document.getElementById('scriptCode') as HTMLTextAreaElement).value.trim();

  if (!name || !code) {
    showError('脚本名称和代码不能为空');
    return;
  }

  const matches = matchesText ? matchesText.split('\n').map((s) => s.trim()).filter((s) => s) : [];
  const excludes = excludesText ? excludesText.split('\n').map((s) => s.trim()).filter((s) => s) : [];

  const scriptData = { name, matches, excludes, code };

  try {
    let response: unknown;
    if (currentEditingScript) {
      response = await sendMessage({ type: 'UPDATE_SCRIPT', id: currentEditingScript.id, script: scriptData });
    } else {
      response = await sendMessage({ type: 'ADD_SCRIPT', script: scriptData });
    }
    if ((response as any).success) {
      hideModal();
      await loadScripts();
      showSuccess(currentEditingScript ? '脚本已更新' : '脚本已添加');
    } else {
      throw new Error((response as any).error || 'Failed to save script');
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error saving script:', error);
    showError('保存脚本失败: ' + (error as Error).message);
  }
}

/** Setup event listeners */
function setupEventListeners(): void {
  document.getElementById('addScriptBtn')?.addEventListener('click', showModal);
  document.getElementById('addFirstScriptBtn')?.addEventListener('click', showModal);
  document.getElementById('closeModal')?.addEventListener('click', hideModal);
  document.getElementById('cancelBtn')?.addEventListener('click', hideModal);
  document.getElementById('saveBtn')?.addEventListener('click', saveScript);
  document.getElementById('reloadBtn')?.addEventListener('click', loadScripts);
  document.getElementById('exportBtn')?.addEventListener('click', exportScripts);
  document.getElementById('importBtn')?.addEventListener('click', importScripts);

  document.getElementById('scriptModal')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'scriptModal') {
      hideModal();
    }
  });

  document.getElementById('scriptForm')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e as KeyboardEvent).ctrlKey) {
      e.preventDefault();
      saveScript();
    }
  });
}

/** Export scripts to JSON file */
async function exportScripts(): Promise<void> {
  try {
    const response = await sendMessage({ type: 'GET_SCRIPTS' });
    if ((response as any).success) {
      const dataStr = JSON.stringify((response as any).scripts, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `userscripts_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      showSuccess('脚本已导出');
    } else {
      throw new Error((response as any).error || 'Failed to export scripts');
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error exporting scripts:', error);
    showError('导出脚本失败: ' + (error as Error).message);
  }
}

/** Import scripts from JSON file */
function importScripts(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const scripts = JSON.parse(text);
      if (!Array.isArray(scripts)) {
        throw new Error('Invalid file format');
      }
      for (const script of scripts) {
        await sendMessage({
          type: 'ADD_SCRIPT',
          script: {
            name: script.name,
            matches: script.matches,
            excludes: script.excludes,
            code: script.code,
          },
        });
      }
      await loadScripts();
      showSuccess(`成功导入 ${scripts.length} 个脚本`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error importing scripts:', error);
      showError('导入脚本失败: ' + (error as Error).message);
    }
  };
  input.click();
}

/** Update script count display */
function updateScriptCount(count: number): void {
  const el = document.getElementById('scriptCount');
  if (el) el.textContent = String(count);
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
  const successEl = document.getElementById('success') as HTMLElement;
  successEl.style.display = 'none';
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  setTimeout(() => {
    errorEl.style.display = 'none';
  }, 5000);
}

/** Show success message */
function showSuccess(message: string): void {
  const errorEl = document.getElementById('error') as HTMLElement;
  const successEl = document.getElementById('success') as HTMLElement;
  errorEl.style.display = 'none';
  successEl.textContent = message;
  successEl.style.display = 'block';
  setTimeout(() => {
    successEl.style.display = 'none';
  }, 3000);
}

/** Escape HTML to prevent XSS */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Format date for display */
function formatDate(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN');
}


