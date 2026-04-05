export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  emit(x, y, count, color, opts = {}) {
    const speed = opts.speed || 100;
    const size = opts.size || 3;
    const life = opts.life || 0.5;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.5 + Math.random() * 0.5);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color: opts.colors ? opts.colors[Math.floor(Math.random() * opts.colors.length)] : color,
        size: size * (0.5 + Math.random()),
        alpha: 1,
        life: life * (0.7 + Math.random() * 0.6),
        maxLife: life,
      });
    }
  }

  confetti(x, y) {
    this.emit(x, y, 30, '#f1c40f', {
      speed: 200,
      size: 4,
      life: 1.0,
      colors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'],
    });
  }

  deathBurst(x, y, color) {
    this.emit(x, y, 12, color, { speed: 80, size: 3, life: 0.4 });
    this.emit(x, y, 6, '#fff', { speed: 60, size: 1.5, life: 0.25 });
    this.ring(x, y, color);
  }

  ring(x, y, color, maxRadius = 30) {
    this.particles.push({
      x, y, vx: 0, vy: 0,
      color, size: 0, alpha: 0.6,
      life: 0.3, maxLife: 0.3,
      isRing: true, maxRadius
    });
  }

  update(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }
}
