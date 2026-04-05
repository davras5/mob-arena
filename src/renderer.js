export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = { x: 0, y: 0 };
    this.mapWidth = 1600;
    this.mapHeight = 1600;
    this.tileSize = 64;

    // Theme colors (defaults)
    this.tilePrimary = '#1a1a1a';
    this.tileSecondary = '#1e1e1e';
    this.tileGrid = '#252525';
    this.borderColor = '#444';

    // Screen flash effect
    this.flashColor = null;
    this.flashTimer = 0;
    this.flashDuration = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setTheme(config) {
    this.mapWidth = config.mapWidth || 1600;
    this.mapHeight = config.mapHeight || 1600;
    this.tilePrimary = config.tilePrimary || '#1a1a1a';
    this.tileSecondary = config.tileSecondary || '#1e1e1e';
    this.tileGrid = config.tileGrid || '#252525';
    this.borderColor = config.borderColor || '#444';
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
        const shade = ((r + c) % 2 === 0) ? this.tilePrimary : this.tileSecondary;
        ctx.fillStyle = shade;
        ctx.fillRect(sx, sy, this.tileSize, this.tileSize);

        // Subtle grid line
        ctx.strokeStyle = this.tileGrid;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(sx, sy, this.tileSize, this.tileSize);
      }
    }

    // Draw map boundary
    ctx.strokeStyle = this.borderColor;
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

      // Urgency: blink faster as timer runs low
      const urgency = b.timer < 5 ? (Math.sin(time * 10) > 0 ? 1 : 0.3) : 1;

      // Glow
      const glowRadius = 30 + Math.sin(time * 4) * 5;
      const gradient = ctx.createRadialGradient(sx, sy + bob, 0, sx, sy + bob, glowRadius);
      gradient.addColorStop(0, `rgba(241, 196, 15, ${0.4 * urgency})`);
      gradient.addColorStop(1, 'rgba(241, 196, 15, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(sx, sy + bob, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.globalAlpha = urgency;
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(sx, sy + bob, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx, sy + bob, 5, 0, Math.PI * 2);
      ctx.fill();

      // Timer text
      ctx.fillStyle = b.timer < 5 ? '#e74c3c' : '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.ceil(b.timer) + 's', sx, sy + bob - 18);

      // Timer ring (circular countdown)
      const timerPct = b.timer / b.maxTimer;
      ctx.strokeStyle = b.timer < 5 ? '#e74c3c' : '#f1c40f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy + bob, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * timerPct);
      ctx.stroke();

      ctx.globalAlpha = 1;
    }
  }

  drawBlessingIndicators(blessings, player) {
    // Draw edge-of-screen arrows pointing to off-screen blessings
    const ctx = this.ctx;
    const margin = 40;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    for (const b of blessings) {
      const sx = b.x - this.camera.x;
      const sy = b.y - this.camera.y;

      // Only draw indicator if blessing is off-screen
      if (sx >= -10 && sx <= cw + 10 && sy >= -10 && sy <= ch + 10) continue;

      // Direction from screen center to blessing
      const px = player.x - this.camera.x;
      const py = player.y - this.camera.y;
      const dx = sx - px;
      const dy = sy - py;
      const angle = Math.atan2(dy, dx);

      // Position the arrow at the edge of the screen
      let ax, ay;
      const edgeMargin = margin;

      // Find intersection with screen edges
      const slopes = [
        { x: cw - edgeMargin, y: py + dy * (cw - edgeMargin - px) / dx }, // Right
        { x: edgeMargin, y: py + dy * (edgeMargin - px) / dx },          // Left
        { x: px + dx * (ch - edgeMargin - py) / dy, y: ch - edgeMargin }, // Bottom
        { x: px + dx * (edgeMargin - py) / dy, y: edgeMargin },          // Top
      ];

      ax = px + Math.cos(angle) * 100;
      ay = py + Math.sin(angle) * 100;

      // Clamp to screen edges
      ax = Math.max(edgeMargin, Math.min(cw - edgeMargin, ax));
      ay = Math.max(edgeMargin, Math.min(ch - edgeMargin, ay));

      // Pulsing
      const pulse = 0.7 + Math.sin(Date.now() / 300) * 0.3;

      // Arrow triangle
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(angle);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = b.timer < 5 ? '#e74c3c' : '#f1c40f';
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-6, -8);
      ctx.lineTo(-6, 8);
      ctx.closePath();
      ctx.fill();

      // Distance text
      const dist = Math.round(Math.sqrt(dx * dx + dy * dy));
      ctx.rotate(-angle);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.ceil(b.timer) + 's', 0, -14);
      ctx.globalAlpha = 1;
      ctx.restore();
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

      ctx.fillStyle = e.hitFlashTimer > 0 ? '#fff' : e.color;
      ctx.beginPath();
      const drawRadius = e.radius * (e.scale !== undefined ? e.scale : 1);
      ctx.arc(sx, sy, drawRadius, 0, Math.PI * 2);
      ctx.fill();

      // Dark outline
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // HP bar for damaged enemies
      if (e.hp < e.maxHP) {
        const barW = drawRadius * 2.5;
        const barH = 4;
        const bx = sx - barW / 2;
        const by = sy - drawRadius - 10;
        ctx.fillStyle = '#333';
        ctx.fillRect(bx, by, barW, barH);
        const hpPct = e.hp / e.maxHP;
        ctx.fillStyle = hpPct > 0.6 ? '#2ecc71' : hpPct > 0.3 ? '#f1c40f' : '#e74c3c';
        ctx.fillRect(bx, by, barW * hpPct, barH);
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

      if (!p.isEnemy) {
        const glowColor = p.isRocket ? '155, 89, 182' : '241, 196, 15';
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.radius * 3);
        glow.addColorStop(0, `rgba(${glowColor}, 0.3)`);
        glow.addColorStop(1, `rgba(${glowColor}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, p.radius * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      if (p.isEnemy) {
        ctx.fillStyle = '#e74c3c';
      } else if (p.isRocket) {
        ctx.fillStyle = '#9b59b6';
      } else {
        ctx.fillStyle = '#f1c40f';
      }
      ctx.beginPath();
      ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Trail
      const trailColor = p.isEnemy ? 'rgba(231, 76, 60, 0.3)' : p.isRocket ? 'rgba(155, 89, 182, 0.3)' : 'rgba(241, 196, 15, 0.3)';
      ctx.fillStyle = trailColor;
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
      if (p.isRing) {
        const progress = 1 - p.life / p.maxLife;
        const radius = p.maxRadius * progress;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
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

  drawWeaponPickups(pickups, time) {
    const ctx = this.ctx;
    for (const wp of pickups) {
      const sx = wp.x - this.camera.x;
      const sy = wp.y - this.camera.y;

      // Bobbing
      const bob = Math.sin(time * 3 + wp.x * 0.1) * 5;

      // Urgency blink when timer low
      const urgency = wp.timer < 3 ? (Math.sin(time * 10) > 0 ? 1 : 0.3) : 1;

      // Glow
      const glowRadius = 28 + Math.sin(time * 4) * 4;
      const gradient = ctx.createRadialGradient(sx, sy + bob, 0, sx, sy + bob, glowRadius);
      gradient.addColorStop(0, wp.weapon.color + '66');
      gradient.addColorStop(1, wp.weapon.color + '00');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(sx, sy + bob, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Diamond shape
      ctx.globalAlpha = urgency;
      ctx.fillStyle = wp.weapon.color;
      ctx.save();
      ctx.translate(sx, sy + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-8, -8, 16, 16);
      ctx.restore();

      // Icon text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(wp.weapon.icon, sx, sy + bob);

      // Weapon name label
      ctx.fillStyle = wp.weapon.color;
      ctx.font = 'bold 11px sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(wp.weapon.name, sx, sy + bob - 20);

      // Timer text
      ctx.fillStyle = wp.timer < 3 ? '#e74c3c' : '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(Math.ceil(wp.timer) + 's', sx, sy + bob + 22);

      ctx.globalAlpha = 1;
      ctx.textBaseline = 'alphabetic';
    }
  }

  drawLaserBeams(beams) {
    const ctx = this.ctx;
    for (const b of beams) {
      const sx1 = b.x1 - this.camera.x;
      const sy1 = b.y1 - this.camera.y;
      const sx2 = b.x2 - this.camera.x;
      const sy2 = b.y2 - this.camera.y;

      ctx.globalAlpha = b.alpha;

      // Outer glow
      ctx.strokeStyle = b.color || '#e74c3c';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();

      // Inner bright core
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawWeaponIndicator(player) {
    if (!player.weaponDef) return;
    const ctx = this.ctx;
    const sx = player.x - this.camera.x;
    const sy = player.y - this.camera.y;

    // Small colored dot below the player
    ctx.fillStyle = player.weaponDef.color;
    ctx.beginPath();
    ctx.arc(sx, sy + player.radius + 6, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawHazards(hazards, time) {
    const ctx = this.ctx;
    for (const h of hazards) {
      const sx = h.x - this.camera.x;
      const sy = h.y - this.camera.y;

      // Skip if offscreen (generous margin for large hazards)
      if (sx < -250 || sx > this.canvas.width + 250 || sy < -250 || sy > this.canvas.height + 250) continue;

      switch (h.type) {
        case 'poison_pool': {
          // Bubbling animation via varying alpha
          const pulse = 0.3 + Math.sin(time * 2 + h.x * 0.1) * 0.1;
          const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, h.radius);
          grad.addColorStop(0, `rgba(46, 204, 113, ${pulse + 0.1})`);
          grad.addColorStop(1, `rgba(46, 204, 113, ${pulse * 0.3})`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(sx, sy, h.radius, 0, Math.PI * 2);
          ctx.fill();
          // Border
          ctx.strokeStyle = h.borderColor;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
          // Bubble particles
          for (let i = 0; i < 3; i++) {
            const bx = sx + Math.sin(time * 3 + i * 2.1 + h.y) * h.radius * 0.5;
            const by = sy + Math.cos(time * 2.5 + i * 1.7 + h.x) * h.radius * 0.5;
            const br = 2 + Math.sin(time * 4 + i) * 1;
            ctx.fillStyle = `rgba(46, 204, 113, ${0.4 + Math.sin(time * 5 + i) * 0.2})`;
            ctx.beginPath();
            ctx.arc(bx, by, br, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'shadow_spikes': {
          if (h.active) {
            // Draw spiky pattern when active
            ctx.fillStyle = h.color;
            ctx.beginPath();
            const spikes = 8;
            for (let i = 0; i < spikes; i++) {
              const angle = (i / spikes) * Math.PI * 2;
              const outerR = h.radius;
              const innerR = h.radius * 0.4;
              const r = i % 2 === 0 ? outerR : innerR;
              const px = sx + Math.cos(angle) * r;
              const py = sy + Math.sin(angle) * r;
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = h.borderColor;
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (h.warning) {
            // Flash warning before spikes emerge
            const flash = Math.sin(time * 20) > 0 ? 0.5 : 0.15;
            ctx.fillStyle = `rgba(155, 89, 182, ${flash})`;
            ctx.beginPath();
            ctx.arc(sx, sy, h.radius * 0.6, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Subtle inactive circle
            ctx.fillStyle = 'rgba(155, 89, 182, 0.1)';
            ctx.beginPath();
            ctx.arc(sx, sy, h.radius * 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'lava_crack': {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(h.angle);
          // Pulsing glow
          const glow = 0.4 + Math.sin(time * 3 + h.x * 0.05) * 0.15;
          // Outer glow
          ctx.fillStyle = `rgba(231, 76, 60, ${glow * 0.3})`;
          ctx.fillRect(-h.length / 2 - 4, -h.width / 2 - 4, h.length + 8, h.width + 8);
          // Main crack
          ctx.fillStyle = `rgba(231, 76, 60, ${glow})`;
          ctx.fillRect(-h.length / 2, -h.width / 2, h.length, h.width);
          // Bright core
          ctx.fillStyle = `rgba(241, 196, 15, ${glow * 0.5})`;
          ctx.fillRect(-h.length / 2 + 4, -h.width / 4, h.length - 8, h.width / 2);
          ctx.restore();
          break;
        }
        case 'ice_patch': {
          // Subtle shimmer
          const shimmer = 0.2 + Math.sin(time * 1.5 + h.x * 0.1) * 0.05;
          const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, h.radius);
          grad.addColorStop(0, `rgba(52, 152, 219, ${shimmer + 0.1})`);
          grad.addColorStop(0.7, `rgba(52, 152, 219, ${shimmer})`);
          grad.addColorStop(1, `rgba(52, 152, 219, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(sx, sy, h.radius, 0, Math.PI * 2);
          ctx.fill();
          // Border
          ctx.strokeStyle = h.borderColor;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.3;
          ctx.stroke();
          ctx.globalAlpha = 1;
          // Sparkle dots
          for (let i = 0; i < 4; i++) {
            const angle = time * 0.5 + i * Math.PI / 2;
            const dist = h.radius * 0.5;
            const sparkX = sx + Math.cos(angle) * dist;
            const sparkY = sy + Math.sin(angle) * dist;
            ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + Math.sin(time * 3 + i) * 0.2})`;
            ctx.beginPath();
            ctx.arc(sparkX, sparkY, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
      }
    }
  }

  drawMinimap(player, enemies, boss, blessings) {
    const ctx = this.ctx;
    const size = 140;
    const padding = 10;
    const mx = padding;
    const my = this.canvas.height - size - padding;
    const scale = size / this.mapWidth;

    ctx.save();

    // Background
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000';
    ctx.fillRect(mx, my, size, size);

    // Border
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, size, size);

    ctx.globalAlpha = 0.8;

    // Camera viewport
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      mx + this.camera.x * scale,
      my + this.camera.y * scale,
      this.canvas.width * scale,
      this.canvas.height * scale
    );

    // Blessings (yellow dots)
    ctx.fillStyle = '#f1c40f';
    for (const b of blessings) {
      ctx.beginPath();
      ctx.arc(mx + b.x * scale, my + b.y * scale, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Enemies (red dots)
    ctx.fillStyle = '#e74c3c';
    for (const e of enemies) {
      ctx.beginPath();
      ctx.arc(mx + e.x * scale, my + e.y * scale, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boss (larger purple dot)
    if (boss) {
      ctx.fillStyle = '#9b59b6';
      ctx.beginPath();
      ctx.arc(mx + boss.x * scale, my + boss.y * scale, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player (blue dot)
    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.arc(mx + player.x * scale, my + player.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
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

  flash(color, duration) {
    this.flashColor = color;
    this.flashTimer = duration;
    this.flashDuration = duration;
  }

  drawFlash() {
    if (this.flashTimer <= 0 || !this.flashColor) return;
    const ctx = this.ctx;
    const alpha = Math.max(0, this.flashTimer / this.flashDuration) * 0.35;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = 1;
  }

  updateFlash(dt) {
    if (this.flashTimer > 0) this.flashTimer -= dt;
  }

  drawPlayerTrail(trail) {
    const ctx = this.ctx;
    for (const t of trail) {
      const sx = t.x - this.camera.x;
      const sy = t.y - this.camera.y;
      ctx.globalAlpha = t.alpha;
      ctx.fillStyle = '#3498db';
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawCombo(combo, timer) {
    if (combo < 3 || timer <= 0) return;
    const ctx = this.ctx;
    const maxTimer = 2.0;

    // Fade based on timer
    const alpha = Math.min(1, timer / (maxTimer * 0.5));
    ctx.globalAlpha = alpha;

    // Scale text size with combo count
    const baseSize = 48;
    const size = Math.min(baseSize + combo * 4, 96);

    // Determine multiplier text
    let multiplier;
    if (combo >= 10) multiplier = '3x XP';
    else if (combo >= 5) multiplier = '2x XP';
    else multiplier = '1.5x XP';

    // Color: orange for low combos, red for high
    const color = combo >= 10 ? '#e74c3c' : combo >= 5 ? '#e67e22' : '#f39c12';

    const cx = this.canvas.width / 2;
    const cy = 100;

    // Shadow for readability
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Combo text
    ctx.font = `bold ${size}px sans-serif`;
    ctx.fillStyle = '#000';
    ctx.fillText(`x${combo} COMBO!`, cx + 2, cy + 2);
    ctx.fillStyle = color;
    ctx.fillText(`x${combo} COMBO!`, cx, cy);

    // Multiplier text below
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#000';
    ctx.fillText(multiplier, cx + 1, cy + size * 0.6 + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(multiplier, cx, cy + size * 0.6);

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawWaveAnnouncement(text, timer) {
    if (timer <= 0) return;
    const ctx = this.ctx;
    const totalDuration = 2.5;
    // Fade in during first 0.3s, fade out during last 0.5s
    let alpha;
    const elapsed = totalDuration - timer;
    if (elapsed < 0.3) {
      alpha = elapsed / 0.3;
    } else if (timer < 0.5) {
      alpha = timer / 0.5;
    } else {
      alpha = 1;
    }
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    const isSpecial = text.includes('Clear') || text.includes('!');
    ctx.fillStyle = isSpecial ? '#f1c40f' : '#fff';
    ctx.font = `bold ${isSpecial ? 72 : 64}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (isSpecial) {
      ctx.shadowColor = 'rgba(241, 196, 15, 0.5)';
      ctx.shadowBlur = 20;
    }
    ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2 - 40);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
  }
}
