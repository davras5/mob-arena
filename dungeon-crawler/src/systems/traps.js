// traps.js — Trap system for dungeon hazards

export class TrapManager {
  constructor(trapsData) {
    this.trapTypes = trapsData.trapTypes;
    this.placementRules = trapsData.placementRules;
    this.visibilityScaling = trapsData.visibilityScaling;
    this.activeTraps = [];
    this.floorNumber = 1;
  }

  /**
   * Place traps in rooms and corridors during dungeon generation.
   */
  generateTraps(rooms, corridors, floorNumber) {
    this.floorNumber = floorNumber;
    this.activeTraps = [];

    const available = this.trapTypes.filter(t => t.floorAppears <= floorNumber);
    if (available.length === 0) return;

    const corridorTypes = available.filter(t => t.corridorAllowed);

    // Place traps in rooms
    for (const room of rooms) {
      if (this.placementRules.noTrapsRooms.includes(room.type)) continue;

      let densityMin = room.trapDensity ? room.trapDensity[0] : 1;
      let densityMax = room.trapDensity ? room.trapDensity[1] : 3;

      if (room.type === 'treasure') {
        densityMin = Math.round(densityMin * this.placementRules.treasureRoomMultiplier);
        densityMax = Math.round(densityMax * this.placementRules.treasureRoomMultiplier);
      }

      const count = densityMin + Math.floor(Math.random() * (densityMax - densityMin + 1));

      for (let i = 0; i < count; i++) {
        const trapDef = available[Math.floor(Math.random() * available.length)];
        const pos = this._findPlacement(room, room.doors || []);
        if (!pos) continue;

        this.activeTraps.push({
          id: `trap_${this.activeTraps.length}_${Date.now()}`,
          type: trapDef.id,
          x: pos.x,
          y: pos.y,
          triggerRadius: trapDef.triggerRadius || 32,
          activated: false,
          activationTimer: 0,
          trapDef: { ...trapDef }
        });
      }
    }

    // Place traps in corridors
    if (corridorTypes.length > 0 && corridors) {
      for (const corridor of corridors) {
        // ~30% chance per corridor to have a trap
        if (Math.random() > 0.3) continue;

        const trapDef = corridorTypes[Math.floor(Math.random() * corridorTypes.length)];
        const pos = this._findCorridorPlacement(corridor);
        if (!pos) continue;

        this.activeTraps.push({
          id: `trap_${this.activeTraps.length}_${Date.now()}`,
          type: trapDef.id,
          x: pos.x,
          y: pos.y,
          triggerRadius: trapDef.triggerRadius || 32,
          activated: false,
          activationTimer: 0,
          trapDef: { ...trapDef }
        });
      }
    }
  }

  /**
   * Find a valid placement position inside a room.
   */
  _findPlacement(room, doors) {
    const { minSpacing, doorClearance } = this.placementRules;
    const maxAttempts = 20;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Pick random position within room bounds (with some padding from walls)
      const padding = 24;
      const x = room.x + padding + Math.random() * (room.width - padding * 2);
      const y = room.y + padding + Math.random() * (room.height - padding * 2);

      // Check spacing from existing traps
      let tooClose = false;
      for (const trap of this.activeTraps) {
        const dx = trap.x - x;
        const dy = trap.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < minSpacing) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // Check door clearance
      let nearDoor = false;
      for (const door of doors) {
        const dx = (door.x || 0) - x;
        const dy = (door.y || 0) - y;
        if (Math.sqrt(dx * dx + dy * dy) < doorClearance) {
          nearDoor = true;
          break;
        }
      }
      if (nearDoor) continue;

      // Check obstacles if room provides them
      if (room.obstacles) {
        let onObstacle = false;
        for (const obs of room.obstacles) {
          if (x >= obs.x && x <= obs.x + (obs.width || 0) &&
              y >= obs.y && y <= obs.y + (obs.height || 0)) {
            onObstacle = true;
            break;
          }
        }
        if (onObstacle) continue;
      }

      return { x, y };
    }

