/**
 * UI Design Tokens — single source of truth for the dungeon-crawler ARPG UI.
 * Import from here in every panel/UI file to keep the visual language consistent.
 *
 * Usage:
 *   import { UI_THEME } from './uiTheme.js';
 *   el.style.background = UI_THEME.bgPanelSolid;
 *   el.style.border = UI_THEME.borderPanel;
 */

export const UI_THEME = {
  // ─── Backgrounds ────────────────────────────────────────────────
  bgOverlay:    'rgba(0, 0, 0, 0.78)',
  bgPanel:      'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
  bgPanelSolid: '#1a1a2e',
  bgHeader:     '#12122a',
  bgRow:        'rgba(255, 255, 255, 0.03)',
  bgRowHover:   'rgba(201, 168, 76, 0.10)',
  bgRowActive:  'rgba(201, 168, 76, 0.18)',

  // ─── Borders ────────────────────────────────────────────────────
  borderPanel:  '2px solid #c9a84c',
  borderDim:    '1px solid #333',
  borderInput:  '1px solid rgba(201, 168, 76, 0.4)',
  borderSubtle: '1px solid rgba(201, 168, 76, 0.2)',

  // ─── Accents ────────────────────────────────────────────────────
  gold:         '#c9a84c',
  goldBright:   '#f1c40f',
  goldDim:      '#8a7530',
  goldGlow:     '0 0 40px rgba(201, 168, 76, 0.3)',
  goldGlowSm:   '0 0 12px rgba(201, 168, 76, 0.4)',

  // ─── Text ───────────────────────────────────────────────────────
  textPrimary:  '#e8d3a8',
  textSecondary:'#a89c80',
  textMuted:    '#6a5f4a',
  textBright:   '#ffffff',
  textDim:      '#666666',

  // ─── States ─────────────────────────────────────────────────────
  success:      '#27ae60',
  successBg:    'rgba(39, 174, 96, 0.15)',
  danger:       '#e74c3c',
  dangerBg:     'rgba(231, 76, 60, 0.15)',
  warning:      '#e67e22',
  warningBg:    'rgba(230, 126, 34, 0.15)',
  info:         '#3498db',
  infoBg:       'rgba(52, 152, 219, 0.15)',

  // ─── Rarity Colors ──────────────────────────────────────────────
  rarity: {
    junk:      '#888888',
    common:    '#ffffff',
    uncommon:  '#3498db',
    rare:      '#f1c40f',
    epic:      '#9b59b6',
    legendary: '#e67e22',
  },

  // ─── Typography ─────────────────────────────────────────────────
  fontFamily:    '"Segoe UI", Arial, sans-serif',
  fontHeading:   'bold 22px',
  fontSection:   'bold 14px',
  fontBody:      '13px',
  fontSmall:     '11px',
  fontTiny:      '10px',
  letterSpacing: '0.5px',
  letterSpacingHeading: '2px',

  // ─── Glyphs ─────────────────────────────────────────────────────
  closeChar:    '×',
  arrowUp:      '▲',
  arrowDown:    '▼',
  star:         '★',
  starEmpty:    '☆',
  check:        '✓',
  cross:        '✗',

  // ─── Spacing scale ──────────────────────────────────────────────
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },

  // ─── Radii ──────────────────────────────────────────────────────
  radius: {
    sm: '3px',
    md: '4px',
    lg: '6px',
    xl: '8px',
  },

  // ─── Status effect icons (emoji) ────────────────────────────────
  statusIcons: {
    poison:    '☠️',
    burning:   '🔥',
    bleeding:  '🩸',
    frozen:    '❄️',
    slowed:    '🐌',
    weakened:  '💀',
  },

  statusNames: {
    poison:    'Poisoned',
    burning:   'Burning',
    bleeding:  'Bleeding',
    frozen:    'Frozen',
    slowed:    'Slowed',
    weakened:  'Weakened',
  },

  statusDescriptions: {
    poison:    'Takes damage over time. Reduces healing.',
    burning:   'Takes fire damage over time.',
    bleeding:  'Takes physical damage over time.',
    frozen:    'Cannot move or attack briefly.',
    slowed:    'Movement and attack speed reduced.',
    weakened:  'Damage dealt reduced.',
  },
};

