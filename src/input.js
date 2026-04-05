export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.moveVector = { x: 0, y: 0 };
    this.isTouching = false;
    this.joystickStart = null;
    this.joystickCurrent = null;
    this.rightTap = false;
    this.rightHold = false;
    this.joystickId = null;
    this.rightTouchId = null;
    this.onPause = null;

    this._bindKeyboard();
    this._bindTouch();
    this._bindMouse();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.key === 'Escape' && this.onPause) {
        this.onPause();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
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
          this.rightTap = true;
          this.rightHold = true;
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
        }
      }
    });
  }

  _bindMouse() {
    // Mouse click anywhere fires
    this.canvas.addEventListener('mousedown', () => {
      this.rightTap = true;
      this.rightHold = true;
    });
    this.canvas.addEventListener('mouseup', () => {
      this.rightHold = false;
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
      // Touch joystick
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

  consumeRightTap() {
    const val = this.rightTap;
    this.rightTap = false;
    return val;
  }
}