    return null;
  }

  /**
   * Find a valid placement position along a corridor.
   */
  _findCorridorPlacement(corridor) {
    const { minSpacing } = this.placementRules;

    // Corridor may be defined as start/end points or as a rect
    let x, y;
    if (corridor.x !== undefined && corridor.width !== undefined) {
      x = corridor.x + Math.random() * corridor.width;
      y = corridor.y + Math.random() * corridor.height;
    } else if (corridor.start && corridor.end) {
      const t = 0.2 + Math.random() * 0.6; // avoid extreme ends
      x = corridor.start.x + t * (corridor.end.x - corridor.start.x);
      y = corridor.start.y + t * (corridor.end.y - corridor.start.y);
    } else {
      return null;
    }

    // Check spacing from existing traps
    for (const trap of this.activeTraps) {
      const dx = trap.x - x;
      const dy = trap.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < minSpacing) {
        return null;
      }
    }

    return { x, y };
  }

  /**
   * Per-frame update. Check player proximity and trigger traps.
   * Returns array of triggered trap results this frame.
   */
  update(dt, playerX, playerY, playerSTA) {
    const triggered = [];

    for (const trap of this.activeTraps) {
      // Update activation timers on already-triggered traps
      if (trap.activated && trap.activationTimer > 0) {
        trap.activationTimer -= dt;
        continue;
      }

      if (trap.activated) continue;

      const dx = trap.x - playerX;
      const dy = trap.y - playerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < trap.triggerRadius) {
        trap.activated = true;
        trap.activationTimer = trap.trapDef.activationDelay || 0.3;

        const result = this.applyTrigger(trap, playerSTA);
        triggered.push({
          trap,
          damage: result.damage,
          status: result.status,
          knockback: result.knockback
        });
      }
    }

    return triggered;
  }

  /**
   * Return traps visible on screen with opacity based on distance to player.
   */
  getVisibleTraps(playerX, playerY, cameraX, cameraY, canvasW, canvasH) {
    const { minOpacity, fullVisibleDistance, fadeStartDistance } = this.visibilityScaling;
    const visible = [];

    // Screen bounds (camera-relative)
    const screenLeft = cameraX;
    const screenRight = cameraX + canvasW;
    const screenTop = cameraY;
    const screenBottom = cameraY + canvasH;

    for (const trap of this.activeTraps) {
      // Cull traps outside screen bounds (with some margin)
      const margin = 64;
      if (trap.x < screenLeft - margin || trap.x > screenRight + margin ||
          trap.y < screenTop - margin || trap.y > screenBottom + margin) {
        continue;
      }

      // Compute opacity based on distance to player
      const dx = trap.x - playerX;
      const dy = trap.y - playerY;
      const distToPlayer = Math.sqrt(dx * dx + dy * dy);

      let opacity;
      if (distToPlayer <= fullVisibleDistance) {
        opacity = 1.0;
      } else if (distToPlayer >= fadeStartDistance) {
        opacity = minOpacity;
      } else {
        const t = (fadeStartDistance - distToPlayer) / (fadeStartDistance - fullVisibleDistance);
        opacity = minOpacity + (1.0 - minOpacity) * Math.max(0, Math.min(1, t));
      }

      visible.push({
        x: trap.x,
        y: trap.y,
        type: trap.type,
        opacity,
        trapDef: trap.trapDef,
        activated: trap.activated,
        activationTimer: trap.activationTimer
      });
    }

    return visible;
  }

  /**
   * Compute actual damage and status effect for a triggered trap.
   */
  applyTrigger(trap, playerSTA) {
    const { trapDef } = trap;
    const floorTier = Math.ceil(this.floorNumber / 2);

    const damage = trapDef.damage.base + trapDef.damage.perFloorTier * floorTier;

    let status = null;
    if (trapDef.status) {
      status = {
        type: trapDef.status.type,
        duration: trapDef.status.duration
      };
      if (trapDef.status.magnitude !== undefined) {
        status.magnitude = trapDef.status.magnitude;
      }
    }

    let knockback = null;
    if (trapDef.knockback) {
      knockback = trapDef.knockback;
    }

    return { damage, status, knockback };
  }

  /**
   * Remove all traps (called on floor change).
   */
  clear() {
    this.activeTraps = [];
  }

  /**
   * Remove traps that have completed their activation animation.
   */
  removeActivated() {
    this.activeTraps = this.activeTraps.filter(
      trap => !trap.activated || trap.activationTimer > 0
    );
  }
}
