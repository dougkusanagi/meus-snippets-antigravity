/* ============================================================
   guepardosys-snip — Manager Logic
   ============================================================ */

(function () {
  'use strict';

  // ---- State ----
  let snippets = [];
  let selectedId = null;
  let isNewSnippet = false;

  // ---- DOM refs ----
  const sidebar = () => document.getElementById('snippet-list');
  const searchInput = () => document.getElementById('sidebar-search');
  const editorPanel = () => document.getElementById('editor-panel');
  const emptyState = () => document.getElementById('empty-state');
  const editorTitle = () => document.getElementById('editor-title');
  const triggerInput = () => document.getElementById('input-trigger');
  const nameInput = () => document.getElementById('input-name');
  const btnSave = () => document.getElementById('btn-save');
  const btnDelete = () => document.getElementById('btn-delete');
  const btnNew = () => document.getElementById('btn-new-snippet');
  const toastContainer = () => document.getElementById('toast-container');
  const permissionBanner = () => document.getElementById('permission-banner');
  const bannerTitle = () => document.getElementById('banner-title');
  const bannerDescription = () => document.getElementById('banner-description');
  const btnOpenSettings = () => document.getElementById('btn-open-settings');
  const btnCloseBanner = () => document.getElementById('btn-close-banner');
  const btnSettings = () => document.getElementById('btn-settings');
  const settingsPanel = () => document.getElementById('settings-panel');
  const shortcutInput = () => document.getElementById('input-shortcut');
  const btnResetShortcut = () => document.getElementById('btn-reset-shortcut');

  let isMac = navigator.userAgent.indexOf('Mac') !== -1;

  // ---- Tauri API ----
  function invoke(cmd, args) {
    return window.__TAURI__.core.invoke(cmd, args || {});
  }

  // ---- Toast notifications ----
  function showToast(message, type = 'success') {
    const container = toastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      toast.addEventListener('animationend', () => toast.remove());
    }, 2500);
  }

  // ---- Load snippets ----
  async function loadSnippets() {
    try {
      snippets = await invoke('get_snippets');
    } catch (err) {
      console.error('Failed to load snippets:', err);
      snippets = [];
    }
    renderList();
  }

  // ---- Render snippet list ----
  function renderList() {
    const list = sidebar();
    const filter = (searchInput().value || '').toLowerCase().trim();

    let filtered = snippets;
    if (filter) {
      filtered = snippets.filter(s =>
        s.trigger.toLowerCase().includes(filter) ||
        s.name.toLowerCase().includes(filter)
      );
    }

    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="snippet-list-empty">
          <div class="empty-icon">📋</div>
          ${filter ? 'Nenhum snippet encontrado' : 'Nenhum snippet ainda.<br>Crie o primeiro!'}
        </div>
      `;
      return;
    }

    list.innerHTML = filtered.map(s => `
      <div class="snippet-item ${s.id === selectedId ? 'active' : ''}"
           data-id="${s.id}">
        <div class="snippet-trigger">${escapeHtml(s.trigger)}</div>
        <div class="snippet-name">${escapeHtml(s.name)}</div>
      </div>
    `).join('');

    // Click handlers
    list.querySelectorAll('.snippet-item').forEach(item => {
      item.addEventListener('click', () => {
        selectSnippet(item.dataset.id);
      });
    });
  }

  // ---- Panel Switcher ----
  function showPanel(panelName) {
    if (panelName === 'editor') {
      editorPanel().classList.add('visible');
      emptyState().style.display = 'none';
      settingsPanel().classList.remove('visible');
      btnSettings().classList.remove('active');
    } else if (panelName === 'settings') {
      editorPanel().classList.remove('visible');
      emptyState().style.display = 'none';
      settingsPanel().classList.add('visible');
      btnSettings().classList.add('active');
      selectedId = null;
      isNewSnippet = false;
      renderList();
    } else {
      editorPanel().classList.remove('visible');
      emptyState().style.display = '';
      settingsPanel().classList.remove('visible');
      btnSettings().classList.remove('active');
      selectedId = null;
      isNewSnippet = false;
      renderList();
    }
  }

  // ---- Select snippet ----
  function selectSnippet(id) {
    const snippet = snippets.find(s => s.id === id);
    if (!snippet) return;

    selectedId = id;
    isNewSnippet = false;

    showPanel('editor');

    editorTitle().textContent = 'Editar Snippet';
    triggerInput().value = snippet.trigger;
    nameInput().value = snippet.name;
    btnDelete().style.display = 'inline-flex';

    // Load actions into macro editor
    window.macroEditor.deserialize(snippet.actions);

    // Update active state in list
    renderList();
  }

  // ---- New snippet ----
  function newSnippet() {
    selectedId = null;
    isNewSnippet = true;

    showPanel('editor');

    editorTitle().textContent = 'Novo Snippet';
    triggerInput().value = '';
    nameInput().value = '';
    btnDelete().style.display = 'none';

    window.macroEditor.clear();
    triggerInput().focus();

    renderList();
  }

  // ---- Save snippet ----
  async function saveSnippet() {
    const trigger = triggerInput().value.trim();
    const name = nameInput().value.trim();

    if (!trigger) {
      showToast('O gatilho é obrigatório!', 'error');
      triggerInput().focus();
      return;
    }

    if (!name) {
      showToast('O nome é obrigatório!', 'error');
      nameInput().focus();
      return;
    }

    const actions = window.macroEditor.serialize();

    try {
      if (isNewSnippet) {
        const newId = await invoke('add_snippet', {
          trigger,
          name,
          actions,
        });
        selectedId = newId;
        isNewSnippet = false;
        showToast('Snippet criado com sucesso!');
      } else {
        await invoke('update_snippet', {
          id: selectedId,
          trigger,
          name,
          actions,
        });
        showToast('Snippet atualizado!');
      }

      await loadSnippets();
      editorTitle().textContent = 'Editar Snippet';
      btnDelete().style.display = 'inline-flex';
    } catch (err) {
      console.error('Failed to save snippet:', err);
      showToast('Erro ao salvar: ' + err, 'error');
    }
  }

  // ---- Delete snippet ----
  async function deleteSnippet() {
    if (!selectedId) return;

    try {
      await invoke('delete_snippet', { id: selectedId });
      showToast('Snippet removido!');
      selectedId = null;
      isNewSnippet = false;

      showPanel('empty');

      await loadSnippets();
    } catch (err) {
      console.error('Failed to delete snippet:', err);
      showToast('Erro ao remover: ' + err, 'error');
    }
  }

  // ---- Settings Panel Logic ----
  async function showSettings() {
    showPanel('settings');
    
    try {
      shortcutInput().value = 'Carregando...';
      const shortcut = await invoke('get_shortcut');
      shortcutInput().value = formatShortcutForDisplay(shortcut);
    } catch (err) {
      console.error('Failed to load shortcut:', err);
      shortcutInput().value = isMac ? 'Command+;' : 'Ctrl+;';
      showToast('Erro ao carregar atalho: ' + err, 'error');
    }
  }

  function formatShortcutForDisplay(shortcut) {
    return shortcut
      .replace(/CommandOrControl/i, isMac ? 'Cmd' : 'Ctrl')
      .replace(/Command/i, 'Cmd')
      .replace(/Super/i, isMac ? 'Cmd' : 'Win')
      .replace(/Meta/i, isMac ? 'Cmd' : 'Win');
  }

  async function saveShortcut(shortcutStr) {
    try {
      await invoke('set_shortcut', { shortcut: shortcutStr });
      showToast('Atalho atualizado com sucesso!');
    } catch (err) {
      console.error('Failed to save shortcut:', err);
      showToast('Falha ao registrar atalho: ' + err, 'error');
      await showSettings();
    }
  }

  function setupShortcutRecorder() {
    const input = shortcutInput();
    
    input.addEventListener('keydown', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const key = e.key;
      const code = e.code;
      
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
        let parts = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        if (e.metaKey) parts.push(isMac ? 'Cmd' : 'Win');
        input.value = parts.join('+') + '+...';
        return;
      }
      
      let parts = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push(isMac ? 'Cmd' : 'Win');
      
      let keyName = '';
      if (code.startsWith('Key')) {
        keyName = code.slice(3);
      } else if (code.startsWith('Digit')) {
        keyName = code.slice(5);
      } else {
        switch (code) {
          case 'Space': keyName = 'Space'; break;
          case 'Enter': keyName = 'Enter'; break;
          case 'Escape': keyName = 'Escape'; break;
          case 'Tab': keyName = 'Tab'; break;
          case 'Backspace': keyName = 'Backspace'; break;
          case 'Delete': keyName = 'Delete'; break;
          case 'Insert': keyName = 'Insert'; break;
          case 'Home': keyName = 'Home'; break;
          case 'End': keyName = 'End'; break;
          case 'PageUp': keyName = 'PageUp'; break;
          case 'PageDown': keyName = 'PageDown'; break;
          case 'ArrowUp': keyName = 'Up'; break;
          case 'ArrowDown': keyName = 'Down'; break;
          case 'ArrowLeft': keyName = 'Left'; break;
          case 'ArrowRight': keyName = 'Right'; break;
          case 'Semicolon': keyName = ';'; break;
          case 'Comma': keyName = ','; break;
          case 'Period': keyName = '.'; break;
          case 'Slash': keyName = '/'; break;
          case 'Equal': keyName = '='; break;
          case 'Minus': keyName = '-'; break;
          case 'BracketLeft': keyName = '['; break;
          case 'BracketRight': keyName = ']'; break;
          case 'Quote': keyName = '\''; break;
          case 'Backquote': keyName = '`'; break;
          case 'Backslash': keyName = '\\'; break;
          default:
            if (key.length === 1) {
              keyName = key.toUpperCase();
            } else {
              keyName = key;
            }
        }
      }
      
      parts.push(keyName);
      
      const hasModifier = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
      const isFKey = /^F[1-9][0-2]?$/.test(keyName);
      
      if (hasModifier || isFKey) {
        const finalShortcut = parts.join('+');
        input.value = finalShortcut;
        await saveShortcut(finalShortcut);
        input.blur();
      } else {
        input.value = parts.join('+') + ' (adicione modificador)';
      }
    });

    btnResetShortcut().addEventListener('click', async () => {
      const defaultShortcut = isMac ? 'Command+;' : 'Ctrl+;';
      input.value = formatShortcutForDisplay(defaultShortcut);
      await saveShortcut(defaultShortcut);
    });
  }

  // ---- Helpers ----
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Platform info check ----
  async function checkPlatform() {
    try {
      const info = await invoke('get_platform_info');
      if (info.needsPermission) {
        // Check if user has closed it for this session
        if (sessionStorage.getItem('hide-permission-banner') === 'true') {
          return;
        }

        const banner = permissionBanner();
        banner.style.display = 'block';

        if (info.permissionType === 'linux-wayland') {
          bannerTitle().textContent = 'Atalhos Globais & Teclado no Linux Wayland';
          bannerDescription().innerHTML = `Para usar o atalho <strong>Ctrl+;</strong> em segundo plano, adicione um atalho personalizado no sistema apontando para: <code>guepardosys-snip --toggle</code>. E conceda permissão de <strong>Controle Remoto</strong> quando solicitado.`;
        } else if (info.permissionType === 'macos-accessibility') {
          bannerTitle().textContent = 'Acessibilidade no macOS';
          bannerDescription().textContent = `Para expandir snippets, o aplicativo precisa de permissão de Acessibilidade nas configurações de Privacidade e Segurança do macOS.`;
        }

        // Open settings click
        btnOpenSettings().onclick = async () => {
          try {
            const result = await invoke('open_system_settings');
            if (result === 'registered') {
              showToast('Atalho Ctrl+; cadastrado automaticamente!');
              banner.style.display = 'none';
              sessionStorage.setItem('hide-permission-banner', 'true');
            } else {
              showToast('Abrindo configurações do sistema...');
            }
          } catch (err) {
            console.error('Failed to open settings:', err);
            showToast('Erro ao configurar: ' + err, 'error');
          }
        };

        // Close click
        btnCloseBanner().onclick = () => {
          banner.style.display = 'none';
          sessionStorage.setItem('hide-permission-banner', 'true');
        };
      }
    } catch (err) {
      console.error('Failed to get platform info:', err);
    }
  }

  // ---- Init ----
  function init() {
    // Initialize macro editor
    window.macroEditor.init('macro-editor-container');

    // Event listeners
    btnNew().addEventListener('click', newSnippet);
    btnSave().addEventListener('click', saveSnippet);
    btnDelete().addEventListener('click', deleteSnippet);
    searchInput().addEventListener('input', renderList);
    btnSettings().addEventListener('click', showSettings);

    // Setup gravador de atalho
    setupShortcutRecorder();

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+S to save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (editorPanel().classList.contains('visible')) {
          saveSnippet();
        }
      }
      // Ctrl+N for new snippet
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        newSnippet();
      }
    });

    // Check platform permissions
    checkPlatform();

    // Load snippets
    loadSnippets();
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
