/* ============================================================
   guepardosys-snip — Picker Popup Logic
   ============================================================ */

(function () {
  'use strict';

  // ---- State ----
  let snippets = [];
  let filtered = [];
  let selectedIndex = 0;
  let isMac = false;
  let pendingSnippet = null;

  // ---- DOM Elements ----
  const search = document.getElementById('picker-search');
  const list = document.getElementById('picker-list');
  const pickerContainer = document.querySelector('.picker');
  const variableOverlay = document.getElementById('variable-overlay');
  const variableForm = document.getElementById('variable-form');
  const variableFields = document.getElementById('variable-fields');



  // ---- Tauri API ----
  function invoke(cmd, args) {
    return window.__TAURI__.core.invoke(cmd, args || {});
  }

  function listen(event, callback) {
    return window.__TAURI__.event.listen(event, callback);
  }

  // ---- Load snippets ----
  async function loadSnippets() {
    try {
      snippets = await invoke('get_snippets');
    } catch (err) {
      console.error('Failed to load snippets:', err);
      snippets = [];
    }
    filterAndRender();
  }

  // ---- Filter & render ----
  function filterAndRender() {
    const query = (search.value || '').toLowerCase().trim();

    if (query) {
      filtered = snippets.filter(s =>
        s.trigger.toLowerCase().startsWith(query) ||
        s.name.toLowerCase().includes(query) ||
        (s.category || '').toLowerCase().includes(query) ||
        (s.tags || []).some(tag => tag.toLowerCase().includes(query))
      );
    } else {
      filtered = [...snippets];
    }
    filtered.sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      if ((b.usage_count || 0) !== (a.usage_count || 0)) {
        return (b.usage_count || 0) - (a.usage_count || 0);
      }
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    selectedIndex = Math.min(selectedIndex, Math.max(0, filtered.length - 1));
    render();
  }

  // ---- Render ----
  function render() {
    if (filtered.length === 0) {
      list.innerHTML = '<div class="picker-empty">Nenhum snippet encontrado</div>';
      return;
    }

    list.innerHTML = filtered.map((s, i) => {
      const modifier = isMac ? '⌥' : 'Alt+';
      const shortcutHint = i < 9 ? `<span class="item-shortcut">${modifier}${i + 1}</span>` : '';
      return `
        <div class="picker-item ${i === selectedIndex ? 'selected' : ''}"
             data-index="${i}" data-id="${s.id}">
          <div class="item-left">
            <span class="item-icon"><i data-lucide="${s.favorite ? 'star' : 'zap'}"></i></span>
            <span class="item-name">${escapeHtml(s.name)}</span>
          </div>
          <div class="item-right">
            <span class="item-trigger-badge">${escapeHtml(s.trigger)}</span>
            ${shortcutHint}
          </div>
        </div>
      `;
    }).join('');

    // Click handlers
    list.querySelectorAll('.picker-item').forEach(item => {
      item.addEventListener('click', () => {
        selectedIndex = parseInt(item.dataset.index, 10);
        selectCurrent();
      });
      item.addEventListener('mouseenter', () => {
        selectedIndex = parseInt(item.dataset.index, 10);
        updateSelection();
      });
    });

    // Scroll selected into view
    const selectedEl = list.querySelector('.picker-item.selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // ---- Update selection highlight ----
  function updateSelection() {
    const items = list.querySelectorAll('.picker-item');
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === selectedIndex);
    });

    const selectedEl = list.querySelector('.picker-item.selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  // ---- Select current snippet ----
  async function selectCurrent() {
    if (filtered.length === 0 || selectedIndex < 0 || selectedIndex >= filtered.length) return;

    const snippet = filtered[selectedIndex];
    try {
      const variables = await invoke('get_snippet_variables', { id: snippet.id });
      if (variables.length > 0) {
        pendingSnippet = snippet;
        variableFields.innerHTML = '';
        variables.forEach((name, index) => {
          const label = document.createElement('label');
          label.textContent = name;
          const input = document.createElement('input');
          input.name = name;
          input.required = true;
          input.autocomplete = 'off';
          label.appendChild(input);
          variableFields.appendChild(label);
          if (index === 0) setTimeout(() => input.focus(), 0);
        });
        variableOverlay.hidden = false;
        return;
      }
    } catch (err) {
      console.error('Failed to inspect variables:', err);
    }
    await executeSnippet(snippet, {});
  }

  async function executeSnippet(snippet, variables) {
    try {
      // 1. Hide picker window immediately to return focus to the previous application
      await invoke('hide_picker');
    } catch (err) {
      console.error('Failed to hide picker:', err);
    }

    // 2. Wait a brief moment for the OS to switch focus to the previous application
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
      // 3. Execute macro without deleting trigger (since we didn't type it in the target app)
      await invoke('execute_macro', { id: snippet.id, deleteTrigger: false, variables });
    } catch (err) {
      console.error('Failed to execute macro:', err);
    }
  }

  // ---- Close picker ----
  async function closePicker() {
    try {
      await invoke('hide_picker');
    } catch (err) {
      console.error('Failed to hide picker:', err);
    }
  }

  // ---- Helpers ----
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Init ----
  async function init() {
    // search is already defined globally

    // Detect if platform is macOS
    isMac = navigator.userAgent.indexOf('Mac') !== -1;

    // Auto-focus search
    search.focus();

    // Re-focus search whenever the window receives focus
    window.addEventListener('focus', () => {
      setTimeout(() => {
        search.focus();
      }, 50);
    });

    // Search input handler
    search.addEventListener('input', () => {
      selectedIndex = 0;
      filterAndRender();
    });

    variableForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (!pendingSnippet) return;
      const variables = Object.fromEntries(new FormData(variableForm).entries());
      const snippet = pendingSnippet;
      pendingSnippet = null;
      variableOverlay.hidden = true;
      await executeSnippet(snippet, variables);
    });
    document.getElementById('btn-cancel-variables').addEventListener('click', () => {
      pendingSnippet = null;
      variableOverlay.hidden = true;
      search.focus();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!variableOverlay.hidden) {
        if (e.key === 'Escape') {
          e.preventDefault();
          pendingSnippet = null;
          variableOverlay.hidden = true;
          search.focus();
        }
        return;
      }

      // Alt+1 to Alt+9 quick selection
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        const num = parseInt(e.key, 10);
        const idx = num - 1;
        if (idx < filtered.length) {
          e.preventDefault();
          selectedIndex = idx;
          selectCurrent();
          return;
        }
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (filtered.length > 0) {
            selectedIndex = (selectedIndex + 1) % filtered.length;
            updateSelection();
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (filtered.length > 0) {
            selectedIndex = (selectedIndex - 1 + filtered.length) % filtered.length;
            updateSelection();
          }
          break;

        case 'Enter':
          e.preventDefault();
          selectCurrent();
          break;

        case 'Escape':
          e.preventDefault();
          closePicker();
          break;
      }
    });

    // Listen for picker-activated event from Tauri
    try {
      await listen('picker-activated', async () => {
        search.value = '';
        selectedIndex = 0;
        
        await loadSnippets();

        // Focus search input
        search.focus();
        setTimeout(() => search.focus(), 50);
        setTimeout(() => search.focus(), 150);
      });
    } catch (err) {
      console.warn('Could not listen for picker-activated event:', err);
    }

    // Load snippets
    await loadSnippets();

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
