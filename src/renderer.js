export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = { x: 0, y: 0 };
    this.mapWidth = 1600;
    this.mapHeight = 1600;
    this.tileSize = 64;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  updateCamera(player) {
    this.camera.x = player.x - this.canvas.width / 2;
    this.camera.y = player.y - this.canvas.height / 2;

    // Clamp
    this.camera.x = Math.max(0, Math.min(this.mapWidth - this.canvas.width, this.camera.x));
    this.camera.y = Math.max(0, Math.min(this.mapHeight - this.canvas.height, this.camera.y));
  }

  clear() {
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawMap() {
    const ctx = this.ctx;
    const startCol = Math.floor(this.camera.x / this.tileSize);
    const endCol = Math.ceil((this.camera.x + this.canvas.width) / this.tileSize);
    const startRow = Math.floor(this.camera.y / this.tileSize);
    const endRow = Math.ceil((this.camera.y + this.canvas.height) / this.tileSize);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const sx = c * this.tileSize - this.camera.x;
        const sy = r * this.tileSize - this.camera.y;

        // Dark stone tile pattern
        const shade = ((r + c) % 2 === 0) ? '#1a1a1a' : '#1e1e1e';
        ctx.fillStyle = shade;
        ctx.fillRect(sx, sy, this.tileSize, this.tileSize);

        // Subtle grid line
        ctx.strokeStyle = '#252525';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(sx, sy, this.tileSize, this.tileSize);
      }
    }

    // Draw map boundary
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 3;
    ctx.strokeRect(-this.camera.x, -this.camera.y, this.mapWidth, this.mapHeight);
  }

  drawBlessings(blessings, time) {
    const ctx = this.ctx;
    for (const b of blessings) {
      const sx = b.x - this.camera.x;
      const sy = b.y - this.camera.y;

      // Bobbing
      const bob = Math.sin(time * 3 + b.x) * 4;

      // Glow
      const glowRadius = 30 + Math.sin(time * 4) * 5;
      const gradient = ctx.createRadialGradient(sx, sy + bob, 0, sx, sy + bob, glowRadius);
      gradient.addColorStop(0, 'rgba(241, 196, 15, 0.4)');
      gradient.addColorStop(1, 'rgba(241, 196, 15, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(sx, sy + bob, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(sx, sy + bob, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx, sy + bob, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPlayer(player) {
    const ctx = this.ctx;
    const sx = player.x - this.camera.x;
    const sy = player.y - this.camera.y;

    // Shield visual
    if (player.shieldHP > 0) {
      ctx.strokeStyle = 'rgba(52, 152, 219, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, player.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Player body
    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.arc(sx, sy, player.radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner highlight
    ctx.fillStyle = '#5dade2';
    ctx.beginPath();
    ctx.arc(sx - 3, sy - 3, player.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Aim direction indicator
    if (player.aimAngle !== null) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(player.aimAngle) * player.radius,
                 sy + Math.sin(player.aimAngle) * player.radius);
      ctx.lineTo(sx + Math.cos(player.aimAngle) * (player.radius + 10),
                 sy + Math.sin(player.aimAngle) * (player.radius + 10));
      ctx.stroke();
    }
  }

  drawEnemies(enemies) {
    const ctx = this.ctx;
    for (const e of enemies) {
      const sx = e.x - this.camera.x;
      const sy = e.y - this.camera.y;

      // Skip if offscreen
      if (sx < -50 || sx > this.canvas.width + 50 || sy < -50 || sy > this.canvas.height + 50) continue;

      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(sx, sy, e.radius, 0, Math.PI * 2);
      ctx.fill();

      // Dark outline
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // HP bar for damaged enemies
      if (e.hp < e.maxHP) {
        const barW = e.radius * 2.5;
        const barH = 4;
        const bx = sx - barW / 2;
        const by = sy - e.radius - 10;
        ctx.fillStyle = '#333';
        ctx.fillRect(bx, by, barW, barH);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(bx, by, barW * (e.hp / e.maxHP), barH);
      }
    }
  }

  drawBoss(boss) {
    if (!boss) return;
    const ctx = this.ctx;
    const sx = boss.x - this.camera.x;
    const sy = boss.y - this.camera.y;

    // Boss aura
    const auraRadius = boss.radius + 10 + Math.sin(Date.now() / 200) * 5;
    ctx.strokeStyle = boss.phase === 2 ? 'rgba(231, 76, 60, 0.4)' : 'rgba(155, 89, 182, 0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, auraRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Body
    ctx.fillStyle = boss.color;
    ctx.beginPath();
    ctx.arc(sx, sy, boss.radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner pattern
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(sx, sy, boss.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = boss.phase === 2 ? '#e74c3c' : '#fff';
    ctx.beginPath();
    ctx.arc(sx - boss.radius * 0.3, sy - boss.radius * 0.2, 4, 0, Math.PI * 2);
    ctx.arc(sx + boss.radius * 0.3, sy - boss.radius * 0.2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawProjectiles(projectiles) {
    const ctx = this.ctx;
    for (const p of projectiles) {
      const sx = p.x - this.camera.x;
      const sy = p.y - this.camera.y;

      if (sx < -20 || sx > this.canvas.width + 20 || sy < -20 || sy > this.canvas.height + 20) continue;

      if (p.isEnemy) {
        ctx.fillStyle = '#e74c3c';
      } else {
        ctx.fillStyle = '#f1c40f';
      }
      ctx.beginPath();
      ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Trail
      ctx.fillStyle = p.isEnemy ? 'rgba(231, 76, 60, 0.3)' : 'rgba(241, 196, 15, 0.3)';
      ctx.beginPath();
      ctx.arc(sx - p.vx * 0.03, sy - p.vy * 0.03, p.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawParticles(particles) {
    const ctx = this.ctx;
    for (const p of particles) {
      const sx = p.x - this.camera.x;
      const sy = p.y - this.camera.y;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawFireTrails(trails) {
    const ctx = this.ctx;
    for (const t of trails) {
      const sx = t.x - this.camera.x;
      const sy = t.y - this.camera.y;
      ctx.globalAlpha = t.alpha * 0.6;
      ctx.fillStyle = '#e67e22';
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawFrostAura(player, radius) {
    if (radius <= 0) return;
    const ctx = this.ctx;
    const sx = player.x - this.camera.x;
    const sy = player.y - this.camera.y;
    const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
    gradient.addColorStop(0, 'rgba(52, 152, 219, 0)');
    gradient.addColorStop(0.7, 'rgba(52, 152, 219, 0.05)');
    gradient.addColorStop(1, 'rgba(52, 152, 219, 0.15)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  drawChainLightning(chains) {
    const ctx = this.ctx;
    for (const c of chains) {
      const sx1 = c.x1 - this.camera.x;
      const sy1 = c.y1 - this.camera.y;
      const sx2 = c.x2 - this.camera.x;
      const sy2 = c.y2 - this.camera.y;
      ctx.globalAlpha = c.alpha;
      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      // Jagged line
      const segments = 5;
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const mx = sx1 + (sx2 - sx1) * t + (Math.random() - 0.5) * 15;
        const my = sy1 + (sy2 - sy1) * t + (Math.random() - 0.5) * 15;
        ctx.lineTo(mx, my);
      }
      ctx.lineTo(sx2, sy2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawJoystick(input) {
    if (!input.joystickStart || !input.joystickCurrent) return;
    const ctx = this.ctx;
    // Base
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(input.joystickStart.x, input.joystickStart.y, 50, 0, Math.PI * 2);
    ctx.fill();
    // Thumb
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(input.joystickCurrent.x, input.joystickCurrent.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
