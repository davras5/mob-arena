export class DamageNumbers {
  constructor() {
    this.numbers = [];
  }

  spawn(x, y, amount, isCrit = false) {
    this.numbers.push({
      x: x + (Math.random() - 0.5) * 20,
      y,
      amount: Math.round(amount),
      isCrit,
      timer: 0,
      duration: isCrit ? 1.0 : 0.75,
      vy: -60,
    });
  }

  update(dt) {
    for (const n of this.numbers) {
      n.timer += dt;
      n.y += n.vy * dt;
      n.vy *= 0.97; // decelerate upward movement
    }
    this.numbers = this.numbers.filter(n => n.timer < n.duration);
  }

  render(ctx, camera) {
    for (const n of this.numbers) {
      const sx = n.x - camera.x;
      const sy = n.y - camera.y;

      // Skip offscreen
      if (sx < -50 || sx > ctx.canvas.width + 50 || sy < -50 || sy > ctx.canvas.height + 50) continue;

      const progress = n.timer / n.duration;
      const alpha = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;
      const scale = n.isCrit ? 1.0 + (1 - progress) * 0.5 : 1.0;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${Math.round(16 * scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Outline
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText(n.amount, sx, sy);

      // Fill
      ctx.fillStyle = n.isCrit ? '#e74c3c' : '#f1c40f';
      ctx.fillText(n.amount, sx, sy);

      ctx.restore();
    }
  }
}
