// Karabiner Configuration Editor
// This application provides a GUI for editing Karabiner rules.ts configuration

// Application State
const appState = {
  currentLayerKey: null,
  currentLayerMaps: { descByKey: new Map(), detailByKey: new Map() },
  data: null,
  config: null, // Raw configuration data
  isDirty: false, // Track if changes have been made
  apps: null // Cached list of installed applications for combobox
};

// Key mapping and layout configuration
const labelMap = {
  hyphen: '-',
  equal_sign: '=',
  open_bracket: '[',
  close_bracket: ']',
  backslash: '\\',
  non_us_pound: '§',
  semicolon: ';',
  quote: "'",
  grave_accent_and_tilde: '`',
  comma: ',',
  period: '.',
  slash: '/'
};

const keyboardLayout = {
  numberRow: ['grave_accent_and_tilde','1','2','3','4','5','6','7','8','9','0','hyphen','equal_sign'],
  topRow: ['q','w','e','r','t','y','u','i','o','p','open_bracket','close_bracket','backslash'],
  homeRow: ['a','s','d','f','g','h','j','k','l','semicolon','quote'],
  bottomRow: ['z','x','c','v','b','n','m','comma','period','slash']
};

const { numberRow, topRow, homeRow, bottomRow } = keyboardLayout;

// All available key codes for dropdowns
const allKeyCodes = [
  ...numberRow, ...topRow, ...homeRow, ...bottomRow,
  'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
  'up_arrow', 'down_arrow', 'left_arrow', 'right_arrow',
  'return_or_enter', 'escape', 'delete_or_backspace', 'delete_forward', 'tab', 'spacebar'
];

// Predefined window management actions for combobox (single-select)
const windowActions = [
  // Common set used in rules.ts snippet
  { label: 'previous-display', slug: 'previous-display' },
  { label: 'maximize', slug: 'maximize' },
  { label: 'center', slug: 'center' },
  { label: 'center-half', slug: 'center-half' },
  { label: 'top-half', slug: 'top-half' },
  { label: 'bottom-half', slug: 'bottom-half' },
  { label: 'left-half', slug: 'left-half' },
  { label: 'right-half', slug: 'right-half' },
  { label: 'top-left', slug: 'top-left' },
  { label: 'top-right', slug: 'top-right' },
  { label: 'bottom-left', slug: 'bottom-left' },
  { label: 'bottom-right', slug: 'bottom-right' },
  { label: 'smaller', slug: 'smaller' },
  { label: 'larger', slug: 'larger' },
  { label: 'top-center-two-thirds', slug: 'top-center-two-thirds' },
  { label: 'top-center-sixth', slug: 'top-center-sixth' },
  { label: 'bottom-center-sixth', slug: 'bottom-center-sixth' },
  { label: 'move-up', slug: 'move-up' },
  // Additional useful actions
  { label: 'almost-maximize', slug: 'almost-maximize' },
  { label: 'bottom-third', slug: 'bottom-third' },
  { label: 'bottom-three-fourths', slug: 'bottom-three-fourths' },
  { label: 'bottom-two-thirds', slug: 'bottom-two-thirds' },
  { label: 'center-third', slug: 'center-third' },
  { label: 'center-three-fourths', slug: 'center-three-fourths' },
  { label: 'center-two-thirds', slug: 'center-two-thirds' }
];

