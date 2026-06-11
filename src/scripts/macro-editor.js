/* ============================================================
   guepardosys-snip — Macro Editor Component
   ============================================================
   Exposes: window.macroEditor = { init, serialize, deserialize, clear }
*/

(function () {
  'use strict';

  // ---- Key definitions ----
  const MODIFIER_KEYS = [
    { id: 'Ctrl', label: 'Ctrl' },
    { id: 'Shift', label: 'Shift' },
    { id: 'Alt', label: 'Alt' },
  ];

  const ACTION_KEYS = [
    { id: 'Enter', label: 'Enter', icon: '⏎' },
    { id: 'Tab', label: 'Tab', icon: '⇥' },
    { id: 'Backspace', label: 'Retroceder', icon: '⌫' },
    { id: 'Delete', label: 'Excluir', icon: '⌦' },
    { id: 'Escape', label: 'Esc', icon: '⎋' },
  ];

  const ARROW_KEYS = [
    { id: 'Up', label: '↑' },
    { id: 'Down', label: '↓' },
    { id: 'Left', label: '←' },
    { id: 'Right', label: '→' },
  ];

  const BUILTIN_VARIABLES = [
    { id: 'date', label: 'Data', description: 'Data atual no formato DD/MM/AAAA' },
    { id: 'time', label: 'Hora', description: 'Hora atual no formato HH:MM:SS' },
    { id: 'datetime', label: 'Data e hora', description: 'Data e hora atuais no formato brasileiro' },
    { id: 'clipboard', label: 'Área de transferência', description: 'Texto copiado atualmente' },
    { id: 'uuid', label: 'Identificador único', description: 'Gera um código único para protocolos ou registros' },
    { id: 'cursor', label: 'Posição do cursor', description: 'Move o cursor para este ponto após inserir o texto' },
  ];

  // ---- State ----
  let editorEl = null;
  let toolbarEl = null;
  let comboIndicatorEl = null;
  let autocompleteEl = null;
  let autocompleteMatch = null;
  let activeModifiers = new Set();

  // ---- Token creation ----
  function createKeyToken(key, modifiers) {
    const span = document.createElement('span');
    span.className = 'key-token';
    span.contentEditable = 'false';
    span.dataset.key = key;
    span.dataset.modifiers = modifiers || '';

    const modArr = modifiers ? modifiers.split('+').filter(Boolean) : [];
    let label = '';

    if (modArr.length > 0) {
      label = modArr.join('+') + '+';
    }

    // Find icon for the key
    const actionKey = ACTION_KEYS.find(k => k.id === key);
    if (actionKey && actionKey.icon) {
      label += actionKey.icon + ' ' + actionKey.label;
    } else {
      label += key;
    }

    span.textContent = label;
    return span;
  }

  function createDelayToken(milliseconds) {
    const span = document.createElement('span');
    span.className = 'key-token delay-token';
    span.contentEditable = 'false';
    span.dataset.delay = String(milliseconds);
    span.textContent = `Espera ${milliseconds} ms`;
    return span;
  }

  // ---- Insert at cursor ----
  function insertNodeAtCursor(node) {
    editorEl.focus();
    const sel = window.getSelection();
    let range;

    if (sel.rangeCount > 0) {
      range = sel.getRangeAt(0);
      // Ensure we're inside the editor
      if (!editorEl.contains(range.commonAncestorContainer)) {
        range = document.createRange();
        range.selectNodeContents(editorEl);
        range.collapse(false);
      }
    } else {
      range = document.createRange();
      range.selectNodeContents(editorEl);
      range.collapse(false);
    }

    range.deleteContents();
    range.insertNode(node);

    // Move cursor after the inserted node
    range.setStartAfter(node);
    range.setEndAfter(node);
    sel.removeAllRanges();
    sel.addRange(range);
    editorEl.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function insertTextAtCursor(text) {
    insertNodeAtCursor(document.createTextNode(text));
  }

  function insertCustomVariable() {
    const value = window.prompt('Nome da variável (ex.: nome, cliente, email):', '');
    if (value === null) return;

    const name = value.trim();
    if (!/^[\p{L}\p{N}_-]+$/u.test(name)) {
      window.alert('Use apenas letras, números, hífen ou sublinhado.');
      return;
    }

    insertTextAtCursor(`{{${name}}}`);
  }

  function insertVariable(variableId) {
    insertTextAtCursor(`{{${variableId}}}`);
    hideAutocomplete();
  }

  // ---- Insert key token ----
  function insertKeyToken(key) {
    const mods = Array.from(activeModifiers).join('+');
    const token = createKeyToken(key, mods);
    insertNodeAtCursor(token);

    // Insert a zero-width space after the token for cursor positioning
    const spacer = document.createTextNode('\u200B');
    token.after(spacer);
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStartAfter(spacer);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    clearModifiers();
  }

  // ---- Modifier management ----
  function toggleModifier(modId, btn) {
    if (activeModifiers.has(modId)) {
      activeModifiers.delete(modId);
      btn.classList.remove('active');
    } else {
      activeModifiers.add(modId);
      btn.classList.add('active');
    }
    updateComboIndicator();
  }

  function clearModifiers() {
    activeModifiers.clear();
    if (toolbarEl) {
      toolbarEl.querySelectorAll('.keycap.modifier.active').forEach(btn => {
        btn.classList.remove('active');
      });
    }
    updateComboIndicator();
  }

  function updateComboIndicator() {
    if (!comboIndicatorEl) return;
    if (activeModifiers.size > 0) {
      comboIndicatorEl.classList.add('visible');
      const keysText = Array.from(activeModifiers).join('+') + '+ …';
      comboIndicatorEl.querySelector('.combo-keys').textContent = keysText;
    } else {
      comboIndicatorEl.classList.remove('visible');
    }
  }

  // ---- Build toolbar ----
  function buildToolbar(container) {
    toolbarEl = document.createElement('div');
    toolbarEl.className = 'macro-toolbar';

    // Modifier keys
    MODIFIER_KEYS.forEach(mod => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'keycap modifier';
      btn.textContent = mod.label;
      btn.title = `Toggle ${mod.label} modifier`;
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault(); // prevent stealing focus
        toggleModifier(mod.id, btn);
      });
      toolbarEl.appendChild(btn);
    });

    // Separator
    const sep1 = document.createElement('div');
    sep1.className = 'toolbar-separator';
    toolbarEl.appendChild(sep1);

    // Action keys
    ACTION_KEYS.forEach(key => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'keycap';
      btn.innerHTML = `<span class="keycap-icon">${key.icon}</span> ${key.label}`;
      btn.title = key.id;
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        insertKeyToken(key.id);
      });
      toolbarEl.appendChild(btn);
    });

    // Separator
    const sep2 = document.createElement('div');
    sep2.className = 'toolbar-separator';
    toolbarEl.appendChild(sep2);

    // Arrow keys
    ARROW_KEYS.forEach(key => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'keycap';
      btn.textContent = key.label;
      btn.title = key.id;
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        insertKeyToken(key.id);
      });
      toolbarEl.appendChild(btn);
    });

    const delayButton = document.createElement('button');
    delayButton.type = 'button';
    delayButton.className = 'keycap';
    delayButton.textContent = 'Espera';
    delayButton.title = 'Inserir espera entre ações';
    delayButton.addEventListener('mousedown', (event) => {
      event.preventDefault();
      const value = window.prompt('Tempo de espera em milissegundos (0-60000):', '500');
      if (value === null) return;
      const milliseconds = Number.parseInt(value, 10);
      if (!Number.isInteger(milliseconds) || milliseconds < 0 || milliseconds > 60000) {
        window.alert('Informe um valor entre 0 e 60000.');
        return;
      }
      insertNodeAtCursor(createDelayToken(milliseconds));
    });
    toolbarEl.appendChild(delayButton);

    const variableSeparator = document.createElement('div');
    variableSeparator.className = 'toolbar-separator';
    toolbarEl.appendChild(variableSeparator);

    BUILTIN_VARIABLES.forEach(variable => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'keycap variable-keycap';
      button.textContent = variable.label;
      button.title = `${variable.description}. Insere {{${variable.id}}}`;
      button.addEventListener('mousedown', event => {
        event.preventDefault();
        insertVariable(variable.id);
      });
      toolbarEl.appendChild(button);
    });

    const customButton = document.createElement('button');
    customButton.type = 'button';
    customButton.className = 'keycap variable-keycap custom';
    customButton.textContent = '+ Campo personalizado';
    customButton.title = 'Inserir campo preenchível pelo picker';
    customButton.addEventListener('mousedown', event => {
      event.preventDefault();
      insertCustomVariable();
    });
    toolbarEl.appendChild(customButton);

    container.appendChild(toolbarEl);
  }

  function buildAutocomplete(container) {
    autocompleteEl = document.createElement('div');
    autocompleteEl.className = 'variable-autocomplete';
    autocompleteEl.hidden = true;
    container.appendChild(autocompleteEl);
  }

  function getAutocompleteMatch() {
    const selection = window.getSelection();
    if (!selection.rangeCount || !selection.isCollapsed) return null;

    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE || !editorEl.contains(node)) return null;

    const prefix = node.textContent.slice(0, range.startOffset);
    const match = prefix.match(/\{\{([\p{L}\p{N}_-]*)$/u);
    if (!match) return null;

    return {
      node,
      startOffset: range.startOffset - match[0].length,
      endOffset: range.startOffset,
      query: match[1].toLocaleLowerCase('pt-BR'),
    };
  }

  function hideAutocomplete() {
    autocompleteMatch = null;
    if (autocompleteEl) {
      autocompleteEl.hidden = true;
      autocompleteEl.innerHTML = '';
    }
  }

  function chooseAutocompleteVariable(variable) {
    if (!autocompleteMatch) return;

    const range = document.createRange();
    range.setStart(autocompleteMatch.node, autocompleteMatch.startOffset);
    range.setEnd(autocompleteMatch.node, autocompleteMatch.endOffset);
    range.deleteContents();
    const textNode = document.createTextNode(`{{${variable.id}}}`);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    editorEl.dispatchEvent(new Event('input', { bubbles: true }));
    hideAutocomplete();
    editorEl.focus();
  }

  function updateAutocomplete() {
    autocompleteMatch = getAutocompleteMatch();
    if (!autocompleteMatch) {
      hideAutocomplete();
      return;
    }

    const suggestions = BUILTIN_VARIABLES.filter(variable => {
      const searchable = `${variable.id} ${variable.label} ${variable.description}`
        .toLocaleLowerCase('pt-BR');
      return searchable.includes(autocompleteMatch.query);
    });

    autocompleteEl.innerHTML = '';
    suggestions.forEach(variable => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'variable-suggestion';
      button.innerHTML = `
        <strong>${variable.label}</strong>
        <code>{{${variable.id}}}</code>
        <span>${variable.description}</span>
      `;
      button.addEventListener('mousedown', event => {
        event.preventDefault();
        chooseAutocompleteVariable(variable);
      });
      autocompleteEl.appendChild(button);
    });

    const customHint = document.createElement('div');
    customHint.className = 'variable-custom-hint';
    customHint.textContent = autocompleteMatch.query
      ? `Continue digitando e feche com }} para criar o campo personalizado "{{${autocompleteMatch.query}}}".`
      : 'Digite um nome para criar um campo personalizado preenchido no picker.';
    autocompleteEl.appendChild(customHint);
    autocompleteEl.hidden = false;
  }

  // ---- Build editor ----
  function buildEditor(container) {
    editorEl = document.createElement('div');
    editorEl.className = 'macro-editor scroller';
    editorEl.contentEditable = 'true';
    editorEl.setAttribute('role', 'textbox');
    editorEl.setAttribute('aria-multiline', 'true');
    editorEl.setAttribute('data-placeholder', 'Tipo texto ou use os botões acima para inserir teclas...');
    editorEl.spellcheck = false;
    editorEl.addEventListener('input', updateAutocomplete);
    editorEl.addEventListener('keyup', updateAutocomplete);
    editorEl.addEventListener('click', updateAutocomplete);
    editorEl.addEventListener('blur', () => {
      setTimeout(hideAutocomplete, 100);
    });

    // Handle keydown for combo mode & token deletion
    editorEl.addEventListener('keydown', (e) => {
      // If modifiers are active, intercept typed keys to create combo tokens
      if (activeModifiers.size > 0) {
        // Allow actual modifier keys to pass through
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

        e.preventDefault();
        const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
        insertKeyToken(key);
        return;
      }

      // Handle Backspace near tokens
      if (e.key === 'Backspace') {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);

        if (range.collapsed) {
          const node = range.startContainer;
          const offset = range.startOffset;

          // If cursor is right after a token (in a text node after a token)
          if (node.nodeType === Node.TEXT_NODE && offset === 0) {
            const prev = node.previousSibling;
            if (prev && prev.classList && prev.classList.contains('key-token')) {
              e.preventDefault();
              prev.remove();
              return;
            }
          }

          // If cursor is inside the editor div and offset > 0
          if (node === editorEl && offset > 0) {
            const prevChild = editorEl.childNodes[offset - 1];
            if (prevChild && prevChild.classList && prevChild.classList.contains('key-token')) {
              e.preventDefault();
              prevChild.remove();
              return;
            }
          }

          // If in a text node with offset 0 and there's a previous sibling token
          if (node.nodeType === Node.TEXT_NODE && offset <= 1) {
            const textContent = node.textContent;
            // Check if this is a zero-width space
            if (textContent === '\u200B' || (offset === 1 && textContent.charAt(0) === '\u200B')) {
              const prev = node.previousSibling;
              if (prev && prev.classList && prev.classList.contains('key-token')) {
                e.preventDefault();
                prev.remove();
                if (textContent === '\u200B') node.remove();
                return;
              }
            }
          }
        }
      }

      // Handle Delete near tokens
      if (e.key === 'Delete') {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);

        if (range.collapsed) {
          const node = range.startContainer;
          const offset = range.startOffset;

          if (node === editorEl) {
            const nextChild = editorEl.childNodes[offset];
            if (nextChild && nextChild.classList && nextChild.classList.contains('key-token')) {
              e.preventDefault();
              nextChild.remove();
              return;
            }
          }
        }
      }
    });

    // Prevent Enter from creating divs - insert a newline text node instead
    editorEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && activeModifiers.size === 0) {
        // Only if no modifiers active — otherwise combo mode handles it above
        // Default contenteditable Enter inserts <div>, we want \n
        e.preventDefault();
        document.execCommand('insertLineBreak');
      }
    });

    // Prevent paste from inserting rich content
    editorEl.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });

    container.appendChild(editorEl);
  }

  // ---- Build combo indicator ----
  function buildComboIndicator(container) {
    comboIndicatorEl = document.createElement('div');
    comboIndicatorEl.className = 'combo-indicator';
    comboIndicatorEl.innerHTML = `
      <span>🎯 Modo combo:</span>
      <span class="combo-keys"></span>
      <span>— pressione uma tecla ou botão</span>
    `;
    container.appendChild(comboIndicatorEl);
  }

  // ---- Serialization ----
  function serialize() {
    if (!editorEl) return [];
    const actions = [];
    const nodes = editorEl.childNodes;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.replace(/\u200B/g, '');
        if (text.length > 0) {
          // Merge with previous text action if possible
          const last = actions[actions.length - 1];
          if (last && last.type === 'text') {
            last.value += text;
          } else {
            actions.push({ type: 'text', value: text });
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.classList.contains('key-token')) {
          if (node.classList.contains('delay-token')) {
            actions.push({
              type: 'delay',
              milliseconds: Number.parseInt(node.dataset.delay, 10),
            });
            continue;
          }
          const key = node.dataset.key;
          const modStr = node.dataset.modifiers;
          const modifiers = modStr ? modStr.split('+').filter(Boolean) : null;
          actions.push({
            type: 'key',
            key: key,
            modifiers: modifiers && modifiers.length > 0 ? modifiers : null,
          });
        } else if (node.tagName === 'BR') {
          // BR from line breaks
          const last = actions[actions.length - 1];
          if (last && last.type === 'text') {
            last.value += '\n';
          } else {
            actions.push({ type: 'text', value: '\n' });
          }
        } else {
          // Other elements (like divs from contenteditable) — treat as text
          const text = node.textContent.replace(/\u200B/g, '');
          if (text.length > 0) {
            const last = actions[actions.length - 1];
            if (last && last.type === 'text') {
              last.value += '\n' + text;
            } else {
              actions.push({ type: 'text', value: text });
            }
          }
        }
      }
    }

    return actions;
  }

  // ---- Deserialization ----
  function deserialize(actions) {
    if (!editorEl) return;
    editorEl.innerHTML = '';

    if (!actions || actions.length === 0) return;

    actions.forEach(action => {
      if (action.type === 'text') {
        const textNode = document.createTextNode(action.value);
        editorEl.appendChild(textNode);
      } else if (action.type === 'key') {
        const mods = action.modifiers ? action.modifiers.join('+') : '';
        const token = createKeyToken(action.key, mods);
        editorEl.appendChild(token);
        // Add zero-width space after for cursor positioning
        editorEl.appendChild(document.createTextNode('\u200B'));
      } else if (action.type === 'delay') {
        editorEl.appendChild(createDelayToken(action.milliseconds));
        editorEl.appendChild(document.createTextNode('\u200B'));
      }
    });
  }

  // ---- Clear ----
  function clear() {
    if (editorEl) {
      editorEl.innerHTML = '';
    }
    clearModifiers();
  }

  // ---- Init ----
  function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`[MacroEditor] Container #${containerId} not found`);
      return;
    }

    container.innerHTML = '';
    buildToolbar(container);
    buildEditor(container);
    buildAutocomplete(container);
    buildComboIndicator(container);
  }

  // ---- Export ----
  window.macroEditor = {
    init,
    serialize,
    deserialize,
    clear,
  };
})();