/**
 * Helper: get a rarity color, falling back to white for unknown rarities.
 */
export function rarityColor(rarity) {
  return UI_THEME.rarity[rarity] || UI_THEME.rarity.common;
}

/**
 * Helper: build a standard panel container element.
 */
export function createPanel({ width = 720, height = 560 } = {}) {
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: `${width}px`,
    height: `${height}px`,
    background: UI_THEME.bgPanel,
    border: UI_THEME.borderPanel,
    borderRadius: UI_THEME.radius.lg,
    boxShadow: UI_THEME.goldGlow,
    color: UI_THEME.textPrimary,
    fontFamily: UI_THEME.fontFamily,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  });
  return panel;
}

/**
 * Helper: build a standard panel header.
 */
export function createHeader(titleText) {
  const header = document.createElement('div');
  Object.assign(header.style, {
    background: UI_THEME.bgHeader,
    borderBottom: UI_THEME.borderSubtle,
    padding: '14px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: '0',
  });

  const title = document.createElement('div');
  title.textContent = titleText;
  Object.assign(title.style, {
    color: UI_THEME.gold,
    fontSize: '22px',
    fontWeight: 'bold',
    letterSpacing: UI_THEME.letterSpacingHeading,
    textShadow: '0 0 10px rgba(201, 168, 76, 0.4)',
  });
  header.appendChild(title);
  return { header, title };
}

/**
 * Helper: build a standard close button (× character).
 */
export function createCloseButton(onClick) {
  const btn = document.createElement('button');
  btn.textContent = UI_THEME.closeChar;
  btn.title = 'Close (Esc)';
  Object.assign(btn.style, {
    background: 'transparent',
    border: 'none',
    color: UI_THEME.textSecondary,
    fontSize: '28px',
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: '0 8px',
    lineHeight: '1',
    transition: 'color 0.15s',
  });
  btn.addEventListener('mouseenter', () => { btn.style.color = UI_THEME.gold; });
  btn.addEventListener('mouseleave', () => { btn.style.color = UI_THEME.textSecondary; });
  btn.addEventListener('click', onClick);
  return btn;
}

/**
 * Helper: build a standard "primary" gold button.
 */
export function createButton(text, onClick, { variant = 'primary', disabled = false } = {}) {
  const btn = document.createElement('button');
  btn.textContent = text;
  const colors = {
    primary: { fg: UI_THEME.gold, border: UI_THEME.gold, bg: 'rgba(201,168,76,0.05)', hover: 'rgba(201,168,76,0.20)' },
    danger:  { fg: UI_THEME.danger, border: UI_THEME.danger, bg: 'rgba(231,76,60,0.05)', hover: 'rgba(231,76,60,0.20)' },
    success: { fg: UI_THEME.success, border: UI_THEME.success, bg: 'rgba(39,174,96,0.05)', hover: 'rgba(39,174,96,0.20)' },
    warning: { fg: UI_THEME.warning, border: UI_THEME.warning, bg: 'rgba(230,126,34,0.05)', hover: 'rgba(230,126,34,0.20)' },
    ghost:   { fg: UI_THEME.textSecondary, border: '#444', bg: 'transparent', hover: 'rgba(255,255,255,0.05)' },
  }[variant] || { fg: UI_THEME.gold, border: UI_THEME.gold, bg: 'rgba(201,168,76,0.05)', hover: 'rgba(201,168,76,0.20)' };

  Object.assign(btn.style, {
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    color: colors.fg,
    padding: '8px 16px',
    fontFamily: UI_THEME.fontFamily,
    fontSize: '13px',
    fontWeight: 'bold',
    letterSpacing: '0.5px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: UI_THEME.radius.md,
    opacity: disabled ? '0.4' : '1',
    transition: 'background 0.15s, color 0.15s',
  });
  if (!disabled) {
    btn.addEventListener('mouseenter', () => { btn.style.background = colors.hover; });
    btn.addEventListener('mouseleave', () => { btn.style.background = colors.bg; });
    btn.addEventListener('click', onClick);
  }
  return btn;
}