// Utility Functions
const utils = {
  escapeHtml: (s) => (s || '').replace(/[&<>\"]+/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  
  formatKeyLabel: (code) => {
    const label = labelMap[code] || code.toUpperCase();
    return label.length > 2 ? code : label;
  },

  

  toTitleCase: (s) => {
    const text = String(s || '').replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  },

  markDirty: () => {
    appState.isDirty = true;
    // Refresh actions area to show Save button
    try { ui.renderActions(); } catch {}
  },

  markClean: () => {
    appState.isDirty = false;
    // Refresh actions area to hide Save button
    try { ui.renderActions(); } catch {}
  }
};


// Command helpers for UI <-> config mapping
function buildCommandFrom(type, text, options = {}) {
  const value = String(text || '').trim();
  if (type === 'app' && value) {
    return { to: [{ shell_command: `open -a '${value}.app'` }], description: `Open ${value}` };
  }
  if (type === 'window' && value) {
    return { to: [{ shell_command: `open -g raycast://extensions/raycast/window-management/${value}` }], description: `Window: ${value}` };
  }
  if (type === 'raycast' && value) {
    const ignore = options.ignore === true;
    const deeplink = value.startsWith('raycast://') ? value : `raycast://${value}`;
    const prefix = ignore ? '-g ' : '';
    return { to: [{ shell_command: `open ${prefix}${deeplink}` }], description: `Open ${deeplink}` };
  }
  if (type === 'shell' && value) {
    return { to: [{ shell_command: value }], description: value };
  }
  // Fallback (keypress disabled for now)
  return { to: [{ key_code: 'escape' }], description: value || 'Custom command' };
}

function parseTypeTextFrom(command) {
  try {
    const action = command?.to?.[0] || {};
    const sc = action.shell_command || '';
    if (sc.startsWith("open -a ")) {
      const m = sc.match(/open -a '(.+)\.app'/);
      return { type: 'app', text: m ? m[1] : '' };
    }
    if (sc.startsWith('open -g raycast://extensions/raycast/window-management/')) {
      return { type: 'window', text: sc.split('/').pop() || '' };
    }
    // Detect raycast deeplinks via open [ -g ] raycast://...
    if (/^open\s+(-g\s+)?raycast:\/\//.test(sc)) {
      const ignore = /^open\s+-g\s+raycast:\/\//.test(sc);
      const deeplink = sc.replace(/^open\s+(-g\s+)?/, '');
      return { type: 'raycast', text: deeplink, ignoreRaycast: ignore };
    }
    if (sc) return { type: 'shell', text: sc };
    if (action.key_code) return { type: 'key', text: '' };
  } catch {}
  return { type: 'app', text: '' };
}

// Local Storage Management
const storage = {
  LOCKS_KEY: 'kv.baseLocks.v1',
  FILTER_KEY: 'kv.pref.baseFilter.v1',
  KEYBOARD_KEY: 'kv.pref.keyboardLayout.v1',
  
  loadBaseLocks() {
    try {
      const raw = localStorage.getItem(this.LOCKS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  },
  
  saveBaseLocks(obj) {
    localStorage.setItem(this.LOCKS_KEY, JSON.stringify(obj));
  },
  
  loadFilter() {
    try {
      return localStorage.getItem(this.FILTER_KEY) || 'all';
    } catch { return 'all'; }
  },
  
  saveFilter(filter) {
    try {
      localStorage.setItem(this.FILTER_KEY, filter);
    } catch {}
  },
  loadKeyboardLayout() {
    try {
      return localStorage.getItem(this.KEYBOARD_KEY) || 'ANSI';
    } catch { return 'ANSI'; }
  },
  saveKeyboardLayout(layout) {
    try {
      localStorage.setItem(this.KEYBOARD_KEY, layout);
    } catch {}
  }
};

// Base Locks Management
let baseLocks = storage.loadBaseLocks();

const lockManager = {
  isLocked: (code) => Object.prototype.hasOwnProperty.call(baseLocks, code),
  
  setLock: (code, note) => {
    baseLocks[code] = note || '';
    storage.saveBaseLocks(baseLocks);
  },
  
  deleteLock: (code) => {
    if (lockManager.isLocked(code)) {
      delete baseLocks[code];
      storage.saveBaseLocks(baseLocks);
    }
  }
};

// API Functions
const api = {
  async fetchData() {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('Failed to load data');
    return await res.json();
  },

  async fetchScreenTime() {
    try {
      const res = await fetch('/api/screentime');
      if (!res.ok) throw new Error('Failed to load Screen Time');
      return await res.json(); // { apps: [{ bundle, count }], note? }
    } catch (e) {
      console.warn('fetchScreenTime failed', e);
      return { apps: [], note: 'Unavailable' };
    }
  },

  async fetchConfig() {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('Failed to load configuration');
    return await res.json();
  },

  async fetchApps() {
    try {
      const res = await fetch('/api/apps');
      if (!res.ok) throw new Error('Failed to load apps');
      const apps = await res.json();
      // Expecting [{ name, bundleId?, path? }]
      return (Array.isArray(apps) ? apps : []).map(a => ({
        name: a.name || String(a || ''),
        bundleId: a.bundleId || '',
        path: a.path || ''
      }));
    } catch (e) {
      console.warn('fetchApps failed; falling back to manual entry only', e);
      return [];
    }
  },

  async saveConfig(config) {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error('Failed to save configuration');
    return await res.json();
  }
};

// Rendering Functions
const renderer = {
  makeKeyElement(code, state, title) {
    const div = document.createElement('div');
    div.className = `key ${state || ''}`.trim();
    div.dataset.code = code;
    div.title = title || '';
    div.textContent = utils.formatKeyLabel(code);
    return div;
  },

  renderBaseGrid() {
    const grid = document.getElementById('base-grid');
    if (!grid) return;
    
    const filter = storage.loadFilter();
    const kbLayout = storage.loadKeyboardLayout(); // 'ANSI' | 'ISO'
    
    // Create sets from the /api/data response
    const sublayerByKey = new Set(appState.data?.base?.sublayerKeys || []);
    const customByKey = new Set((appState.data?.base?.customKeys || []).map(c => c.key));
    const availableByKey = new Set();
    const thirdPartyByKey = new Set(appState.data?.base?.fallbackKeys || []);
    
    // If we have config data, also add from it
    if (appState.config?.layers) {
      Object.entries(appState.config.layers).forEach(([key, layerConfig]) => {
        if (layerConfig.type === 'sublayer') {
          sublayerByKey.add(key);
        } else {
          customByKey.add(key);
        }
      });
    }
    
    // Calculate available keys (keys not in any other category)
    [...numberRow, ...topRow, ...homeRow, ...bottomRow].forEach(key => {
      if (!sublayerByKey.has(key) && !customByKey.has(key) && !thirdPartyByKey.has(key) && !lockManager.isLocked(key)) {
        availableByKey.add(key);
      }
    });
    
    const renderRow = (keys, label, rowClass) => {
      const row = document.createElement('div');
      row.className = `row ${rowClass || ''}`.trim();
      
      const rowLabel = document.createElement('div');
      rowLabel.className = 'row-label';
      rowLabel.textContent = label;
      row.appendChild(rowLabel);
      
      const rowWrap = document.createElement('div');
      rowWrap.className = 'row-wrap';
      
      keys.forEach(code => {
        const key = document.createElement('div');
        key.className = 'key';
        key.dataset.code = code;
        key.textContent = utils.formatKeyLabel(code);
        
        // Determine state
        const states = {
          locked: lockManager.isLocked(code),
          sublayer: sublayerByKey.has(code),
          custom: customByKey.has(code),
          available: availableByKey.has(code),
          thirdParty: thirdPartyByKey.has(code)
        };
        
        // Apply classes
        Object.entries(states).forEach(([state, hasState]) => {
          if (hasState) {
            // Use 'thirdparty' (no dash) to match CSS
            key.classList.add(state === 'thirdParty' ? 'thirdparty' : state);
          }
        });
        
        // Filter visibility
        const shouldShow = (
          filter === 'all' ||
          (filter === 'sublayer' && states.sublayer) ||
          (filter === 'custom' && states.custom) ||
          (filter === 'available' && states.available) ||
          (filter === 'thirdparty' && states.thirdParty)
        );
        
        if (!shouldShow) key.style.display = 'none';
        
        key.addEventListener('click', () => ui.selectBaseKey(code));
        rowWrap.appendChild(key);
      });
      
      row.appendChild(rowWrap);
      return row;
    };
    
    grid.innerHTML = '';
    // Apply keyboard layout class to container
    grid.classList.toggle('keyboard-ansi', kbLayout === 'ANSI');
    grid.classList.toggle('keyboard-iso', kbLayout === 'ISO');
    grid.appendChild(renderRow(numberRow, 'Numbers', 'row--numbers'));
    grid.appendChild(renderRow(topRow, 'Top', 'row--top'));
    grid.appendChild(renderRow(homeRow, 'Home', 'row--home'));
    grid.appendChild(renderRow(bottomRow, 'Bottom', 'row--bottom'));
  },

  renderLayerDetail(layerKey) {
    const detail = document.getElementById('detail');
    if (!detail || !appState.config) return;
    
    const layerConfig = appState.config.layers[layerKey];
    // If not found in config, but present in server-provided sublayer set, render a virtual sublayer view
    const isInSublayerSet = new Set(appState.data?.base?.sublayerKeys || []).has(layerKey);
    if (!layerConfig && !isInSublayerSet) {
      console.debug('[renderLayerDetail] Layer not found for key', layerKey, 'Available keys:', Object.keys(appState.config.layers || {}));
      detail.innerHTML = '<div class="empty"><p>Layer not found</p></div>';
      return;
    }

    const isSubLayer = layerConfig ? (layerConfig.type === 'sublayer') : true; // virtual sublayer
    
    detail.innerHTML = `
      <div class="detail-content">
        <div class="detail-header">
          <h3>${utils.escapeHtml(layerKey)} Layer</h3>
          <div class="detail-actions">
            <button class="btn-secondary btn-small" onclick="ui.editLayer('${layerKey}')">Edit Layer</button>
            <button class="btn-danger btn-small" onclick="ui.deleteLayer('${layerKey}')">Delete Layer</button>
          </div>
        </div>
        <div class="layer-info">
          <p><strong>Type:</strong> ${isSubLayer ? 'Sublayer' : 'Single Command'}</p>
          ${layerConfig?.description ? `<p><strong>Description:</strong> ${utils.escapeHtml(layerConfig.description)}</p>` : ''}
        </div>
        ${isSubLayer 
          ? this.renderSubLayerCommands(layerKey, layerConfig?.commands || {}) 
          : this.renderSingleCommand(layerConfig.command)}
      </div>
    `;
  },

  renderSubLayerCommands(layerKey, commands) {
    const commandMap = commands || {};
    const kbLayout = storage.loadKeyboardLayout(); // 'ANSI' | 'ISO'
    const rows = [
      { label: 'Numbers', keys: numberRow, cls: 'row--numbers' },
      { label: 'Top', keys: topRow, cls: 'row--top' },
      { label: 'Home', keys: homeRow, cls: 'row--home' },
      { label: 'Bottom', keys: bottomRow, cls: 'row--bottom' }
    ];

    const renderRow = ({ label, keys, cls }) => {
      const tiles = keys.map(code => {
        const cmd = commandMap[code];
        const has = !!cmd;
        const desc = has ? (cmd.description || this.getCommandDescription(cmd)) : 'Add';
        const classes = ['key', has ? 'custom' : 'available'].join(' ');
        const onClick = has
          ? `ui.editCommand('${layerKey}', '${code}')`
          : `ui.addCommand('${layerKey}', '${code}')`;
        return `
          <div class="key-tile" onclick="${onClick}">
            <div class="${classes}" title="${utils.escapeHtml(desc)}">${utils.formatKeyLabel(code)}</div>
          </div>
        `;
      }).join('');
      return `
        <div class="row ${cls}">
          <div class="row-label">${label}</div>
          <div class="row-wrap">${tiles}</div>
        </div>
      `;
    };

    return `
      <div class="layer-commands">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h4>Commands (${Object.keys(commandMap).length})</h4>
        </div>
        <div class="keyboard-grid ${kbLayout === 'ISO' ? 'keyboard-iso' : 'keyboard-ansi'}">
          ${rows.map(renderRow).join('')}
        </div>
        ${Object.keys(commandMap).length === 0 ? '<p class="empty" style="margin-top: 0.75rem;">Tip: Click any key tile to add a command.</p>' : ''}
      </div>
    `;
  },

  renderSingleCommand(command) {
    return `
      <div class="command-info">
        <h4>Command Configuration</h4>
        <p><strong>Command:</strong> ${utils.escapeHtml(command.description || this.getCommandDescription(command))}</p>
        <p><strong>Action:</strong> ${this.getCommandDescription(command)}</p>
      </div>
    `;
  },

  getCommandDescription(command) {
    if (!command.to || !command.to[0]) return 'No action defined';
    
    const action = command.to[0];
    if (action.key_code) {
      const modifiers = action.modifiers ? action.modifiers.join(' + ') + ' + ' : '';
      return `Press ${modifiers}${utils.formatKeyLabel(action.key_code)}`;
    }
    if (action.shell_command) {
      if (action.shell_command.startsWith('open -a')) {
        const app = action.shell_command.match(/open -a '(.+)\.app'/)?.[1];
        return app ? `Open ${app}` : 'Open application';
      }
      if (action.shell_command.startsWith('open')) {
        return 'Open URL/file';
      }
      return 'Run shell command';
    }
    return 'Custom action';
  },

  populateKeySelect(selectId, excludeKeys = []) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    select.innerHTML = '<option value="">Select a key...</option>';
    
    allKeyCodes
      .filter(key => !excludeKeys.includes(key))
      .forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = `${utils.formatKeyLabel(key)} (${key})`;
        select.appendChild(option);
      });
  }
};

// UI Management
const ui = {
  currentModal: null,

  showModal(modalId) {
    this.hideModal();
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      this.currentModal = modalId;
    }
  },

  hideModal() {
    if (this.currentModal) {
      const modal = document.getElementById(this.currentModal);
      if (modal) modal.classList.add('hidden');
      this.currentModal = null;
    }
  },

  showToast(message, type = 'info') {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    // Rely on CSS .toast for positioning to avoid conflicts
    // Minimal inline styles only for color theming
    toast.style.background = type === 'error' ? 'var(--danger)' : (type === 'success' ? 'var(--success)' : 'var(--text)');

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade');
      setTimeout(() => toast.remove(), 600);
    }, 2000);
  },

  // Screen Time suggestions modal
  ensureScreenTimeModal() {
    let modal = document.getElementById('screentime-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'screentime-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="screentime-title">Most Used Apps</h3>
          <button class="modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          <div id="screentime-note" class="muted" style="margin-bottom:8px;"></div>
          <ul id="screentime-list" class="cmd-list"></ul>
        </div>
      </div>`;
    document.body.appendChild(modal);
    // wire close
    modal.querySelector('.modal-close')?.addEventListener('click', () => this.hideModal());
    return modal;
  },

  async scanScreenTime() {
    try {
      this.showToast('Scanning Screen Time…');
      const result = await api.fetchScreenTime();
      const items = Array.isArray(result?.apps) ? result.apps : [];
      try { localStorage.setItem('screentime_suggestions', JSON.stringify(items)); } catch {}

      const modal = this.ensureScreenTimeModal();
      const list = modal.querySelector('#screentime-list');
      const note = modal.querySelector('#screentime-note');
      if (note) note.textContent = result?.note ? String(result.note) : '';
      if (list) {
        list.innerHTML = '';
        if (!items.length) {
          const li = document.createElement('li');
          li.className = 'empty-state';
          li.textContent = 'No usage data available. You may need to grant Terminal Full Disk Access.';
          list.appendChild(li);
        } else {
          items.slice(0, 20).forEach(app => {
            const li = document.createElement('li');
            li.className = 'command-item';
            li.innerHTML = `
              <div class="command-info">
                <div class="command-key">${utils.escapeHtml(app.bundle || 'Unknown')}</div>
                <div class="command-desc">Opens count: ${Number(app.count || 0)}</div>
              </div>
              <div class="command-actions">
                <button class="btn-small" data-bundle="${utils.escapeHtml(app.bundle || '')}">Copy Bundle ID</button>
              </div>`;
            li.querySelector('button')?.addEventListener('click', (ev) => {
              const bundle = ev.currentTarget?.getAttribute('data-bundle') || '';
              if (!bundle) return;
              navigator.clipboard?.writeText(bundle);
              this.showToast('Copied bundle id');
            });
            list.appendChild(li);
          });
        }
      }
      this.showModal('screentime-modal');
    } catch (e) {
      console.warn('scanScreenTime failed', e);
      this.showToast('Screen Time scan failed', 'error');
    }
  },

  // Render action buttons inside the Base panel
  renderActions() {
    const container = document.getElementById('base-actions');
    if (!container) return;
    container.innerHTML = '';

    // Save button (only when dirty)
    if (appState.isDirty) {
      const saveBtn = document.createElement('button');
      saveBtn.id = 'save-config';
      saveBtn.className = 'btn-primary';
      saveBtn.textContent = 'Save Configuration *';
      saveBtn.addEventListener('click', () => this.saveConfiguration());
      container.appendChild(saveBtn);
    }

    // Screen Time scan button
    const scanBtn = document.createElement('button');
    scanBtn.id = 'scan-screentime';
    scanBtn.className = 'btn-secondary';
    scanBtn.textContent = 'Scan Screen Time';
    scanBtn.title = 'Find your most used apps';
    scanBtn.addEventListener('click', () => this.scanScreenTime());
    container.appendChild(scanBtn);

    // Removed: Add Layer button. Adding happens by clicking keys.

    // Keyboard layout toggle (ANSI/ISO)
    const kbWrap = document.createElement('div');
    kbWrap.className = 'keyboard-toggle';
    const current = storage.loadKeyboardLayout();
    const makeBtn = (label) => {
      const b = document.createElement('button');
      b.className = 'filter-item' + (current === label ? ' active' : '');
      b.textContent = label;
      b.addEventListener('click', () => {
        storage.saveKeyboardLayout(label);
        // refresh active state
        this.renderActions();
        // re-render grid with new layout class
        renderer.renderBaseGrid();
      });
      return b;
    };
    kbWrap.appendChild(makeBtn('ANSI'));
    kbWrap.appendChild(makeBtn('ISO'));
    container.appendChild(kbWrap);
  },

  // Ensure command UI is only visible for 'Single Command'
  syncLayerTypeVisibility() {
    const commandSection = document.getElementById('command-section');
    const cmdTextGroup = document.getElementById('command-text-group');
    const selected = document.querySelector('input[name="layer-type"]:checked');
    const isCommand = selected && selected.value === 'command';
    if (commandSection) commandSection.classList.toggle('hidden', !isCommand);
    if (cmdTextGroup) cmdTextGroup.classList.toggle('hidden', !isCommand);
    if (!isCommand) {
      // Clear inputs when switching back to sublayer
      const layerCmdText = document.getElementById('layer-command-text');
      const commandTypeSel = document.getElementById('command-type');
      if (layerCmdText) layerCmdText.value = '';
      if (commandTypeSel) commandTypeSel.value = 'app';
    }
  },

  // Toggle between text input and a window-action combobox depending on command type
  renderCommandConfig(scope, type, value = '', extras = {}) {
    const isLayer = scope === 'layer';
    const groupEl = document.getElementById(isLayer ? 'command-text-group' : 'cmd-text-group');
    const inputId = isLayer ? 'layer-command-text' : 'cmd-command-text';
    let inputEl = document.getElementById(inputId);
    if (!groupEl) return;

    const selectId = isLayer ? 'layer-window-select' : 'cmd-window-select';
    let selectEl = document.getElementById(selectId);
    const rcIgnoreId = isLayer ? 'layer-raycast-ignore' : 'cmd-raycast-ignore';
    const rcWrapId = isLayer ? 'layer-raycast-wrap' : 'cmd-raycast-wrap';
    let rcIgnoreEl = document.getElementById(rcIgnoreId);
    let rcWrapEl = document.getElementById(rcWrapId);
    const listId = isLayer ? 'layer-app-list' : 'cmd-app-list';
    let listEl = document.getElementById(listId);

    if (type === 'window') {
      // Ensure a select exists inside the same group as the text input
      if (!selectEl) {
        selectEl = document.createElement('select');
        selectEl.id = selectId;
        selectEl.required = true;
        // Populate options
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = 'Select a window action...';
        selectEl.appendChild(empty);
        windowActions.forEach(a => {
          const opt = document.createElement('option');
          opt.value = a.slug; // lowercase, hyphenated
          opt.textContent = a.slug;
          selectEl.appendChild(opt);
        });
        // Insert select before any text input (to keep position consistent)
        if (inputEl && inputEl.parentNode === groupEl) {
          groupEl.insertBefore(selectEl, inputEl);
        } else {
          groupEl.appendChild(selectEl);
        }
      }
      // Remove the text input entirely to avoid two controls
      if (inputEl && inputEl.parentNode === groupEl) {
        inputEl.remove();
        inputEl = null;
      }
      // Remove raycast checkbox if present
      if (rcWrapEl && rcWrapEl.parentNode === groupEl) {
        rcWrapEl.remove();
        rcWrapEl = null;
        rcIgnoreEl = null;
      }
      // Remove app datalist if present and detach from input
      if (listEl) {
        if (inputEl) inputEl.removeAttribute('list');
        listEl.remove();
        listEl = null;
      }
      // Show the select and set value if provided
      selectEl.classList.remove('hidden');
      if (value) selectEl.value = value;
    } else if (type === 'app') {
      // Use native datalist for app suggestions
      // Ensure window select removed
      if (selectEl && selectEl.parentNode === groupEl) {
        selectEl.remove();
        selectEl = null;
      }
      // Remove raycast checkbox if present
      if (rcWrapEl && rcWrapEl.parentNode === groupEl) {
        rcWrapEl.remove();
        rcWrapEl = null;
        rcIgnoreEl = null;
      }
      // If input was wrapped in previous combo-wrap, unwrap it back to the group
      const prevWrap = inputEl && inputEl.parentElement && inputEl.parentElement.classList.contains('combo-wrap') ? inputEl.parentElement : null;
      if (prevWrap && prevWrap.parentElement === groupEl) {
        groupEl.insertBefore(inputEl, prevWrap);
        prevWrap.remove();
      }
      // Ensure a plain text input exists directly under group
      if (!inputEl) {
        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.id = inputId;
      }
      if (inputEl.parentNode !== groupEl) groupEl.appendChild(inputEl);
      inputEl.placeholder = 'App name…';
      inputEl.classList.remove('hidden');
      // Ensure a datalist exists and is linked
      if (!listEl) {
        listEl = document.createElement('datalist');
        listEl.id = listId;
        groupEl.appendChild(listEl);
      }
      inputEl.setAttribute('list', listId);
      // Populate datalist with apps
      const ensureApps = async () => {
        if (!Array.isArray(appState.apps)) {
          appState.apps = await api.fetchApps();
        }
        // Rebuild options
        listEl.innerHTML = '';
        (appState.apps || []).forEach(a => {
          const opt = document.createElement('option');
          opt.value = a.name;
          listEl.appendChild(opt);
        });
      };
      ensureApps().then(() => {
        if (value) inputEl.value = value;
      });
    } else if (type === 'raycast') {
      // Remove window select if present
      if (selectEl && selectEl.parentNode === groupEl) {
        selectEl.remove();
        selectEl = null;
      }
      // Remove app datalist if present and detach from input
      if (listEl) {
        if (inputEl) inputEl.removeAttribute('list');
        listEl.remove();
        listEl = null;
      }
      // Ensure text input
      if (!inputEl) {
        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.id = inputId;
        inputEl.placeholder = 'raycast://extensions/...';
      }
      // If input wrapped in combo-wrap from app type, unwrap to groupEl safely
      if (inputEl.parentElement && inputEl.parentElement.classList.contains('combo-wrap')) {
        const wrap = inputEl.parentElement; // .combo-wrap
        const parent = wrap.parentElement;  // groupEl
        if (parent) {
          parent.insertBefore(inputEl, wrap.nextSibling);
          wrap.remove();
        }
      }
      if (inputEl.parentNode !== groupEl) {
        groupEl.appendChild(inputEl);
      }
      inputEl.classList.remove('hidden');
      if (value) inputEl.value = value;
      // Add/ensure checkbox
      if (!rcWrapEl) {
        rcWrapEl = document.createElement('div');
        rcWrapEl.id = rcWrapId;
        rcWrapEl.style.display = 'flex';
        rcWrapEl.style.alignItems = 'center';
        rcWrapEl.style.marginTop = '0.5rem';
        rcIgnoreEl = document.createElement('input');
        rcIgnoreEl.type = 'checkbox';
        rcIgnoreEl.id = rcIgnoreId;
        const label = document.createElement('label');
        label.htmlFor = rcIgnoreId;
        label.textContent = 'Ignore window (-g)';
        label.style.marginLeft = '0.5rem';
        rcWrapEl.appendChild(rcIgnoreEl);
        rcWrapEl.appendChild(label);
        groupEl.appendChild(rcWrapEl);
      }
      rcIgnoreEl.checked = extras.ignore === true;
    } else {
      if (!inputEl) {
        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.id = inputId;
        inputEl.placeholder = 'e.g., Comet or top-left or echo hi';
        if (selectEl && selectEl.parentNode === groupEl) {
          groupEl.insertBefore(inputEl, selectEl);
        } else {
          groupEl.appendChild(inputEl);
        }
      }
      inputEl.classList.remove('hidden');
      if (selectEl && selectEl.parentNode === groupEl) {
        selectEl.remove();
      }
      // Remove app datalist if present and detach from input
      if (listEl) {
        if (inputEl) inputEl.removeAttribute('list');
        listEl.remove();
      }
      // Remove raycast checkbox if present
      if (rcWrapEl && rcWrapEl.parentNode === groupEl) {
        rcWrapEl.remove();
      }
    }
  },

  selectBaseKey(code) {
     // Remove previous selection
     document.querySelectorAll('.key.selected').forEach(k => k.classList.remove('selected'));
     
     // Add selection to clicked key
     const key = document.querySelector(`[data-code="${code}"]`);
     if (key) key.classList.add('selected');
     
     // Check if this key has a layer configuration
     const sublayerSet = new Set(appState.data?.base?.sublayerKeys || []);
     const hasLayer = (appState.config?.layers && appState.config.layers[code]) || sublayerSet.has(code);
     console.debug('[selectBaseKey]', { code, hasLayer, inConfig: !!(appState.config?.layers && appState.config.layers[code]), inSublayerSet: sublayerSet.has(code) });
     
     if (hasLayer) {
       renderer.renderLayerDetail(code);
     } else {
       // Show available key info or custom mapping
       const detail = document.getElementById('detail');
       detail.innerHTML = `
         <div class="detail-content">
           <div class="detail-header">
             <h3>${utils.formatKeyLabel(code)} Key</h3>
             <div class="detail-actions">
               <button class="btn-primary btn-small" onclick="ui.addLayer('${code}')">Create Layer</button>
             </div>
           </div>
           <p>This key is available for configuration.</p>
         </div>
       `;
     }
   },

  addLayer(preselectedKey = null) {
    const modal = document.getElementById('layer-modal');
    const form = document.getElementById('layer-form');
    const keySelect = document.getElementById('layer-key');
    
    // Reset form
    form.reset();
    document.getElementById('modal-title').textContent = 'Add New Layer';
    // Ensure key select is enabled when adding a new layer (may be disabled after editing)
    if (keySelect) keySelect.disabled = false;
    // Explicitly reset layer type to 'sublayer'
    const sublayerRadio = document.querySelector('input[name="layer-type"][value="sublayer"]');
    if (sublayerRadio) sublayerRadio.checked = true;
    // Default hide command UI in Add Layer
    const cmdTextGroup = document.getElementById('command-text-group');
    const commandSection = document.getElementById('command-section');
    if (cmdTextGroup) cmdTextGroup.classList.add('hidden');
    if (commandSection) commandSection.classList.add('hidden');
    // Ensure inputs are cleared and default type set
    const layerCmdText = document.getElementById('layer-command-text');
    const commandTypeSel = document.getElementById('command-type');
    if (layerCmdText) layerCmdText.value = '';
    if (commandTypeSel) commandTypeSel.value = 'app';
    // Ensure visibility reflects selected type and command config defaults
    ui.syncLayerTypeVisibility();
    const ct = document.getElementById('command-type');
    ui.renderCommandConfig('layer', ct ? ct.value : 'app');
    
    // Populate key dropdown (guard if layers is undefined)
    const usedKeys = (appState.config && appState.config.layers) ? Object.keys(appState.config.layers) : [];
    renderer.populateKeySelect('layer-key', usedKeys);
    
    if (preselectedKey) {
      keySelect.value = preselectedKey;
    }
    
    ui.showModal('layer-modal');
  },

  editLayer(layerKey) {
    const modal = document.getElementById('layer-modal');
    const form = document.getElementById('layer-form');
    const layerConfig = appState.config.layers[layerKey];
    
    if (!layerConfig) return;
    
    // Populate form with existing data
    document.getElementById('modal-title').textContent = 'Edit Layer';
    document.getElementById('layer-key').innerHTML = `<option value="${layerKey}">${utils.formatKeyLabel(layerKey)} (${layerKey})</option>`;
    document.getElementById('layer-key').value = layerKey;
    document.getElementById('layer-key').disabled = true;

    const layerType = layerConfig.type === 'sublayer' ? 'sublayer' : 'command';
    document.querySelector(`input[name="layer-type"][value="${layerType}"]`).checked = true;

    const commandSection = document.getElementById('command-section');
    const cmdTextGroup = document.getElementById('command-text-group');
    if (layerType === 'command') {
      const parsed = parseTypeTextFrom(layerConfig.command);
      const { type, text } = parsed;
      document.getElementById('command-type').value = type;
      // Render appropriate config UI and set value
      ui.renderCommandConfig('layer', type, text, { ignore: parsed.ignoreRaycast === true });
      if (type !== 'window') {
        document.getElementById('layer-command-text').value = text;
      }
      if (type === 'raycast') {
        const rc = document.getElementById('layer-raycast-ignore');
        if (rc) rc.checked = parsed.ignoreRaycast === true;
      }
    } else {
      document.getElementById('layer-command-text').value = '';
    }

    // Sync visibility strictly to selection
    ui.syncLayerTypeVisibility();

    ui.showModal('layer-modal');
  },

  deleteLayer(layerKey) {
    // Delete immediately without native confirm
    delete appState.config.layers[layerKey];
    utils.markDirty();
    
    // Refresh the display using local state (avoid overwriting unsaved changes)
    renderer.renderBaseGrid();
    
    // Clear detail panel
    document.getElementById('detail').innerHTML = '<div class="empty"><p>Select a key to edit its configuration</p></div>';
    
    ui.showToast('Layer deleted successfully');
  },

  addCommand(layerKey, preselectedKey = null) {
    const modal = document.getElementById('command-modal');
    const form = document.getElementById('command-form');
    
    // Reset form
    form.reset();
    document.getElementById('command-modal-title').textContent = `Add Command to ${layerKey} Layer`;
    // Set form mode to add and clear previous edit refs
    form.dataset.mode = 'add';
    delete form.dataset.commandKey;
    form.dataset.layerKey = layerKey;
    // Ensure the layer exists in local config; if layer is only in sublayer set, initialize it
    if (!appState.config) appState.config = { layers: {} };
    if (!appState.config.layers) appState.config.layers = {};
    if (!appState.config.layers[layerKey]) {
      appState.config.layers[layerKey] = { type: 'sublayer', commands: {} };
      utils.markDirty();
    }
    
    // Populate key dropdown: if preselected, lock to that; else show unused keys
    const usedKeys = appState.config.layers[layerKey]?.commands ? Object.keys(appState.config.layers[layerKey].commands) : [];
    const keySelect = document.getElementById('command-key');
    if (preselectedKey) {
      // Force single option for the chosen key
      keySelect.innerHTML = `<option value="${preselectedKey}">${utils.formatKeyLabel(preselectedKey)} (${preselectedKey})</option>`;
      keySelect.value = preselectedKey;
      keySelect.disabled = true;
    } else {
      renderer.populateKeySelect('command-key', usedKeys);
      if (keySelect) keySelect.disabled = false;
    }
    // Set defaults for new command
    const typeSel = document.getElementById('cmd-type');
    const textInp = document.getElementById('cmd-command-text');
    if (typeSel) typeSel.value = 'app';
    if (textInp) textInp.value = '';
    ui.renderCommandConfig('cmd', 'app');
    // In add mode, hide Delete button and clear stale handlers
    const delBtn = document.getElementById('delete-command');
    if (delBtn) {
      delBtn.classList.add('hidden');
      delBtn.onclick = null;
      delBtn.removeAttribute('data-busy');
    }
    
    ui.showModal('command-modal');
  },

  editCommand(layerKey, commandKey) {
    const modal = document.getElementById('command-modal');
    const form = document.getElementById('command-form');
    const command = appState.config.layers[layerKey]?.commands?.[commandKey];
    
    if (!command) return;
    
    // Populate form with existing data
    document.getElementById('command-modal-title').textContent = `Edit Command: ${utils.formatKeyLabel(commandKey)}`;
    document.getElementById('command-key').innerHTML = `<option value="${commandKey}">${utils.formatKeyLabel(commandKey)} (${commandKey})</option>`;
    document.getElementById('command-key').value = commandKey;
    document.getElementById('command-key').disabled = true;
    const parsed = parseTypeTextFrom(command);
    const { type, text } = parsed;
    const typeSel = document.getElementById('cmd-type');
    const textInp = document.getElementById('cmd-command-text');
    if (typeSel) typeSel.value = type;
    if (textInp) textInp.value = text;
    ui.renderCommandConfig('cmd', type, text, { ignore: parsed.ignoreRaycast === true });
    if (type === 'raycast') {
      const rc = document.getElementById('cmd-raycast-ignore');
      if (rc) rc.checked = parsed.ignoreRaycast === true;
    }
    
    // Store data for form submission
    form.dataset.layerKey = layerKey;
    form.dataset.commandKey = commandKey;
    form.dataset.mode = 'edit';
    // In edit mode, show Delete button and bind to this specific command
    const delBtn = document.getElementById('delete-command');
    if (delBtn) {
      delBtn.classList.remove('hidden');
      delBtn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (delBtn.dataset.busy === '1') return;
        delBtn.dataset.busy = '1';
        try {
          ui.deleteCommand(layerKey, commandKey);
          ui.hideModal();
        } finally {
          // Small delay to avoid rapid re-trigger from event bubbling
          setTimeout(() => { delBtn.dataset.busy = '0'; }, 200);
        }
      };
    }
    
    ui.showModal('command-modal');
  },

  deleteCommand(layerKey, commandKey) {
    // Delete immediately without native confirm
    if (appState.config.layers[layerKey]?.commands) {
      delete appState.config.layers[layerKey].commands[commandKey];
      utils.markDirty();
      
      // Refresh the layer detail view
      renderer.renderLayerDetail(layerKey);
      
      ui.showToast('Command deleted successfully');
    }
  },

  async saveConfiguration() {
    if (!appState.config) {
      this.showToast('No configuration to save', 'error');
      return;
    }
    
    try {
      // Show loading state
      const saveBtn = document.getElementById('save-config');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;
      
      console.log('Saving configuration:', appState.config);
      
      const result = await api.saveConfig(appState.config);
      console.log('Save result:', result);
      
      utils.markClean();
      this.showToast('Configuration saved successfully!', 'success');
      
      // Reload data to reflect changes
      await this.loadData();
      
      // Restore button state
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    } catch (error) {
      console.error('Failed to save configuration:', error);
      this.showToast(`Save failed: ${error.message}`, 'error');
      
      // Restore button state
      const saveBtn = document.getElementById('save-config');
      saveBtn.textContent = 'Save Configuration';
      saveBtn.disabled = false;
    }
  },

  async loadData() {
    try {
      const [data, config] = await Promise.all([
        api.fetchData(),
        api.fetchConfig()
      ]);
      
      appState.data = data;
      appState.config = config;
      try { console.debug('[loadData] layers:', Object.keys(appState.config?.layers || {})); } catch {}
      
      renderer.renderBaseGrid();
      this.setupFilterButtons();
      this.renderActions();
    } catch (error) {
      console.error('Failed to load data:', error);
      this.showToast('Failed to load configuration', 'error');
    }
  },

  setupFilterButtons() {
    const filterBar = document.querySelector('.filter-bar');
    const currentFilter = storage.loadFilter();
    
    filterBar.addEventListener('click', (e) => {
      if (e.target.classList.contains('filter-item')) {
        // Update active state
        filterBar.querySelectorAll('.filter-item').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        
        // Save and apply filter
        const filter = e.target.dataset.filter;
        storage.saveFilter(filter);
        renderer.renderBaseGrid();
      }
    });
    
    // Set initial active state
    const activeBtn = filterBar.querySelector(`[data-filter="${currentFilter}"]`);
    if (activeBtn) activeBtn.classList.add('active');
  }
};

// Event Handlers
function setupEventHandlers() {
  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => ui.hideModal());
  });
  
  // Click outside modal to close
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) ui.hideModal();
    });
  });
  
  // Action buttons are rendered dynamically in ui.renderActions()
  
  // Layer form
  document.getElementById('layer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const layerKey = document.getElementById('layer-key').value;
    const layerType = formData.get('layer-type');
    const cmdType = (document.getElementById('command-type')?.value) || 'app';
    const cmdText = (cmdType === 'window')
      ? (document.getElementById('layer-window-select')?.value || '')
      : ((document.getElementById('layer-command-text')?.value || '').trim());
    const cmdIgnore = (cmdType === 'raycast') ? !!document.getElementById('layer-raycast-ignore')?.checked : false;
    
    if (!layerKey) {
      ui.showToast('Please select a key', 'error');
      return;
    }
    if (layerType === 'command' && !cmdText) {
      ui.showToast('Please enter a command (e.g., app name or window action)', 'error');
      return;
    }
    
    // Initialize config if needed
    if (!appState.config) {
      appState.config = { layers: {} };
    }
    if (!appState.config.layers) {
      appState.config.layers = {};
    }
    
    // Create layer configuration
    appState.config.layers[layerKey] = { type: layerType };
    if (layerType === 'sublayer') {
      appState.config.layers[layerKey].commands = {};
    } else {
      appState.config.layers[layerKey].command = buildCommandFrom(cmdType, cmdText, { ignore: cmdIgnore });
    }
    
    utils.markDirty();
    ui.hideModal();
    ui.showToast('Layer saved successfully!');
    
    // Re-render using local state so unsaved changes persist, then select the new layer
    renderer.renderBaseGrid();
    ui.selectBaseKey(layerKey);
  });
  
  // Command form
  document.getElementById('command-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const form = e.target;
    const layerKey = form.dataset.layerKey;
    const mode = form.dataset.mode;
    const commandKey = mode === 'edit' ? form.dataset.commandKey : document.getElementById('command-key').value;
    const cmdType = (document.getElementById('cmd-type')?.value) || 'app';
    const cmdText = (cmdType === 'window')
      ? (document.getElementById('cmd-window-select')?.value || '')
      : ((document.getElementById('cmd-command-text')?.value || '').trim());
    const cmdIgnore = (cmdType === 'raycast') ? !!document.getElementById('cmd-raycast-ignore')?.checked : false;
    
    if (!commandKey) {
      ui.showToast('Please select a key', 'error');
      return;
    }
    if (!cmdText) {
      ui.showToast('Please enter a command (e.g., app name or window action)', 'error');
      return;
    }
    
    // Ensure layer exists and has commands object (auto-initialize if missing)
    if (!appState.config) appState.config = { layers: {} };
    if (!appState.config.layers) appState.config.layers = {};
    if (!appState.config.layers[layerKey]) {
      appState.config.layers[layerKey] = { type: 'sublayer', commands: {} };
    }
    if (!appState.config.layers[layerKey].commands) {
      appState.config.layers[layerKey].commands = {};
    }
    
    // Create/Update command from type+text
    appState.config.layers[layerKey].commands[commandKey] = buildCommandFrom(cmdType, cmdText, { ignore: cmdIgnore });
    
    utils.markDirty();
    ui.hideModal();
    ui.showToast(`Command ${mode === 'edit' ? 'updated' : 'added'} successfully!`);
    
    // Refresh the layer detail view
    renderer.renderLayerDetail(layerKey);
  });
  
  // Cancel buttons
  document.getElementById('cancel-layer').addEventListener('click', () => ui.hideModal());
  document.getElementById('cancel-command').addEventListener('click', () => ui.hideModal());

  // Toggle command section visibility based on layer type
  const commandSection = document.getElementById('command-section');
  const cmdTextGroup = document.getElementById('command-text-group');
  document.querySelectorAll('input[name="layer-type"]').forEach(r => {
    r.addEventListener('change', () => ui.syncLayerTypeVisibility());
  });

  // Toggle between text and combobox based on command types
  const layerTypeSelect = document.getElementById('command-type');
  if (layerTypeSelect) {
    layerTypeSelect.addEventListener('change', (e) => ui.renderCommandConfig('layer', e.target.value));
  }
  const cmdTypeSelect = document.getElementById('cmd-type');
  if (cmdTypeSelect) {
    cmdTypeSelect.addEventListener('change', (e) => ui.renderCommandConfig('cmd', e.target.value));
  }

  // Delete button binding is attached in ui.editCommand() to ensure correct context
}

// Initialize the application
async function main() {
  try {
    setupEventHandlers();
    ui.renderActions(); // initial render (clean state)
    await ui.loadData();
    
    console.log('Karabiner Configuration Editor initialized');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    ui.showToast('Failed to initialize application', 'error');
  }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
