/**
 * Reusable floating tooltip component.
 *
 * Singleton pattern — there's only one tooltip element shared across the whole game.
 * This avoids creating/destroying DOM nodes constantly.
 *
 * Usage:
 *   import { Tooltip } from './tooltip.js';
 *
 *   // Static method:
 *   Tooltip.attach(myElement, () => 'Hover text or HTML');
 *
 *   // Or imperative:
 *   Tooltip.show('My tip', x, y);
 *   Tooltip.hide();
 */

import { UI_THEME } from './uiTheme.js';

class TooltipImpl {
  constructor() {
    this.el = null;
    this._hideTimer = null;
    this._currentTarget = null;
  }

  _ensureEl() {
    if (this.el) return;
    const el = document.createElement('div');
    el.id = 'game-tooltip';
    Object.assign(el.style, {
      position: 'fixed',
      zIndex: '99999',
      background: 'rgba(15, 12, 8, 0.96)',
      border: `1px solid ${UI_THEME.gold}`,
      borderRadius: UI_THEME.radius.md,
      padding: '8px 12px',
      color: UI_THEME.textPrimary,
      fontFamily: UI_THEME.fontFamily,
      fontSize: UI_THEME.fontBody,
      lineHeight: '1.4',
      maxWidth: '280px',
      pointerEvents: 'none',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.7), 0 0 8px rgba(201, 168, 76, 0.3)',
      opacity: '0',
      transition: 'opacity 0.12s',
      display: 'none',
    });
    document.body.appendChild(el);
    this.el = el;
  }

  show(content, x, y) {
    this._ensureEl();
    if (typeof content === 'string') {
      this.el.innerHTML = content;
    } else {
      this.el.innerHTML = '';
      this.el.appendChild(content);
    }
    this.el.style.display = 'block';
    // Force layout so we can measure
    this.el.offsetHeight;
    // Position with edge-flip
    const rect = this.el.getBoundingClientRect();
    const pad = 12;
    let px = x + pad;
    let py = y + pad;
    if (px + rect.width > window.innerWidth - 8) {
      px = x - rect.width - pad;
    }
    if (py + rect.height > window.innerHeight - 8) {
      py = y - rect.height - pad;
    }
    if (px < 8) px = 8;
    if (py < 8) py = 8;
    this.el.style.left = `${px}px`;
    this.el.style.top = `${py}px`;
    this.el.style.opacity = '1';
  }

  hide() {
    if (!this.el) return;
    this.el.style.opacity = '0';
    if (this._hideTimer) clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => {
      if (this.el) this.el.style.display = 'none';
    }, 120);
  }

  /**
   * Attach tooltip behavior to a DOM element.
   * @param {HTMLElement} target
   * @param {function|string} contentFn — function returning HTML, or static string
   */
  attach(target, contentFn) {
    if (!target || target._tooltipAttached) return;
    target._tooltipAttached = true;
    let lastEvent = null;
    const onEnter = (e) => {
      lastEvent = e;
      this._currentTarget = target;
      const content = typeof contentFn === 'function' ? contentFn() : contentFn;
      if (content) this.show(content, e.clientX, e.clientY);
    };
    const onMove = (e) => {
      if (this._currentTarget !== target) return;
      // Reposition while hovering
      if (this.el && this.el.style.display === 'block') {
        const rect = this.el.getBoundingClientRect();
        const pad = 12;
        let px = e.clientX + pad;
        let py = e.clientY + pad;
        if (px + rect.width > window.innerWidth - 8) px = e.clientX - rect.width - pad;
        if (py + rect.height > window.innerHeight - 8) py = e.clientY - rect.height - pad;
        if (px < 8) px = 8;
        if (py < 8) py = 8;
        this.el.style.left = `${px}px`;
        this.el.style.top = `${py}px`;
      }
    };
    const onLeave = () => {
      this._currentTarget = null;
      this.hide();
    };
    target.addEventListener('mouseenter', onEnter);
    target.addEventListener('mousemove', onMove);
    target.addEventListener('mouseleave', onLeave);
    // Store handlers so we can detach later if needed
    target._tooltipHandlers = { onEnter, onMove, onLeave };
  }

  /**
   * Detach tooltip from an element.
   */
  detach(target) {
    if (!target || !target._tooltipAttached) return;
    const h = target._tooltipHandlers;
    if (h) {
      target.removeEventListener('mouseenter', h.onEnter);
      target.removeEventListener('mousemove', h.onMove);
      target.removeEventListener('mouseleave', h.onLeave);
    }
    target._tooltipAttached = false;
    target._tooltipHandlers = null;
  }
}

const _instance = new TooltipImpl();

export const Tooltip = {
  show: (content, x, y) => _instance.show(content, x, y),
  hide: () => _instance.hide(),
  attach: (target, contentFn) => _instance.attach(target, contentFn),
  detach: (target) => _instance.detach(target),
};
