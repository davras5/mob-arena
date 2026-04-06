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

    // Layout manager reference
    this.layoutManager = null;

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

  setLayout(layoutManager) {
    this.layoutManager = layoutManager;
  }

  updateCamera(player) {
    this.camera.x = player.x - this.canvas.width / 2;
    this.camera.y = player.y - this.canvas.height / 2;

    // Clamp
    if (this.mapWidth <= this.canvas.width) {
      this.camera.x = (this.mapWidth - this.canvas.width) / 2;
    } else {
      this.camera.x = Math.max(0, Math.min(this.mapWidth - this.canvas.width, this.camera.x));
    }
    if (this.mapHeight <= this.canvas.height) {
      this.camera.y = (this.mapHeight - this.canvas.height) / 2;
    } else {
      this.camera.y = Math.max(0, Math.min(this.mapHeight - this.canvas.height, this.camera.y));
    }
  }

  clear() {
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawMap() {
    const ctx = this.ctx;
    const lm = this.layoutManager;
    const hasRooms = lm && lm.rooms && lm.rooms.length > 0;
    const startCol = Math.floor(this.camera.x / this.tileSize);
    const endCol = Math.ceil((this.camera.x + this.canvas.width) / this.tileSize);
    const startRow = Math.floor(this.camera.y / this.tileSize);
    const endRow = Math.ceil((this.camera.y + this.canvas.height) / this.tileSize);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const sx = c * this.tileSize - this.camera.x;
        const sy = r * this.tileSize - this.camera.y;

        // Fog of war: skip unrevealed tiles
        if (lm && lm.fogEnabled && !lm.isRevealed(c, r)) {
          continue; // Leave as clear color (#111)
        }

        // If room layout, only draw walkable tiles
        if (hasRooms && !lm.isTileWalkable(c, r)) {
          // Draw dark void for non-walkable
          ctx.fillStyle = '#080808';
          ctx.fillRect(sx, sy, this.tileSize, this.tileSize);
          continue;
        }

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

    // Draw obstacles
    if (lm) {
      this._drawObstacles(lm.obstacles);
    }
  }

  _drawObstacles(obstacles) {
    const ctx = this.ctx;
    for (const obs of obstacles) {
      const sx = obs.x - this.camera.x;
      const sy = obs.y - this.camera.y;

      // Skip if offscreen
      const obsSize = obs.radius || Math.max(obs.width || 0, obs.height || 0);
      if (sx < -obsSize - 20 || sx > this.canvas.width + obsSize + 20 ||
          sy < -obsSize - 20 || sy > this.canvas.height + obsSize + 20) continue;

      if (obs.type === 'pillar') {
        // Stone pillar with 3D bevel
        const gradient = ctx.createRadialGradient(sx - 4, sy - 4, 0, sx, sy, obs.radius);
        gradient.addColorStop(0, '#7f8c8d');
        gradient.addColorStop(0.7, '#5d6d7e');
        gradient.addColorStop(1, '#2c3e50');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(sx, sy, obs.radius, 0, Math.PI * 2);
        ctx.fill();

        // Outline
        ctx.strokeStyle = '#1a252f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, obs.radius, 0, Math.PI * 2);
        ctx.stroke();

      } else if (obs.type === 'wall') {
        // Wall rectangle
        const wx = obs.x - this.camera.x;
        const wy = obs.y - this.camera.y;
        ctx.fillStyle = '#4a5568';
        ctx.fillRect(wx, wy, obs.width, obs.height);
        ctx.strokeStyle = '#2d3748';
        ctx.lineWidth = 2;
        ctx.strokeRect(wx, wy, obs.width, obs.height);

        // Light edge
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(wx, wy, obs.width, 2);
        ctx.fillRect(wx, wy, 2, obs.height);

      } else if (obs.type === 'pit') {
        // Dark pit with glow
        const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, obs.radius);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
        gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(sx, sy, obs.radius, 0, Math.PI * 2);
        ctx.fill();

        // Danger glow edge
        const edgeColor = obs.color || '#e74c3c';
        ctx.strokeStyle = edgeColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 500) * 0.2;
        ctx.beginPath();
        ctx.arc(sx, sy, obs.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;

      } else if (obs.type === 'hazard_zone') {
        // Colored overlay zone
        const wx = obs.x - this.camera.x;
        const wy = obs.y - this.camera.y;
        const color = obs.color || '#e74c3c';
        ctx.globalAlpha = 0.15 + Math.sin(Date.now() / 800) * 0.05;
        ctx.fillStyle = color;
        ctx.fillRect(wx, wy, obs.width, obs.height);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.strokeRect(wx, wy, obs.width, obs.height);
        ctx.globalAlpha = 1;

      } else if (obs.type === 'door_locked') {
        // Locked door barrier
        const wx = obs.x - this.camera.x;
        const wy = obs.y - this.camera.y;
        ctx.fillStyle = '#8B7355';
        ctx.fillRect(wx, wy, obs.width, obs.height);
        ctx.strokeStyle = '#5C4033';
        ctx.lineWidth = 2;
        ctx.strokeRect(wx, wy, obs.width, obs.height);
        // Lock icon
        const cx = wx + obs.width / 2, cy = wy + obs.height / 2;
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();

      } else if (obs.type === 'stairs') {
        // Stairs down - glowing spiral
        ctx.save();
        ctx.globalAlpha = 0.7 + Math.sin(Date.now() / 400) * 0.2;
        const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, obs.radius);
        gradient.addColorStop(0, '#f1c40f');
        gradient.addColorStop(0.5, '#e67e22');
        gradient.addColorStop(1, 'rgba(243, 156, 18, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(sx, sy, obs.radius, 0, Math.PI * 2);
        ctx.fill();
        // Spiral arcs
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        const t = Date.now() / 1000;
        ctx.beginPath();
        ctx.arc(sx, sy, obs.radius * 0.7, t, t + Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, obs.radius * 0.4, t + Math.PI, t + Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // "Stairs" text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('STAIRS', sx, sy + obs.radius + 14);
      } else if (obs.type === 'waystone') {
        ctx.save();
        ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 500) * 0.2;
        const wGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, obs.radius || 20);
        wGrad.addColorStop(0, '#5dade2');
        wGrad.addColorStop(0.5, '#2980b9');
        wGrad.addColorStop(1, 'rgba(52, 152, 219, 0)');
        ctx.fillStyle = wGrad;
        ctx.beginPath();
        ctx.arc(sx, sy, obs.radius || 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ecf0f1';
        ctx.beginPath();
        ctx.arc(sx, sy, (obs.radius || 20) * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#3498db';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Way Stone', sx, sy + (obs.radius || 20) + 14);
      } else if (obs.type === 'teleport_portal') {
        // Swirling purple/blue portal with ring
        ctx.save();
        const t = Date.now() / 1000;
        const radius = obs.radius || 28;
        // Outer glow
        ctx.globalAlpha = 0.5 + Math.sin(t * 4) * 0.2;
        const portalGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
        portalGrad.addColorStop(0, '#d6a8ff');
        portalGrad.addColorStop(0.4, '#9b59b6');
        portalGrad.addColorStop(0.8, '#5a2880');
        portalGrad.addColorStop(1, 'rgba(155, 89, 182, 0)');
        ctx.fillStyle = portalGrad;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
        // Inner spinning ring
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = '#e8d3ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a1 = t * 3 + i * Math.PI / 4;
          const r1 = radius * 0.6;
          const x1 = sx + Math.cos(a1) * r1;
          const y1 = sy + Math.sin(a1) * r1;
          if (i === 0) ctx.moveTo(x1, y1);
          else ctx.lineTo(x1, y1);
        }
        ctx.closePath();
        ctx.stroke();
        // Center sparkle
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, sy, 3 + Math.sin(t * 6) * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Label
        ctx.fillStyle = '#d6a8ff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        const label = obs._isReturnPortal ? 'Return Portal' : 'Portal';
        ctx.fillText(label, sx, sy + radius + 14);
      }
    }
  }


  drawPlayer(player) {
    const ctx = this.ctx;
    const sx = player.x - this.camera.x;
    const sy = player.y - this.camera.y;
    const color = player.color || '#3498db';
    const highlight = player.highlightColor || '#5dade2';

    // Shield visual
    if (player.shieldHP > 0) {
      ctx.strokeStyle = 'rgba(52, 152, 219, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, player.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Warrior: thicker outline
    if (player.playerClass === 'warrior') {
      ctx.strokeStyle = 'rgba(192, 57, 43, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, player.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Necromancer: orbiting souls
    if (player.playerClass === 'necromancer') {
      const orbitRadius = player.radius + 12;
      const soulCount = 3;
      for (let i = 0; i < soulCount; i++) {
        const angle = (Date.now() / 1500) + (i * Math.PI * 2 / soulCount);
        const soulX = sx + Math.cos(angle) * orbitRadius;
        const soulY = sy + Math.sin(angle) * orbitRadius;
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = player.highlightColor;
        ctx.beginPath();
        ctx.arc(soulX, soulY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Mage: rotating rune ring
    if (player.playerClass === 'mage') {
      const runeRadius = player.radius + 8;
      const runeCount = 5;
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < runeCount; i++) {
        const angle = (Date.now() / 2000) + (i * Math.PI * 2 / runeCount);
        const rx = sx + Math.cos(angle) * runeRadius;
        const ry = sy + Math.sin(angle) * runeRadius;
        ctx.fillStyle = player.highlightColor;
        ctx.beginPath();
        ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Player body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx, sy, player.radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner highlight
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.arc(sx - 3, sy - 3, player.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Aim direction indicator (ARPG style - prominent line toward cursor)
    if (player.aimAngle !== null) {
      const a = player.aimAngle;
      // Outer aim line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * player.radius,
                 sy + Math.sin(a) * player.radius);
      ctx.lineTo(sx + Math.cos(a) * (player.radius + 18),
                 sy + Math.sin(a) * (player.radius + 18));
      ctx.stroke();

      // Small arrowhead
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      const tipX = sx + Math.cos(a) * (player.radius + 20);
      const tipY = sy + Math.sin(a) * (player.radius + 20);
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - Math.cos(a - 0.5) * 6, tipY - Math.sin(a - 0.5) * 6);
      ctx.lineTo(tipX - Math.cos(a + 0.5) * 6, tipY - Math.sin(a + 0.5) * 6);
      ctx.closePath();
      ctx.fill();
    }

    // Unique ability cooldown indicator
    if (player.classConfig && player.uniqueAbilityTimer > 0) {
      const pct = player.uniqueAbilityTimer / player.uniqueAbilityCooldown;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, player.radius + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - pct));
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

  drawProjectiles(projectiles, player) {
    const ctx = this.ctx;
    const ELEMENT_COLORS = {
      fire: '#e67e22',
      ice: '#5dade2',
      lightning: '#f1c40f',
      arcane: '#a569bd',
    };

    for (const p of projectiles) {
      const sx = p.x - this.camera.x;
      const sy = p.y - this.camera.y;

      if (sx < -20 || sx > this.canvas.width + 20 || sy < -20 || sy > this.canvas.height + 20) continue;

      let projColor = '#f1c40f';
      let glowColor = 'rgba(241, 196, 15, 0.3)';
      let trailColor = 'rgba(241, 196, 15, 0.3)';

      if (p.isEnemy) {
        projColor = '#e74c3c';
        glowColor = 'rgba(231, 76, 60, 0.3)';
        trailColor = 'rgba(231, 76, 60, 0.3)';
      } else if (p.element && ELEMENT_COLORS[p.element]) {
        projColor = ELEMENT_COLORS[p.element];
        glowColor = projColor.replace(')', ', 0.3)').replace('rgb', 'rgba');
      } else if (p.isDrain) {
        projColor = '#2e86c1';
        glowColor = 'rgba(46, 134, 193, 0.3)';
        trailColor = 'rgba(46, 134, 193, 0.3)';
      } else if (player && player.color && player.color !== '#3498db') {
        projColor = player.color;
      }

      if (!p.isEnemy) {
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.radius * 3);
        glow.addColorStop(0, glowColor);
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, p.radius * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = projColor;
      ctx.beginPath();
      ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Trail
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

  drawMinimap(player, enemies, boss, blessings) {
    const ctx = this.ctx;
    const size = 160;
    const padding = 12;
    // Top-right corner — bottom of screen is the HUD action bar.
    const mx = this.canvas.width - size - padding;
    const my = padding;
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

    // Room outlines on minimap
    if (this.layoutManager && this.layoutManager.rooms.length > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      for (const room of this.layoutManager.rooms) {
        ctx.fillRect(
          mx + room.x * scale,
          my + room.y * scale,
          room.width * scale,
          room.height * scale
        );
      }
    }

    // Obstacle dots on minimap
    if (this.layoutManager) {
      for (const obs of this.layoutManager.obstacles) {
        if (obs.type === 'pillar' || obs.type === 'wall') {
          ctx.fillStyle = 'rgba(127, 140, 141, 0.4)';
          if (obs.type === 'pillar') {
            ctx.beginPath();
            ctx.arc(mx + obs.x * scale, my + obs.y * scale, Math.max(1, obs.radius * scale), 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(mx + obs.x * scale, my + obs.y * scale, Math.max(1, obs.width * scale), Math.max(1, obs.height * scale));
          }
        }
      }
    }

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

    // Player dot (class-colored)
    ctx.fillStyle = player.color || '#3498db';
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

  drawPlayerTrail(trail, color) {
    const ctx = this.ctx;
    const trailColor = color || '#3498db';
    for (const t of trail) {
      const sx = t.x - this.camera.x;
      const sy = t.y - this.camera.y;
      ctx.globalAlpha = t.alpha;
      ctx.fillStyle = trailColor;
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

  drawMinions(minions) {
    const ctx = this.ctx;
    for (const m of minions) {
      const sx = m.x - this.camera.x;
      const sy = m.y - this.camera.y;
      if (sx < -30 || sx > this.canvas.width + 30 || sy < -30 || sy > this.canvas.height + 30) continue;

      const drawRadius = m.radius * m.scale;
      ctx.fillStyle = m.hitFlashTimer > 0 ? '#fff' : m.color;
      ctx.beginPath();
      ctx.arc(sx, sy, drawRadius, 0, Math.PI * 2);
      ctx.fill();

      // Ghostly inner
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(sx, sy, drawRadius * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Lifetime ring
      const pct = m.timer / m.duration;
      ctx.strokeStyle = 'rgba(46, 134, 193, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, drawRadius + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      ctx.stroke();

      // HP bar if damaged
      if (m.hp < m.maxHP) {
        const barW = drawRadius * 2.5;
        const barH = 3;
        const bx = sx - barW / 2;
        const by = sy - drawRadius - 8;
        ctx.fillStyle = '#333';
        ctx.fillRect(bx, by, barW, barH);
        ctx.fillStyle = '#2e86c1';
        ctx.fillRect(bx, by, barW * (m.hp / m.maxHP), barH);
      }
    }
  }

  drawMeleeSweep(sweep, color) {
    const ctx = this.ctx;
    const sx = sweep.x - this.camera.x;
    const sy = sweep.y - this.camera.y;
    const halfArc = (sweep.arc / 2) * (Math.PI / 180);

    ctx.save();
    ctx.globalAlpha = sweep.timer / 0.15 * 0.4;
    ctx.fillStyle = color || '#c0392b';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.arc(sx, sy, sweep.range, sweep.angle - halfArc, sweep.angle + halfArc);
    ctx.closePath();
    ctx.fill();

    // White edge
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, sweep.range, sweep.angle - halfArc, sweep.angle + halfArc);
    ctx.stroke();

    ctx.restore();
  }

  drawDecoy(decoy, player) {
    const ctx = this.ctx;
    const sx = decoy.x - this.camera.x;
    const sy = decoy.y - this.camera.y;
    const alpha = Math.min(0.4, decoy.timer / 1.5 * 0.4);

    ctx.save();
    ctx.globalAlpha = alpha;

    // Wavering size effect
    const sizeOsc = 1 + Math.sin(Date.now() / 100) * 0.05;

    ctx.fillStyle = player.color || '#8e44ad';
    ctx.beginPath();
    ctx.arc(sx, sy, player.radius * sizeOsc, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = player.highlightColor || '#a569bd';
    ctx.beginPath();
    ctx.arc(sx - 2, sy - 2, player.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawSoulHarvest(x, y, radius, color) {
    const ctx = this.ctx;
    const sx = x - this.camera.x;
    const sy = y - this.camera.y;

    ctx.save();
    ctx.globalAlpha = 0.2;
    const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
    gradient.addColorStop(0, color || '#1a5276');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Swirling edge
    ctx.strokeStyle = color || '#1a5276';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.4;
    const time = Date.now() / 500;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, time, time + Math.PI * 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx, sy, radius, time + Math.PI, time + Math.PI * 2.2);
    ctx.stroke();

    ctx.restore();
  }

  drawMeteorWarning(x, y, radius, timer) {
    const ctx = this.ctx;
    const sx = x - this.camera.x;
    const sy = y - this.camera.y;

    ctx.save();
    const flash = Math.sin(Date.now() / 50) * 0.5 + 0.5;
    ctx.globalAlpha = 0.15 + flash * 0.15;
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5 + flash * 0.3;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  drawRainArrows(arrows) {
    const ctx = this.ctx;
    for (const r of arrows) {
      const sx = r.x - this.camera.x;
      const sy = r.y - this.camera.y;
      ctx.globalAlpha = r.timer / 0.3;
      ctx.fillStyle = '#27ae60';
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
      // Impact ring
      const ringRadius = (1 - r.timer / 0.3) * 12;
      ctx.strokeStyle = 'rgba(39, 174, 96, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawCorpses(corpses) {
    const ctx = this.ctx;
    for (const c of corpses) {
      const sx = c.x - this.camera.x;
      const sy = c.y - this.camera.y;
      ctx.globalAlpha = Math.min(0.3, c.timer / 5 * 0.3);
      ctx.fillStyle = '#2e86c1';
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawNPCs(npcs, nearestNPC, time) {
    const ctx = this.ctx;
    for (const npc of npcs) {
      const sx = npc.x - this.camera.x;
      const sy = npc.y - this.camera.y;

      // Interaction radius indicator for nearest NPC
      if (npc === nearestNPC) {
        ctx.save();
        ctx.globalAlpha = 0.15 + Math.sin(time * 3) * 0.05;
        ctx.fillStyle = npc.color;
        ctx.beginPath();
        ctx.arc(sx, sy, npc.interactRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // NPC glow
      const glowR = npc.radius + 10 + Math.sin(time * 2) * 3;
      const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
      gradient.addColorStop(0, npc.color + '60');
      gradient.addColorStop(1, npc.color + '00');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // NPC body
      ctx.fillStyle = npc.color;
      ctx.beginPath();
      ctx.arc(sx, sy, npc.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner highlight
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(sx - 2, sy - 2, npc.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Icon
      ctx.fillStyle = '#fff';
      ctx.font = `${npc.radius * 1.2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(npc.icon, sx, sy);

      // Name label
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#ecf0f1';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(npc.name, sx, sy - npc.radius - 10);

      // Role subtitle (always visible)
      const roleMap = {
        trainer: 'Skills',
        skill_vendor: 'Skills',
        vendor: 'Items',
        item_vendor: 'Items',
        waystone: 'Travel',
      };
      const role = roleMap[npc.type];
      if (role) {
        ctx.font = '10px sans-serif';
        ctx.fillStyle = 'rgba(180, 170, 140, 0.6)';
        ctx.textAlign = 'center';
        ctx.fillText(role, sx, sy - npc.radius - 22);
      }

      // Interact prompt for nearest NPC
      if (npc === nearestNPC) {
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText('[E] Interact', sx, sy + npc.radius + 18);
      }
    }
  }

  drawCampfire(campfire, time) {
    if (!campfire) return;
    const ctx = this.ctx;
    const sx = campfire.x - this.camera.x;
    const sy = campfire.y - this.camera.y;
    const r = campfire.radius;

    // Warm glow
    const pulseR = r + 30 + Math.sin(time * 4) * 8;
    const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, pulseR);
    gradient.addColorStop(0, 'rgba(230, 126, 34, 0.3)');
    gradient.addColorStop(0.5, 'rgba(243, 156, 18, 0.1)');
    gradient.addColorStop(1, 'rgba(243, 156, 18, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(sx, sy, pulseR, 0, Math.PI * 2);
    ctx.fill();

    // Fire core
    ctx.fillStyle = '#e67e22';
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.arc(sx, sy - 3, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(sx, sy - 5, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawGroundItems(items, time) {
    const ctx = this.ctx;
    for (const gi of items) {
      const sx = gi.x - this.camera.x;
      const sy = gi.y - this.camera.y;
      if (sx < -30 || sx > this.canvas.width + 30 || sy < -30 || sy > this.canvas.height + 30) continue;

      const bob = Math.sin(time * 3 + gi.bobOffset) * 3;
      const color = gi.item.rarityColor || '#fff';

      // Rarity glow
      const glowR = 14 + Math.sin(time * 4) * 3;
      ctx.save();
      ctx.globalAlpha = 0.4;
      const grad = ctx.createRadialGradient(sx, sy + bob, 0, sx, sy + bob, glowR);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy + bob, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Item circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx, sy + bob, 7, 0, Math.PI * 2);
      ctx.fill();

      // Icon
      ctx.fillStyle = '#000';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(gi.item.icon || '?', sx, sy + bob);
    }
  }

  drawGoldDrops(drops) {
    const ctx = this.ctx;
    for (const g of drops) {
      const sx = g.x - this.camera.x;
      const sy = g.y - this.camera.y;
      if (sx < -20 || sx > this.canvas.width + 20 || sy < -20 || sy > this.canvas.height + 20) continue;

      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f39c12';
      ctx.beginPath();
      ctx.arc(sx - 1, sy - 1, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBossChest(chest, time) {
    if (!chest || chest.opened) return;
    const ctx = this.ctx;
    const sx = chest.x - this.camera.x;
    const sy = chest.y - this.camera.y;

    // Glow
    const pulse = 0.5 + Math.sin(time * 3) * 0.2;
    ctx.save();
    ctx.globalAlpha = pulse;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 40);
    grad.addColorStop(0, 'rgba(241, 196, 15, 0.4)');
    grad.addColorStop(1, 'rgba(241, 196, 15, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Chest body
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(sx - 16, sy - 12, 32, 24);
    ctx.strokeStyle = '#5C4033';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx - 16, sy - 12, 32, 24);
    // Lock
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fill();
    // Label
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('[E] Open', sx, sy + 24);
  }

  drawDungeonMinimap(player, dungeon, dungeonManager, enemies, boss) {
    const ctx = this.ctx;
    const size = 180;
    const padding = 12;
    // Top-right corner — the bottom of the screen is occupied by the HUD action bar.
    const mx = this.canvas.width - size - padding;
    const my = padding;
    const scale = size / Math.max(dungeon.mapWidth, dungeon.mapHeight);

    ctx.save();

    // Background
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#000';
    ctx.fillRect(mx, my, size, size * (dungeon.mapHeight / dungeon.mapWidth));

    ctx.globalAlpha = 0.7;

    // Draw corridors
    for (const c of dungeon.corridors) {
      const fromRoom = dungeon.rooms.find(r => r.id === c.fromRoomId);
      const toRoom = dungeon.rooms.find(r => r.id === c.toRoomId);
      if (!fromRoom || !toRoom) continue;
      if (!fromRoom.revealed && !toRoom.revealed) continue;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      for (const seg of c.segments) {
        ctx.fillRect(mx + seg.x * scale, my + seg.y * scale, Math.max(1, seg.width * scale), Math.max(1, seg.height * scale));
      }
    }

    // Draw rooms
    for (const room of dungeon.rooms) {
      if (!room.revealed) continue;
      const rx = mx + room.x * scale;
      const ry = my + room.y * scale;
      const rw = Math.max(2, room.width * scale);
      const rh = Math.max(2, room.height * scale);

      // Fill based on state
      if (room.visited) {
        ctx.fillStyle = room.cleared ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      }
      ctx.fillRect(rx, ry, rw, rh);

      // Outline
      const isCurrent = dungeonManager && dungeonManager.currentRoom === room;
      ctx.strokeStyle = isCurrent ? '#f1c40f' : '#444';
      ctx.lineWidth = isCurrent ? 2 : 0.5;
      ctx.strokeRect(rx, ry, rw, rh);

      // Room type indicators
      const rcx = rx + rw / 2, rcy = ry + rh / 2;
      if (room.type === 'boss' || room.id === dungeon.exitRoomId) {
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(rcx, rcy, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (room.type === 'safe') {
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        ctx.arc(rcx, rcy, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (room.type === 'shop') {
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(rcx, rcy, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (room.type === 'treasure') {
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.arc(rcx, rcy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Enemies in current room
    if (enemies) {
      ctx.fillStyle = '#e74c3c';
      for (const e of enemies) {
        if (e.dead) continue;
        ctx.beginPath();
        ctx.arc(mx + e.x * scale, my + e.y * scale, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Boss
    if (boss && !boss.dead) {
      ctx.fillStyle = '#9b59b6';
      ctx.beginPath();
      ctx.arc(mx + boss.x * scale, my + boss.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player
    ctx.fillStyle = player.color || '#3498db';
    ctx.beginPath();
    ctx.arc(mx + player.x * scale, my + player.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, size, size * (dungeon.mapHeight / dungeon.mapWidth));

    ctx.restore();
  }

  drawGravitonOrbs(orbs) {
    const ctx = this.ctx;
    for (const orb of orbs) {
      const sx = orb.x - this.camera.x;
      const sy = orb.y - this.camera.y;
      const pct = orb.timer / 5; // normalized

      // Pulsing dark orb
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 200) * 0.1;
      const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, orb.pullRadius);
      gradient.addColorStop(0, 'rgba(100, 50, 150, 0.4)');
      gradient.addColorStop(0.7, 'rgba(100, 50, 150, 0.1)');
      gradient.addColorStop(1, 'rgba(100, 50, 150, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(sx, sy, orb.pullRadius, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = '#9b59b6';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawSpectralBlades(player, time) {
    const ctx = this.ctx;
    const count = player.bladeCount;
    const radius = player.bladeRadius;
    const sx = player.x - this.camera.x;
    const sy = player.y - this.camera.y;
    const step = (Math.PI * 2) / count;
    const speed = 2;

    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 2;

    for (let i = 0; i < count; i++) {
      const angle = (time * speed) + i * step;
      const bx = sx + Math.cos(angle) * radius;
      const by = sy + Math.sin(angle) * radius;

      // Blade shape (small rotated line)
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(angle + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(0, 6);
      ctx.stroke();
      ctx.restore();

      // Glow dot
      ctx.fillStyle = 'rgba(236, 240, 241, 0.4)';
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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
