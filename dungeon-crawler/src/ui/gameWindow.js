/* ---------------------------------------------------------------
 *  GameWindow — reusable draggable window wrapper for in-game panels
 *
 *  Non-modal, draggable, closeable windows that replace the
 *  full-screen modal pattern.  Multiple windows can be open at
 *  once; clicking a window brings it to front.
 *
 *  Usage:
 *    const win = new GameWindow({ title: 'Inventory', width: 500 });
 *    win.setContent(myDomElement);
 *    win.open();
 *
 *  All DOM is built with createElement + inline styles so the file
 *  is self-contained (no external CSS required).
 * --------------------------------------------------------------- */

let _windowIdCounter = 0;

class GameWindow {
  /* ---- static bookkeeping ---- */
  static topZ = 1000;
  static openWindows = [];

  /**
   * @param {Object} options
   * @param {string}   options.title      — window title text
   * @param {number}   [options.width=400]
   * @param {number}   [options.height=500]
   * @param {number}   [options.x]        — initial left position (default: centered)
   * @param {number}   [options.y]        — initial top  position (default: centered)
   * @param {boolean}  [options.closable=true]
   * @param {Function} [options.onClose]
   * @param {Function} [options.onDragStart]
   * @param {string}   [options.className]
   */
  constructor(options = {}) {
    this.title     = options.title     ?? 'Window';
    this.width     = options.width     ?? 400;
    this.height    = options.height    ?? 500;
    this.initX     = options.x         ?? null;
    this.initY     = options.y         ?? null;
    this.closable  = options.closable  ?? true;
    this.onClose   = options.onClose   ?? null;
    this.onDragStart = options.onDragStart ?? null;
    this.className = options.className ?? null;

    this.id        = `game-window-${++_windowIdCounter}`;
    this.isOpen    = false;
    this.element   = null;   // root DOM element
    this.contentEl = null;   // content area container

    /* drag state */
    this._dragging = false;
    this._dragOffX = 0;
    this._dragOffY = 0;

    /* bound handlers (so we can remove them) */
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp   = this._onMouseUp.bind(this);
    this._onKeyDown   = this._onKeyDown.bind(this);

    this._createDOM();
  }

  /* ==============================================================
   *  Public API
   * ============================================================== */

  /** Show the window, appending to document.body if needed. */
  open() {
    if (this.isOpen) {
      this.bringToFront();
      return;
    }

    if (!this.element.parentNode) {
      document.body.appendChild(this.element);
    }
    this.element.style.display = 'flex';
    this.isOpen = true;

    /* position: use explicit coords or center on screen */
    if (this.initX !== null && this.initY !== null) {
      this.element.style.left = `${this.initX}px`;
      this.element.style.top  = `${this.initY}px`;
    } else {
      const cx = (window.innerWidth  - this.width)  / 2;
      const cy = (window.innerHeight - this.height) / 2;
      this.element.style.left = `${Math.max(0, cx)}px`;
      this.element.style.top  = `${Math.max(0, cy)}px`;
    }

    GameWindow.openWindows.push(this);
    this.bringToFront();

    /* ESC listener (attached once; shared check in handler) */
    document.addEventListener('keydown', this._onKeyDown);
  }

  /** Hide and remove from DOM. Fires onClose callback. */
  close() {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.element.style.display = 'none';

    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    const idx = GameWindow.openWindows.indexOf(this);
    if (idx !== -1) GameWindow.openWindows.splice(idx, 1);

    document.removeEventListener('keydown', this._onKeyDown);

    if (this.onClose) this.onClose();
  }

  /** Toggle open/close. */
  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** Bring this window above all others. */
  bringToFront() {
    GameWindow.topZ += 1;
    this.element.style.zIndex = GameWindow.topZ;
  }

  /**
   * Set the content area.
   * @param {HTMLElement|string} htmlOrElement — DOM element or HTML string
   */
  setContent(htmlOrElement) {
    if (typeof htmlOrElement === 'string') {
      this.contentEl.innerHTML = htmlOrElement;
    } else {
      this.contentEl.innerHTML = '';
      this.contentEl.appendChild(htmlOrElement);
    }
  }

  /** Returns the content container for direct DOM manipulation. */
  getContentEl() {
    return this.contentEl;
  }

  /* ==============================================================
   *  Static helpers
   * ============================================================== */

  /** Close every open GameWindow. */
  static closeAll() {
    /* iterate a copy because close() mutates the array */
    [...GameWindow.openWindows].forEach(w => w.close());
  }

