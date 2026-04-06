import { Enemy } from '../entities/enemy.js';
import { Boss } from '../entities/boss.js';

export class DungeonRoomManager {
  constructor(dungeon, layoutManager) {
    this.dungeon = dungeon;
    this.layoutManager = layoutManager;
    this.currentRoom = null;
    this.previousRoom = null;
    this.enemies = [];
    this.boss = null;
    this.stairsPosition = null; // { x, y } set when boss dies

    // Reveal the entrance room
    const entrance = dungeon.rooms.find(r => r.id === dungeon.entranceRoomId);
    if (entrance) {
      entrance.revealed = true;
      entrance.visited = true;
      entrance.cleared = true;
      this._revealAdjacentRooms(entrance);
    }
  }

  getCurrentRoom(px, py) {
    for (const room of this.dungeon.rooms) {
      if (px >= room.x && px < room.x + room.width &&
          py >= room.y && py < room.y + room.height) {
        return room;
      }
    }
    return null; // in a corridor
  }

  checkRoomTransition(px, py) {
    const room = this.getCurrentRoom(px, py);
    if (!room) return null;
    if (room === this.currentRoom) return null;

    this.previousRoom = this.currentRoom;
    this.currentRoom = room;

    if (!room.visited) {
      return this.onEnterRoom(room);
    }
    return null;
  }

  onEnterRoom(room) {
    room.visited = true;
    room.revealed = true;
    this._revealAdjacentRooms(room);

    const isCombatRoom = ['combat', 'ambush', 'arena', 'boss'].includes(room.type);

    if (isCombatRoom && !room.cleared) {
      // Lock doors
      this._lockRoomDoors(room);

      // Spawn enemies
      this._spawnEnemiesForRoom(room);

      return { type: 'combat_start', room };
    }

    if (room.type === 'safe') {
      return { type: 'safe_room', room };
    }

    if (room.type === 'shop') {
      return { type: 'shop_room', room };
    }

    if (room.type === 'treasure' && !room.cleared) {
      if (room.enemies.length > 0) {
        this._spawnEnemiesForRoom(room);
        return { type: 'combat_start', room };
      }
      room.cleared = true;
      return { type: 'treasure_room', room };
    }

    return { type: 'enter', room };
  }

  onRoomCleared(room) {
    room.cleared = true;
    this._unlockRoomDoors(room);

    // Boss room: place stairs
    if (room.type === 'boss') {
      this.stairsPosition = {
        x: room.x + room.width / 2,
        y: room.y + room.height / 2,
      };
      return { type: 'boss_defeated', room };
    }

    return { type: 'room_cleared', room };
  }

  isRoomCleared() {
    if (!this.currentRoom) return true;
    if (this.currentRoom.cleared) return true;

    const alive = this.enemies.filter(e => !e.dead);
    if (this.boss && !this.boss.dead) return false;
    return alive.length === 0;
  }

  isPlayerOnStairs(px, py) {
    if (!this.stairsPosition) return false;
    const dx = px - this.stairsPosition.x;
    const dy = py - this.stairsPosition.y;
    return Math.sqrt(dx * dx + dy * dy) < 40;
  }

  getActiveEnemies() {
    return this.enemies.filter(e => !e.dead);
  }

  _spawnEnemiesForRoom(room) {
    this.enemies = [];
    this.boss = null;

    for (const spawn of room.enemies) {
      const ex = room.x + 64 + Math.random() * (room.width - 128);
      const ey = room.y + 64 + Math.random() * (room.height - 128);
      const enemy = new Enemy(spawn.type, ex, ey, this.dungeon.floor);
      if (spawn.hpMul && spawn.hpMul !== 1) {
        enemy.hp = Math.round(enemy.hp * spawn.hpMul);
        enemy.maxHP = Math.round(enemy.maxHP * spawn.hpMul);
      }
      if (spawn.spdMul && spawn.spdMul !== 1) {
        enemy.speed *= spawn.spdMul;
        enemy.baseSpeed *= spawn.spdMul;
      }
      this.enemies.push(enemy);
    }

    // Boss room: spawn the actual boss
    if (room.type === 'boss') {
      const bossType = this._getBossType();
      if (bossType) {
        const bx = room.x + room.width / 2;
        const by = room.y + room.height / 2;
        this.boss = new Boss(bossType, bx, by, this.dungeon.floor);
      }
    }
  }

  _getBossType() {
    // Find the level config boss from level data (passed through dungeon)
    // Fallback to a default boss based on floor
    const bosses = ['stoneguard', 'voidlord', 'swarmmother', 'plagueking', 'frostlich', 'infernalwyrm'];
    return bosses[this.dungeon.floor % bosses.length] || 'stoneguard';
  }

  _lockRoomDoors(room) {
    for (const door of room.doors) {
      if (door.hidden) continue;
      door.locked = true;
      // Add a wall obstacle to block the door
      const wallObs = {
        type: 'door_locked',
        x: door.x, y: door.y,
        width: door.width, height: door.height,
        _doorId: door.id,
      };
      this.layoutManager.obstacles.push(wallObs);
      this.layoutManager._markRectSolid(door.x, door.y, door.width, door.height);
    }
  }

  _unlockRoomDoors(room) {
    for (const door of room.doors) {
      door.locked = false;
      // Remove the wall obstacle
      this.layoutManager.obstacles = this.layoutManager.obstacles.filter(o => o._doorId !== door.id);
      // Re-carve the door area as walkable
      this.layoutManager._carveRect(door.x, door.y, door.width, door.height);
    }
  }

  _revealAdjacentRooms(room) {
    for (const connId of room.connections) {
      const adj = this.dungeon.rooms.find(r => r.id === connId);
      if (adj && !adj.revealed) {
        adj.revealed = true;
      }
    }
  }

  // Get all rooms for minimap rendering
  getRooms() {
    return this.dungeon.rooms;
  }

  getCorridors() {
    return this.dungeon.corridors;
  }
}
