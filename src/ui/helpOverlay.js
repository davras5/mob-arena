/**
 * Help Overlay — F1 keybind reference shown on top of the game.
 *
 * Lists every hotkey grouped by category. Press F1 again or click anywhere
 * to dismiss.
 */

import { UI_THEME, createCloseButton } from './uiTheme.js';

const HOTKEY_GROUPS = [
  {
    title: 'Movement',
    items: [
      ['W A S D', 'Move'],
      ['Mouse', 'Aim'],
    ],
  },
  {
    title: 'Combat',
    items: [
      ['LMB', 'Primary attack / skill'],
      ['RMB', 'Secondary skill'],
      ['1 – 4', 'Use potion / consumable'],
    ],
  },
  {
    title: 'Panels',
    items: [
      ['C', 'Character (attributes & stats)'],
      ['K', 'Skill Book (active & passive skills)'],
      ['I', 'Inventory & Equipment'],
    ],
  },
  {
    title: 'World',
    items: [
      ['E', 'Interact (NPC, chest, stairs, waystone)'],
      ['Tab', 'Toggle full map'],
      ['Alt', 'Show all loot labels (hold)'],
      ['Esc', 'Pause game / close panel'],
    ],
  },
  {
    title: 'Help',
    items: [
      ['F1', 'Toggle this help overlay'],
    ],
  },
];

export class HelpOverlay {
  constructor() {
    this.overlay = null;
    this.isOpen = false;
    this._keyHandler = null;
  }

  toggle() {
    if (this.isOpen) this.hide();
    else this.show();
  }

  show() {
    if (this.isOpen) return;
    this._build();
    this.isOpen = true;
    // Esc / F1 / click to close
    this._keyHandler = (e) => {
      if (e.key === 'Escape' || e.key === 'F1') {
        e.preventDefault();
        this.hide();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  hide() {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
  }

  _build() {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0', left: '0', right: '0', bottom: '0',
      background: UI_THEME.bgOverlay,
      zIndex: '100000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: UI_THEME.fontFamily,
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.hide();
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      width: '640px',
      maxHeight: '80vh',
      background: UI_THEME.bgPanel,
      border: UI_THEME.borderPanel,
      borderRadius: UI_THEME.radius.lg,
      boxShadow: UI_THEME.goldGlow,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    });

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
      background: UI_THEME.bgHeader,
      borderBottom: UI_THEME.borderSubtle,
      padding: '14px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    });
    const title = document.createElement('div');
    title.textContent = 'CONTROLS';
    Object.assign(title.style, {
      color: UI_THEME.gold,
      fontSize: '22px',
      fontWeight: 'bold',
      letterSpacing: UI_THEME.letterSpacingHeading,
      textShadow: '0 0 10px rgba(201, 168, 76, 0.4)',
    });
    header.appendChild(title);
    header.appendChild(createCloseButton(() => this.hide()));
    panel.appendChild(header);

    // Body
    const body = document.createElement('div');
    Object.assign(body.style, {
      padding: '20px 28px',
      overflowY: 'auto',
      color: UI_THEME.textPrimary,
      flex: '1',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '20px 32px',
    });

    for (const group of HOTKEY_GROUPS) {
      const section = document.createElement('div');

      const sectionTitle = document.createElement('div');
      sectionTitle.textContent = group.title.toUpperCase();
      Object.assign(sectionTitle.style, {
        color: UI_THEME.gold,
        fontSize: '12px',
        fontWeight: 'bold',
        letterSpacing: '1.5px',
        marginBottom: '8px',
        paddingBottom: '4px',
        borderBottom: UI_THEME.borderSubtle,
      });
      section.appendChild(sectionTitle);

      for (const [key, label] of group.items) {
        const row = document.createElement('div');
        Object.assign(row.style, {
          display: 'flex',
          alignItems: 'center',
          padding: '4px 0',
          fontSize: '13px',
        });
        const keyEl = document.createElement('span');
        keyEl.textContent = key;
        Object.assign(keyEl.style, {
          display: 'inline-block',
          minWidth: '70px',
          padding: '2px 8px',
          background: 'rgba(201, 168, 76, 0.12)',
          border: '1px solid rgba(201, 168, 76, 0.4)',
          borderRadius: UI_THEME.radius.sm,
          color: UI_THEME.gold,
          fontWeight: 'bold',
          textAlign: 'center',
          marginRight: '12px',
          fontFamily: 'monospace',
          fontSize: '11px',
        });
        const labelEl = document.createElement('span');
        labelEl.textContent = label;
        labelEl.style.color = UI_THEME.textSecondary;
        row.appendChild(keyEl);
        row.appendChild(labelEl);
        section.appendChild(row);
      }
      body.appendChild(section);
    }

    panel.appendChild(body);

    // Footer hint
    const footer = document.createElement('div');
    footer.textContent = 'Press F1 or Esc to close';
    Object.assign(footer.style, {
      padding: '10px',
      textAlign: 'center',
      color: UI_THEME.textMuted,
      fontSize: '11px',
      borderTop: UI_THEME.borderSubtle,
    });
    panel.appendChild(footer);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this.overlay = overlay;
  }
}