  /* ==============================================================
   *  Internal — DOM creation
   * ============================================================== */

  _createDOM() {
    /* ---- root container ---- */
    const el = document.createElement('div');
    el.id = this.id;
    if (this.className) el.classList.add(this.className);

    Object.assign(el.style, {
      position:      'fixed',
      display:       'none',
      flexDirection: 'column',
      width:         `${this.width}px`,
      height:        `${this.height}px`,
      background:    'rgba(20, 18, 15, 0.92)',
      border:        '1px solid rgba(180, 160, 120, 0.4)',
      borderRadius:  '4px',
      boxShadow:     '0 4px 24px rgba(0,0,0,0.6), 0 0 1px rgba(180,160,120,0.3)',
      overflow:      'hidden',
      fontFamily:    'monospace',
      color:         '#d4c8a0',
      userSelect:    'none',
    });

    /* ---- title bar ---- */
    const titleBar = document.createElement('div');
    Object.assign(titleBar.style, {
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      height:         '30px',
      minHeight:      '30px',
      padding:        '0 8px',
      background:     'rgba(12, 10, 8, 0.95)',
      borderBottom:   '1px solid rgba(180, 160, 120, 0.3)',
      cursor:         'move',
    });

    const titleText = document.createElement('span');
    titleText.textContent = this.title;
    Object.assign(titleText.style, {
      color:        '#c8a84e',
      fontSize:     '13px',
      fontWeight:   'bold',
      letterSpacing:'0.5px',
      overflow:     'hidden',
      whiteSpace:   'nowrap',
      textOverflow: 'ellipsis',
      pointerEvents:'none',
    });
    titleBar.appendChild(titleText);

    /* close button */
    if (this.closable) {
      const closeBtn = document.createElement('span');
      closeBtn.textContent = '\u00D7'; // ×
      Object.assign(closeBtn.style, {
        color:       '#a09070',
        fontSize:    '18px',
        lineHeight:  '30px',
        cursor:      'pointer',
        padding:     '0 2px',
        marginLeft:  '8px',
        fontWeight:  'bold',
      });
      closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#e0c060'; });
      closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = '#a09070'; });
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close();
      });
      titleBar.appendChild(closeBtn);
    }

    el.appendChild(titleBar);

    /* ---- content area ---- */
    const content = document.createElement('div');
    Object.assign(content.style, {
      flex:       '1',
      overflowY:  'auto',
      overflowX:  'hidden',
      padding:    '10px',
    });
    el.appendChild(content);

    /* ---- store refs ---- */
    this.element   = el;
    this.contentEl = content;
    this._titleBar = titleBar;

    /* ---- bring to front on any mousedown inside the window ---- */
    el.addEventListener('mousedown', () => this.bringToFront());

    /* ---- set up drag ---- */
    this._setupDrag();
  }

  /* ==============================================================
   *  Internal — drag handling
   * ============================================================== */

  _setupDrag() {
    this._titleBar.addEventListener('mousedown', (e) => {
      /* ignore clicks on the close button */
      if (e.target.tagName === 'SPAN' && e.target.textContent === '\u00D7') return;

      e.preventDefault();
      this._dragging = true;

      const rect = this.element.getBoundingClientRect();
      this._dragOffX = e.clientX - rect.left;
      this._dragOffY = e.clientY - rect.top;

      if (this.onDragStart) this.onDragStart();

      document.addEventListener('mousemove', this._onMouseMove);
      document.addEventListener('mouseup',   this._onMouseUp);
    });
  }

  _onMouseMove(e) {
    if (!this._dragging) return;

    let newX = e.clientX - this._dragOffX;
    let newY = e.clientY - this._dragOffY;

    /* constrain to viewport */
    const maxX = window.innerWidth  - this.element.offsetWidth;
    const maxY = window.innerHeight - this.element.offsetHeight;
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    this.element.style.left = `${newX}px`;
    this.element.style.top  = `${newY}px`;
  }

  _onMouseUp() {
    this._dragging = false;
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup',   this._onMouseUp);
  }

  /* ---- ESC closes the topmost window ---- */
  _onKeyDown(e) {
    if (e.key !== 'Escape') return;

    /* only the topmost window responds */
    const topWindow = GameWindow.openWindows
      .filter(w => w.isOpen)
      .sort((a, b) => {
        const zA = parseInt(a.element.style.zIndex) || 0;
        const zB = parseInt(b.element.style.zIndex) || 0;
        return zB - zA;
      })[0];

    if (topWindow === this) {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    }
  }
}

export { GameWindow };
