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
          <div class="empty-icon"><i data-lucide="clipboard-list"></i></div>
          ${filter ? 'Nenhum snippet encontrado' : 'Nenhum snippet ainda.<br>Crie o primeiro!'}
        </div>
      `;
      if (window.lucide) {
        window.lucide.createIcons();
      }
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

    if (window.lucide) {
      window.lucide.createIcons();
    }
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
      shortcutInput().textContent = 'Carregando...';
      const config = await invoke('get_shortcut');
      shortcutInput().textContent = config.display || formatShortcutForDisplay(config.shortcut);
      await checkAndShowConflicts();
    } catch (err) {
      console.error('Failed to load shortcut:', err);
      shortcutInput().textContent = isMac ? 'Command+;' : 'Ctrl+;';
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

  async function saveShortcut(shortcutStr, displayStr) {
    try {
      await invoke('set_shortcut', { shortcut: shortcutStr, display: displayStr });
      showToast('Atalho atualizado com sucesso!');
    } catch (err) {
      console.error('Failed to save shortcut:', err);
      showToast('Falha ao registrar atalho: ' + err, 'error');
      await showSettings();
    }
  }

  function getPhysicalKeyName(code) {
    if (code.startsWith('Key')) {
      return code.slice(3).toUpperCase();
    }
    if (code.startsWith('Digit')) {
      return code.slice(5);
    }
    const upper = code.toUpperCase();
    switch (upper) {
      case 'SEMICOLON': return 'Semicolon';
      case 'COMMA': return 'Comma';
      case 'PERIOD': return 'Period';
      case 'SLASH': return 'Slash';
      case 'EQUAL': return 'Equal';
      case 'MINUS': return 'Minus';
      case 'BRACKETLEFT': return 'BracketLeft';
      case 'BRACKETRIGHT': return 'BracketRight';
      case 'QUOTE': return 'Quote';
      case 'BACKQUOTE': return 'Backquote';
      case 'BACKSLASH': return 'Backslash';
      case 'INTLRO': return 'IntlRo';
      case 'INTLBACKSLASH': return 'IntlBackslash';
      case 'ARROWUP': return 'Up';
      case 'ARROWDOWN': return 'Down';
      case 'ARROWLEFT': return 'Left';
      case 'ARROWRIGHT': return 'Right';
      case 'SPACE': return 'Space';
      case 'ENTER': return 'Enter';
      case 'ESCAPE': return 'Escape';
      case 'TAB': return 'Tab';
      case 'BACKSPACE': return 'Backspace';
      case 'DELETE': return 'Delete';
      case 'INSERT': return 'Insert';
      case 'HOME': return 'Home';
      case 'END': return 'End';
      case 'PAGEUP': return 'PageUp';
      case 'PAGEDOWN': return 'PageDown';
      default:
        return code;
    }
  }

  function getDisplayKeyName(e) {
    let key = e.key;
    const code = e.code;
    
    const namedKeys = {
      'Space': 'Space',
      ' ': 'Space',
      'Enter': 'Enter',
      'Escape': 'Esc',
      'Esc': 'Esc',
      'Tab': 'Tab',
      'Backspace': 'Backspace',
      'Delete': 'Del',
      'Del': 'Del',
      'Insert': 'Ins',
      'Ins': 'Ins',
      'Home': 'Home',
      'End': 'End',
      'PageUp': 'PageUp',
      'PageDown': 'PageDown',
      'ArrowUp': 'Up',
      'ArrowDown': 'Down',
      'ArrowLeft': 'Left',
      'ArrowRight': 'Right',
    };
    
    if (namedKeys[code]) return namedKeys[code];
    if (namedKeys[key]) return namedKeys[key];
    
    if (/^F[1-9][0-2]?$/.test(code) || /^F[1-9][0-2]?$/.test(key)) {
      return code.toUpperCase();
    }
    
    // Normalize shifted symbols back to base symbols if Shift modifier is active
    if (e.shiftKey && key.length === 1) {
      const shiftedToUnshifted = {
        ':': ';',
        '?': '/',
        '>': '.',
        '<': ',',
        '+': '=',
        '_': '-',
        '}': ']',
        '{': '[',
        '"': "'",
        '|': '\\',
        '~': '`',
        '^': '~',
      };
      if (shiftedToUnshifted[key]) {
        key = shiftedToUnshifted[key];
      }
    }
    
    if (key.length === 1) {
      return key.toUpperCase();
    }
    
    return key;
  }

  function setupShortcutRecorder() {
    const input = shortcutInput();
    let isSaving = false;

    input.addEventListener('focus', async () => {
      isSaving = false;
      try {
        await invoke('set_shortcut_recording_active', { active: true });
        await invoke('disable_global_shortcut');
      } catch (err) {
        console.error('Failed to disable global shortcut:', err);
      }
    });

    input.addEventListener('blur', async () => {
      setTimeout(async () => {
        if (isSaving) return;
        try {
          await invoke('set_shortcut_recording_active', { active: false });
          await invoke('enable_global_shortcut');
          await showSettings();
        } catch (err) {
          console.error('Failed to enable global shortcut:', err);
        }
      }, 150);
    });
    
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
        input.textContent = parts.join('+') + '+...';
        return;
      }
      
      let physicalParts = [];
      let displayParts = [];
      
      if (e.ctrlKey) {
        physicalParts.push('Ctrl');
        displayParts.push('Ctrl');
      }
      if (e.altKey) {
        physicalParts.push('Alt');
        displayParts.push('Alt');
      }
      if (e.shiftKey) {
        physicalParts.push('Shift');
        displayParts.push('Shift');
      }
      if (e.metaKey) {
        physicalParts.push(isMac ? 'Cmd' : 'Win');
        displayParts.push(isMac ? 'Cmd' : 'Win');
      }
      
      const physicalKeyName = getPhysicalKeyName(code);
      const displayKeyName = getDisplayKeyName(e);
      
      physicalParts.push(physicalKeyName);
      displayParts.push(displayKeyName);
      
      const hasModifier = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
      const isFKey = /^F[1-9][0-2]?$/.test(physicalKeyName);
      
      if (hasModifier || isFKey) {
        const finalShortcut = physicalParts.join('+');
        const displayShortcut = displayParts.join('+');
        input.textContent = displayShortcut;
        isSaving = true;
        await invoke('set_shortcut_recording_active', { active: false });
        await saveShortcut(finalShortcut, displayShortcut);
        input.blur();
      } else {
        input.textContent = displayParts.join('+') + ' (adicione modificador)';
      }
    });

    btnResetShortcut().addEventListener('click', async () => {
      const defaultShortcut = isMac ? 'Command+;' : 'Ctrl+;';
      input.textContent = formatShortcutForDisplay(defaultShortcut);
      isSaving = true;
      await invoke('set_shortcut_recording_active', { active: false });
      await saveShortcut(defaultShortcut, defaultShortcut);
      input.blur();
    });
  }

  // ---- Onboarding Wizard ----
  let currentStep = 1;
  let needsPermissionStep = false;
  let platformInfo = null;
  let wizardIsSaving = false;
  let wizardPhysicalShortcut = '';
  let wizardDisplayShortcut = '';

  async function checkPlatformForWizard() {
    try {
      platformInfo = await invoke('get_platform_info');
      needsPermissionStep = platformInfo.needsPermission;
    } catch (err) {
      console.error(err);
      needsPermissionStep = false;
    }
  }

  async function checkOnboarding() {
    try {
      const config = await invoke('get_shortcut');
      await checkPlatformForWizard();
      if (!config.onboardingCompleted) {
        showWizard();
      }
    } catch (err) {
      console.error('Failed to check onboarding:', err);
    }
  }

  function showWizard() {
    const overlay = document.getElementById('wizard-overlay');
    overlay.classList.add('visible');
    currentStep = 1;
    wizardIsSaving = false;
    wizardPhysicalShortcut = '';
    wizardDisplayShortcut = '';
    renderWizardStep();
  }

  function renderWizardStep() {
    // Hide all steps
    document.querySelectorAll('.wizard-step').forEach(step => {
      step.classList.remove('active');
    });
    
    // Show current step
    const stepEl = document.querySelector(`.wizard-step[data-step="${currentStep}"]`);
    if (stepEl) stepEl.classList.add('active');
    
    // Update progress bar
    const progressEl = document.getElementById('wizard-progress-bar');
    progressEl.style.width = `${(currentStep / 4) * 100}%`;
    
    // Update buttons
    const btnPrev = document.getElementById('wizard-btn-prev');
    const btnNext = document.getElementById('wizard-btn-next');
    
    if (currentStep === 1) {
      btnPrev.style.visibility = 'hidden';
      btnNext.textContent = 'Começar';
    } else if (currentStep === 4) {
      btnPrev.style.visibility = 'hidden';
      btnNext.textContent = 'Concluir';
    } else {
      btnPrev.style.visibility = 'visible';
      btnNext.textContent = 'Avançar';
    }
    
    // Specific step load logic
    if (currentStep === 2) {
      loadWizardPermissions();
    }
    
    if (currentStep === 3) {
      loadWizardShortcut();
    }
  }

  function loadWizardPermissions() {
    const box = document.getElementById('wizard-permission-box');
    if (!platformInfo) return;
    
    if (platformInfo.permissionType === 'linux-wayland') {
      box.innerHTML = `
        <div class="wizard-permission-actions">
          <div class="wizard-permission-title">1. Permitir Interação Remota (Obrigatório)</div>
          <p class="wizard-permission-desc">Para que o aplicativo possa digitar textos e executar ações de teclado no Wayland, <strong>a permissão de Controle Remoto deve estar ATIVADA</strong>. Sem ela, os macros não funcionarão.</p>
          
          <div style="background: rgba(245, 159, 0, 0.08); border: 1px solid rgba(245, 159, 0, 0.25); border-radius: var(--radius-md); padding: 12px 16px; margin: 12px 0; font-size: 13px;">
            <div style="display: flex; align-items: flex-start; gap: 10px;">
              <span style="color: var(--accent); font-size: 16px; margin-top: 2px;"><i data-lucide="alert-triangle"></i></span>
              <div>
                <strong style="color: var(--accent);">Importante:</strong>
                <p style="margin: 4px 0 0; color: var(--text-secondary); line-height: 1.4;">Quando esta opção está ativada, um <strong>ícone amarelo</strong> aparece na bandeja do sistema. Clicando nele, você pode desativar facilmente o Controle Remoto. <strong>Não desative</strong>, ou os macros pararão de funcionar!</p>
              </div>
            </div>
          </div>
          
          <!-- GNOME Dialog Mockup -->
          <div class="gnome-dialog-mockup">
            <div class="gnome-dialog-header">
              <span class="gnome-btn-cancel" id="gnome-mock-cancel">Cancelar</span>
              <span class="gnome-dialog-title">Área de trabalho remota</span>
              <span class="gnome-btn-share disabled" id="gnome-mock-share">Compartilhar</span>
            </div>
            <div class="gnome-dialog-body">
              <div class="gnome-row focus-ring">
                <span class="gnome-row-label">Permitir interação remota</span>
                <div class="gnome-toggle" id="gnome-mock-toggle" role="checkbox" aria-checked="false" tabindex="0">
                  <span class="gnome-toggle-thumb"></span>
                </div>
              </div>
            </div>
          </div>
          <div class="gnome-mockup-guide">Guia: Ative o switch e clique em Compartilhar para ver como funciona! No diálogo real, faça exatamente o mesmo.</div>

          <button id="wizard-btn-trigger-perm" class="btn btn-primary btn-sm" type="button" style="margin-top: 16px; margin-bottom: 16px; width: 100%;">
            <i data-lucide="shield-alert"></i> Disparar Solicitação de Permissão
          </button>

          <div class="wizard-permission-title" style="border-top: 1px solid var(--border-subtle); padding-top: 16px;">2. Cadastrar Atalho no Sistema (Wayland)</div>
          <p class="wizard-permission-desc">Para abrir a busca quando o app estiver em segundo plano, clique abaixo e adicione um atalho de teclado personalizado no sistema com o comando de ativação.</p>
          <button id="wizard-btn-open-sys-settings" class="btn btn-secondary" type="button" style="width: 100%;">
            <i data-lucide="settings"></i> Abrir Configurações de Atalhos
          </button>
        </div>
      `;
      
      const mockToggle = document.getElementById('gnome-mock-toggle');
      const mockShare = document.getElementById('gnome-mock-share');
      const mockCancel = document.getElementById('gnome-mock-cancel');
      
      mockToggle.onclick = () => {
        const isActive = mockToggle.classList.toggle('active');
        mockToggle.setAttribute('aria-checked', isActive ? 'true' : 'false');
        if (isActive) {
          mockShare.classList.remove('disabled');
          showToast('Mockup ativado! Agora clique em Compartilhar.');
        } else {
          mockShare.classList.add('disabled');
        }
      };
      
      mockShare.onclick = () => {
        if (!mockShare.classList.contains('disabled')) {
          showToast('Muito bem! No diálogo real que aparecer, faça exatamente isso.');
        }
      };

      mockCancel.onclick = () => {
        showToast('Não cancele no diálogo real, ou os macros não poderão digitar textos!');
      };
      
      document.getElementById('wizard-btn-trigger-perm').onclick = async () => {
        try {
          await invoke('trigger_permission_check');
          showToast('Solicitação enviada! Ative a opção e clique em Compartilhar.');
        } catch (err) {
          console.error(err);
          showToast('Erro ao disparar permissão: ' + err, 'error');
        }
      };
      
      document.getElementById('wizard-btn-open-sys-settings').onclick = async () => {
        try {
          const result = await invoke('open_system_settings');
          if (result === 'registered') {
            showToast('Atalho cadastrado no GNOME com sucesso!');
          } else {
            showToast('Configurações abertas!');
          }
        } catch (err) {
          console.error(err);
          showToast('Erro ao abrir configurações: ' + err, 'error');
        }
      };
    } else if (platformInfo.permissionType === 'macos-accessibility') {
      box.innerHTML = `
        <div class="wizard-permission-actions">
          <div class="wizard-permission-title">Habilitar Acessibilidade</div>
          <p class="wizard-permission-desc">O aplicativo precisa de permissão de Acessibilidade no macOS para que possa expandir seus snippets de texto em outras janelas.</p>
          <button id="wizard-btn-open-sys-settings" class="btn btn-primary btn-sm" type="button" style="width: 100%;">
            <i data-lucide="settings"></i> Abrir Preferências do macOS
          </button>
        </div>
      `;
      
      document.getElementById('wizard-btn-open-sys-settings').onclick = async () => {
        try {
          await invoke('open_system_settings');
          showToast('Abrindo Preferências do Sistema...');
        } catch (err) {
          console.error(err);
          showToast('Erro ao abrir configurações: ' + err, 'error');
        }
      };
    } else {
      box.innerHTML = `
        <div style="text-align: center; padding: 10px; color: var(--text-secondary);">
          Nenhuma permissão especial necessária no seu sistema operacional!
        </div>
      `;
    }
    
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  async function loadWizardShortcut() {
    const input = document.getElementById('wizard-shortcut-input');
    try {
      const config = await invoke('get_shortcut');
      wizardPhysicalShortcut = config.shortcut;
      wizardDisplayShortcut = config.display || formatShortcutForDisplay(config.shortcut);
      input.textContent = wizardDisplayShortcut;
      await checkAndShowConflicts();
    } catch (err) {
      console.error(err);
    }
  }

  function setupWizard() {
    const btnPrev = document.getElementById('wizard-btn-prev');
    const btnNext = document.getElementById('wizard-btn-next');
    const btnOpenWizard = document.getElementById('btn-open-wizard');
    const wizardInput = document.getElementById('wizard-shortcut-input');
    
    btnPrev.addEventListener('click', () => {
      let prevStep = currentStep - 1;
      if (prevStep === 2 && !needsPermissionStep) {
        prevStep = 1;
      }
      if (prevStep >= 1) {
        currentStep = prevStep;
        renderWizardStep();
      }
    });
    
    btnNext.addEventListener('click', async () => {
      if (currentStep === 3) {
        // Save the shortcut recorded in step 3
        try {
          if (wizardPhysicalShortcut && wizardDisplayShortcut) {
            await invoke('set_shortcut', { shortcut: wizardPhysicalShortcut, display: wizardDisplayShortcut });
          }
        } catch (err) {
          console.error('Failed to save wizard shortcut:', err);
          showToast('Falha ao salvar atalho: ' + err, 'error');
          return;
        }
      }
      
      if (currentStep === 4) {
        // Mark onboarding completed and close overlay
        try {
          await invoke('set_onboarding_completed', { completed: true });
          document.getElementById('wizard-overlay').classList.remove('visible');
          showToast('Configuração concluída!');
          checkPlatform(); // refresh banner if needed
        } catch (err) {
          console.error(err);
        }
        return;
      }
      
      let nextStep = currentStep + 1;
      if (nextStep === 2 && !needsPermissionStep) {
        nextStep = 3;
      }
      
      if (nextStep <= 4) {
        currentStep = nextStep;
        renderWizardStep();
      }
    });

    btnOpenWizard.addEventListener('click', async () => {
      await checkPlatformForWizard();
      // When opened from settings, always show permissions step on Wayland
      // (user may need to re-grant or learn about remote interaction)
      if (platformInfo && platformInfo.permissionType === 'linux-wayland') {
        needsPermissionStep = true;
      }
      showWizard();
    });

    const btnResetWizardShortcut = document.getElementById('wizard-btn-reset-shortcut');
    btnResetWizardShortcut.addEventListener('click', async () => {
      const defaultShortcut = isMac ? 'Command+;' : 'Ctrl+;';
      wizardInput.textContent = formatShortcutForDisplay(defaultShortcut);
      wizardPhysicalShortcut = defaultShortcut;
      wizardDisplayShortcut = defaultShortcut;
      wizardIsSaving = true;
      await invoke('set_shortcut_recording_active', { active: false });
      wizardInput.blur();
    });

    wizardInput.addEventListener('focus', async () => {
      wizardIsSaving = false;
      try {
        await invoke('set_shortcut_recording_active', { active: true });
        await invoke('disable_global_shortcut');
      } catch (err) {
        console.error(err);
      }
    });

    wizardInput.addEventListener('blur', async () => {
      setTimeout(async () => {
        if (wizardIsSaving) return;
        try {
          await invoke('set_shortcut_recording_active', { active: false });
          await invoke('enable_global_shortcut');
        } catch (err) {
          console.error(err);
        }
      }, 150);
    });

    wizardInput.addEventListener('keydown', async (e) => {
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
        wizardInput.textContent = parts.join('+') + '+...';
        return;
      }
      
      let physicalParts = [];
      let displayParts = [];
      
      if (e.ctrlKey) {
        physicalParts.push('Ctrl');
        displayParts.push('Ctrl');
      }
      if (e.altKey) {
        physicalParts.push('Alt');
        displayParts.push('Alt');
      }
      if (e.shiftKey) {
        physicalParts.push('Shift');
        displayParts.push('Shift');
      }
      if (e.metaKey) {
        physicalParts.push(isMac ? 'Cmd' : 'Win');
        displayParts.push(isMac ? 'Cmd' : 'Win');
      }
      
      const physicalKeyName = getPhysicalKeyName(code);
      const displayKeyName = getDisplayKeyName(e);
      
      physicalParts.push(physicalKeyName);
      displayParts.push(displayKeyName);
      
      const hasModifier = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
      const isFKey = /^F[1-9][0-2]?$/.test(physicalKeyName);
      
      if (hasModifier || isFKey) {
        wizardPhysicalShortcut = physicalParts.join('+');
        wizardDisplayShortcut = displayParts.join('+');
        wizardInput.textContent = wizardDisplayShortcut;
        wizardIsSaving = true;
        await invoke('set_shortcut_recording_active', { active: false });
        wizardInput.blur();
      } else {
        wizardInput.textContent = displayParts.join('+') + ' (adicione modificador)';
      }
    });

    // Conflict resolution event handlers
    const btnResolveSettings = document.getElementById('btn-resolve-settings-conflict');
    if (btnResolveSettings) {
      btnResolveSettings.addEventListener('click', resolveAllConflicts);
    }
    const btnResolveWizard = document.getElementById('btn-resolve-wizard-conflict');
    if (btnResolveWizard) {
      btnResolveWizard.addEventListener('click', resolveAllConflicts);
    }
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
          bannerDescription().innerHTML = `Para usar o atalho <strong>Ctrl+;</strong> em segundo plano, adicione um atalho personalizado no sistema apontando para: <code>guepardosys-snip --toggle</code>. E conceda permissão de <strong>Controle Remoto</strong> quando solicitado. <span style="color: var(--accent);">⚠ Não desative pelo ícone amarelo na bandeja!</span>`;
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

    // Setup onboarding wizard
    setupWizard();

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

    // Check onboarding status
    checkOnboarding();

    // Check platform permissions
    checkPlatform();

    // Load snippets
    loadSnippets();

    // Initial Lucide icon generation for static layout
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  async function checkAndShowConflicts() {
    try {
      const conflicts = await invoke('check_keyboard_conflicts');
      
      const settingsAlert = document.getElementById('settings-conflict-alert');
      const settingsDesc = document.getElementById('settings-conflict-desc');
      const wizardAlert = document.getElementById('wizard-conflict-alert');
      const wizardDesc = document.getElementById('wizard-conflict-desc');
      
      let conflictText = '';
      if (conflicts.hasAltSpaceConflict && conflicts.hasCtrlSemicolonConflict) {
        conflictText = 'Os atalhos <strong>Alt+Espaço</strong> (menu de janela) e <strong>Ctrl+;</strong> (seletor de emojis do sistema) estão reservados pelo GNOME. Isso impedirá que você grave ou use esses atalhos.';
      } else if (conflicts.hasAltSpaceConflict) {
        conflictText = 'O atalho <strong>Alt+Espaço</strong> está reservado pelo GNOME (menu de janela). Isso impedirá que você grave ou use essa combinação.';
      } else if (conflicts.hasCtrlSemicolonConflict) {
        conflictText = 'O atalho <strong>Ctrl+;</strong> está reservado pelo GNOME/IBus (seletor de emojis do sistema). Isso impedirá que você grave ou use essa combinação.';
      }
      
      if (conflictText) {
        if (settingsAlert && settingsDesc) {
          settingsDesc.innerHTML = conflictText;
          settingsAlert.style.display = 'block';
        }
        if (wizardAlert && wizardDesc) {
          wizardDesc.innerHTML = conflictText;
          wizardAlert.style.display = 'block';
        }
      } else {
        if (settingsAlert) settingsAlert.style.display = 'none';
        if (wizardAlert) wizardAlert.style.display = 'none';
      }
    } catch (err) {
      console.error('Failed to check shortcut conflicts:', err);
    }
  }

  async function resolveAllConflicts() {
    try {
      const conflicts = await invoke('check_keyboard_conflicts');
      if (conflicts.hasAltSpaceConflict) {
        await invoke('resolve_keyboard_conflict', { conflictType: 'alt-space' });
      }
      if (conflicts.hasCtrlSemicolonConflict) {
        await invoke('resolve_keyboard_conflict', { conflictType: 'ctrl-semicolon' });
      }
      showToast('Conflitos de sistema resolvidos!');
      await checkAndShowConflicts();
    } catch (err) {
      console.error('Failed to resolve keyboard conflicts:', err);
      showToast('Erro ao resolver conflito: ' + err, 'error');
    }
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
