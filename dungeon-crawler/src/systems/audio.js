export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterVolume = 0.3;
  }

  _ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _playTone(freq, duration, type = 'square', volume = 1.0) {
    if (!this.enabled) return;
    this._ensureContext();
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(this.masterVolume * volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  _playNoise(duration, volume = 0.3) {
    if (!this.enabled) return;
    this._ensureContext();
    const ctx = this.ctx;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(this.masterVolume * volume, ctx.currentTime);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  shoot() {
    this._playTone(800, 0.08, 'square', 0.4);
    this._playTone(600, 0.06, 'square', 0.2);
  }

  enemyHit() {
    this._playTone(300, 0.05, 'square', 0.25);
  }

  enemyDeath() {
    this._playTone(200, 0.15, 'sawtooth', 0.35);
    this._playTone(150, 0.1, 'square', 0.2);
  }

  playerHit() {
    this._playTone(150, 0.2, 'sawtooth', 0.5);
    this._playNoise(0.1, 0.3);
  }

  explosion() {
    this._playNoise(0.3, 0.5);
    this._playTone(80, 0.3, 'sine', 0.4);
  }

  waveClear() {
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 0.2, 'sine', 0.5), i * 100);
    });
  }

  levelUp() {
    this._playTone(660, 0.15, 'sine', 0.5);
    setTimeout(() => this._playTone(880, 0.2, 'sine', 0.5), 100);
  }

  bossAppear() {
    this._playTone(100, 0.5, 'sawtooth', 0.6);
    setTimeout(() => this._playTone(80, 0.5, 'sawtooth', 0.4), 200);
  }

  dash() {
    this._playTone(400, 0.08, 'sine', 0.3);
    this._playTone(600, 0.06, 'sine', 0.2);
  }

  chainLightning() {
    this._playNoise(0.15, 0.3);
    this._playTone(1200, 0.1, 'square', 0.2);
  }

  gameOver() {
    const notes = [440, 370, 330, 262];
    notes.forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 0.3, 'sine', 0.5), i * 200);
    });
  }

  buttonClick() {
    this._playTone(500, 0.05, 'sine', 0.3);
  }
}
