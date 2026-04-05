export class HazardSystem {
  constructor() {
    this.hazards = [];
  }

  generate(levelConfig) {
    this.hazards = [];
    const mw = levelConfig.mapWidth || 1600;
    const mh = levelConfig.mapHeight || 1600;

    if (!levelConfig.hazards) return;

    for (const h of levelConfig.hazards) {
      for (let i = 0; i < h.count; i++) {
        const x = 100 + Math.random() * (mw - 200);
        const y = 100 + Math.random() * (mh - 200);

        // Don't spawn too close to center (player spawn)
        const dx = x - mw / 2, dy = y - mh / 2;
        if (Math.sqrt(dx * dx + dy * dy) < 150) continue;

        this.hazards.push(this._createHazard(h.type, x, y));
      }
    }
  }

  _createHazard(type, x, y) {
    switch (type) {
      case 'poison_pool':
        return { type, x, y, radius: 50, damage: 5, color: 'rgba(46, 204, 113, 0.3)', borderColor: '#2ecc71' };
      case 'shadow_spikes':
        return { type, x, y, radius: 30, damage: 15, color: 'rgba(155, 89, 182, 0.5)', borderColor: '#9b59b6', timer: Math.random() * 6, active: false, cycleUp: 3, cycleDown: 3, warning: false };
      case 'lava_crack': {
        const angle = Math.random() * Math.PI;
        return { type, x, y, width: 20, length: 200, angle, damage: 8, color: 'rgba(231, 76, 60, 0.4)', borderColor: '#e74c3c' };
      }
      case 'ice_patch':
        return { type, x, y, radius: 60, slowPercent: 0.4, color: 'rgba(52, 152, 219, 0.2)', borderColor: '#3498db' };
      default:
        return { type, x, y, radius: 30, damage: 0, color: 'rgba(255,255,255,0.1)' };
    }
  }

  update(dt, player, enemies) {
    // Reset player hazard slow each frame
    player._hazardSlowed = false;

    for (const h of this.hazards) {
      if (h.type === 'shadow_spikes') {
        h.timer += dt;
        const cycle = h.cycleUp + h.cycleDown;
        const t = h.timer % cycle;
        h.active = t < h.cycleUp;
        // Brief warning flash before activating
        h.warning = !h.active && (cycle - (h.timer % cycle)) < 0.5;
      }

      // Check player
      if (this._entityInHazard(player, h)) {
        this._applyHazard(h, player, dt, true);
      }

      // Check enemies
      for (const e of enemies) {
        if (e.dead) continue;
        if (this._entityInHazard(e, h)) {
          this._applyHazard(h, e, dt, false);
        }
      }
    }
  }

  _entityInHazard(entity, hazard) {
    const eRadius = entity.radius || 0;

    if (hazard.type === 'lava_crack') {
      // Line-based collision
      const dx = entity.x - hazard.x;
      const dy = entity.y - hazard.y;
      const cos = Math.cos(hazard.angle);
      const sin = Math.sin(hazard.angle);
      const along = dx * cos + dy * sin;
      const perp = Math.abs(-dx * sin + dy * cos);
      return Math.abs(along) < hazard.length / 2 && perp < hazard.width / 2 + eRadius;
    }

    const dx = entity.x - hazard.x;
    const dy = entity.y - hazard.y;
    return Math.sqrt(dx * dx + dy * dy) < (hazard.radius || 0) + eRadius;
  }

  _applyHazard(hazard, entity, dt, isPlayer) {
    switch (hazard.type) {
      case 'poison_pool':
        if (isPlayer) entity.takeDamage(hazard.damage * dt);
        else entity.hp -= hazard.damage * dt;
        break;
      case 'shadow_spikes':
        if (hazard.active) {
          if (isPlayer) entity.takeDamage(hazard.damage * dt);
          else entity.hp -= hazard.damage * dt;
        }
        break;
      case 'lava_crack':
        if (isPlayer) entity.takeDamage(hazard.damage * dt);
        else entity.hp -= hazard.damage * dt;
        break;
      case 'ice_patch':
        if (isPlayer) {
          entity._hazardSlowed = true;
          entity._hazardSlowPercent = hazard.slowPercent;
        } else {
          entity.applySlow(hazard.slowPercent, 0.2);
        }
        break;
    }
    if (!isPlayer && entity.hp <= 0) entity.dead = true;
  }
}
