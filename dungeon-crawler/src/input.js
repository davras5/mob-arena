export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.moveVector = { x: 0, y: 0 };
    this.isTouching = false;
    this.joystickStart = null;
    this.joystickCurrent = null;

    // Mouse/action buttons
    this.leftClick = false;     // LMB pressed this frame
    this.leftHold = false;      // LMB held
    this.rightClick = false;    // RMB pressed this frame
    this.rightHold = false;     // RMB held
    this.interactPressed = false; // E/Space
    this.tabPressed = false;      // Tab (skill book)
    this.inventoryPressed = false; // I (inventory)
    this.potionPressed = false;   // Q (potion)
    this.skillBookPressed = false; // K (skill book)
    this.characterPressed = false; // C (character panel)
    this.hotbarPressed = [false, false, false, false]; // 1-4 (potion hotbar)
    this.altHeld = false;          // Alt (show loot labels, hold)
    this.helpPressed = false;      // F1 (controls help)

    // Mouse position (screen coords)
    this.mouseX = 0;
    this.mouseY = 0;

    // Touch
    this.joystickId = null;
    this.rightTouchId = null;

    // Callbacks
    this.onPause = null;

    this._bindKeyboard();
    this._bindTouch();
    this._bindMouse();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      const k = e.key.toLowerCase();
      if (k === 'e' || e.key === ' ') this.interactPressed = true;
      if (k === 'tab') { e.preventDefault(); this.tabPressed = true; }
      if (k === 'i') this.inventoryPressed = true;
      if (k === 'q') this.potionPressed = true;
      if (k === 'k') this.skillBookPressed = true;
      if (k === 'c') this.characterPressed = true;
      if (k === '1') this.hotbarPressed[0] = true;
      if (k === '2') this.hotbarPressed[1] = true;
      if (k === '3') this.hotbarPressed[2] = true;
      if (k === '4') this.hotbarPressed[3] = true;
      if (e.key === 'Alt') { e.preventDefault(); this.altHeld = true; }
      if (e.key === 'F1') { e.preventDefault(); this.helpPressed = true; }
      if (e.key === 'Escape' && this.onPause) this.onPause();
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
      if (e.key === 'Alt') this.altHeld = false;
    });
  }

  _bindTouch() {
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        const x = touch.clientX;
        const halfW = window.innerWidth / 2;

        if (x < halfW && this.joystickId === null) {
          this.joystickId = touch.identifier;
          this.joystickStart = { x: touch.clientX, y: touch.clientY };
          this.joystickCurrent = { x: touch.clientX, y: touch.clientY };
          this.isTouching = true;
        } else if (x >= halfW && this.rightTouchId === null) {
          this.rightTouchId = touch.identifier;
          this.rightClick = true;
          this.rightHold = true;
          // Also trigger left click for primary attack on tap
          this.leftClick = true;
          this.leftHold = true;
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === this.joystickId) {
          this.joystickCurrent = { x: touch.clientX, y: touch.clientY };
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === this.joystickId) {
          this.joystickId = null;
          this.joystickStart = null;
          this.joystickCurrent = null;
          this.isTouching = false;
        }
        if (touch.identifier === this.rightTouchId) {
          this.rightTouchId = null;
          this.rightHold = false;
          this.leftHold = false;
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchcancel', (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === this.joystickId) {
          this.joystickId = null;
          this.joystickStart = null;
          this.joystickCurrent = null;
          this.isTouching = false;
        }
        if (touch.identifier === this.rightTouchId) {
          this.rightTouchId = null;
          this.rightHold = false;
          this.leftHold = false;
        }
      }
    });
  }

  _bindMouse() {
    // Prevent context menu on right-click
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Track mouse position
    this.canvas.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left
        this.leftClick = true;
        this.leftHold = true;
      } else if (e.button === 2) { // Right
        this.rightClick = true;
        this.rightHold = true;
      }
    });
    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.leftHold = false;
      if (e.button === 2) this.rightHold = false;
    });
  }

  update() {
    // Keyboard movement
    let kx = 0, ky = 0;
    if (this.keys['w'] || this.keys['arrowup']) ky -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) ky += 1;
    if (this.keys['a'] || this.keys['arrowleft']) kx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) kx += 1;

    if (kx !== 0 || ky !== 0) {
      const len = Math.sqrt(kx * kx + ky * ky);
      this.moveVector.x = kx / len;
      this.moveVector.y = ky / len;
    } else if (this.joystickStart && this.joystickCurrent) {
      const dx = this.joystickCurrent.x - this.joystickStart.x;
      const dy = this.joystickCurrent.y - this.joystickStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = 50;
      if (dist > 5) {
        const clamped = Math.min(dist, maxDist);
        this.moveVector.x = (dx / dist) * (clamped / maxDist);
        this.moveVector.y = (dy / dist) * (clamped / maxDist);
      } else {
        this.moveVector.x = 0;
        this.moveVector.y = 0;
      }
    } else {
      this.moveVector.x = 0;
      this.moveVector.y = 0;
    }
  }

  consumeLeftClick() {
    const val = this.leftClick;
    this.leftClick = false;
    return val;
  }

  consumeRightClick() {
    const val = this.rightClick;
    this.rightClick = false;
    return val;
  }

  // Legacy compatibility
  consumeRightTap() {
    return this.consumeRightClick();
  }

  consumeInteract() {
    const val = this.interactPressed;
    this.interactPressed = false;
    return val;
  }

  consumeTab() {
    const val = this.tabPressed;
    this.tabPressed = false;
    return val;
  }

  consumeInventory() {
    const val = this.inventoryPressed;
    this.inventoryPressed = false;
    return val;
  }

  consumePotion() {
    const val = this.potionPressed;
    this.potionPressed = false;
    return val;
  }

  consumeSkillBook() {
    const val = this.skillBookPressed;
    this.skillBookPressed = false;
    return val;
  }

  consumeCharacter() {
    const val = this.characterPressed;
    this.characterPressed = false;
    return val;
  }

  consumeHotbar(slot) {
    const val = this.hotbarPressed[slot];
    this.hotbarPressed[slot] = false;
    return val;
  }

  consumeHelp() {
    const val = this.helpPressed;
    this.helpPressed = false;
    return val;
  }
}
