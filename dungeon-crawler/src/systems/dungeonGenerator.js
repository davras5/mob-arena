// Seeded RNG (mulberry32)
export class SeededRNG {
  constructor(seed) {
    this.state = seed | 0;
  }

  next() {
    this.state |= 0;
    this.state = this.state + 0x6D2B79F5 | 0;
    let t = Math.imul(this.state ^ this.state >>> 15, 1 | this.state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[this.int(0, arr.length - 1)]; }

  weightedPick(weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let roll = this.next() * total;
    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return key;
    }
    return entries[entries.length - 1][0];
  }
}

// Room size templates (in pixels, multiples of 64)
const ROOM_SIZES = {
  entrance:  { minW: 384, maxW: 512, minH: 384, maxH: 512 },
  combat:    { minW: 448, maxW: 640, minH: 448, maxH: 640 },
  ambush:    { minW: 384, maxW: 512, minH: 384, maxH: 512 },
  trap:      { minW: 448, maxW: 576, minH: 448, maxH: 576 },
  treasure:  { minW: 320, maxW: 384, minH: 320, maxH: 384 },
  boss:      { minW: 768, maxW: 896, minH: 768, maxH: 896 },
  safe:      { minW: 320, maxW: 320, minH: 320, maxH: 320 },
  shop:      { minW: 384, maxW: 384, minH: 448, maxH: 512 },
  puzzle:    { minW: 512, maxW: 512, minH: 512, maxH: 512 },
  arena:     { minW: 640, maxW: 768, minH: 640, maxH: 768 },
  secret:    { minW: 256, maxW: 320, minH: 256, maxH: 320 },
};

const GRID_COLS = 7;
const GRID_ROWS = 5;
const CELL_W = 640;
const CELL_H = 640;
const PADDING = 256;
const CORRIDOR_WIDTH = 192; // 3 tiles

function snap64(v) { return Math.round(v / 64) * 64; }

export class DungeonGenerator {
  generate(floor, seed, levelConfig) {
    const rng = new SeededRNG(seed + floor * 7919);

    // Determine room count
    const baseRooms = 8 + floor * 2 + rng.int(0, 2);
    const totalRooms = Math.min(16, Math.max(8, baseRooms));
    const criticalPathLen = Math.ceil(totalRooms * 0.6);

    // Grid for placement
    const grid = new Array(GRID_COLS * GRID_ROWS).fill(null);
    const rooms = [];
    let nextId = 0;

    // Place entrance at left-middle
    const entranceCell = { col: 0, row: 2 };
    const entranceRoom = this._createRoom(`room_${nextId++}`, 'entrance', entranceCell, rng);
    rooms.push(entranceRoom);
    grid[entranceCell.row * GRID_COLS + entranceCell.col] = entranceRoom;

    // Build critical path via biased random walk
    const criticalPath = [entranceRoom];
    let current = { ...entranceCell };

    const directions = [
      { name: 'east', dc: 1, dr: 0 },
      { name: 'north', dc: 0, dr: -1 },
      { name: 'south', dc: 0, dr: 1 },
      { name: 'west', dc: -1, dr: 0 },
    ];
    const dirWeights = { east: 50, north: 20, south: 20, west: 10 };

    for (let attempt = 0; attempt < totalRooms * 4; attempt++) {
      if (criticalPath.length >= criticalPathLen) break;

      const dirName = rng.weightedPick(dirWeights);
      const dir = directions.find(d => d.name === dirName);
      const nc = current.col + dir.dc;
      const nr = current.row + dir.dr;

      if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) continue;
      if (grid[nr * GRID_COLS + nc] !== null) continue;

      const type = this._pickCriticalRoomType(rng, criticalPath.length, criticalPathLen, floor);
      const room = this._createRoom(`room_${nextId++}`, type, { col: nc, row: nr }, rng);
      rooms.push(room);
      grid[nr * GRID_COLS + nc] = room;

      // Connect to previous
      const prev = criticalPath[criticalPath.length - 1];
      prev.connections.push(room.id);
      room.connections.push(prev.id);

      criticalPath.push(room);
      current = { col: nc, row: nr };
    }

    // Mark last critical path room as boss
    const exitRoom = criticalPath[criticalPath.length - 1];
    exitRoom.type = 'boss';

    // Add safe room at midpoint
    const midIdx = Math.floor(criticalPath.length / 2);
    if (criticalPath[midIdx].type === 'combat' || criticalPath[midIdx].type === 'ambush') {
      criticalPath[midIdx].type = 'safe';
    }

    // Add branch rooms
    const remaining = totalRooms - rooms.length;
    for (let i = 0; i < remaining; i++) {
      const parentRoom = rng.pick(rooms);
      const neighbors = this._getEmptyNeighbors(parentRoom.gridCol, parentRoom.gridRow, grid);
      if (neighbors.length === 0) continue;

      const cell = rng.pick(neighbors);
      const type = this._pickBranchRoomType(rng, floor);
      const room = this._createRoom(`room_${nextId++}`, type, cell, rng);
      rooms.push(room);
      grid[cell.row * GRID_COLS + cell.col] = room;

      parentRoom.connections.push(room.id);
      room.connections.push(parentRoom.id);
    }

    // Add occasional shortcut connections (loops)
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i], b = rooms[j];
        if (a.connections.includes(b.id)) continue;
        const dc = Math.abs(a.gridCol - b.gridCol);
        const dr = Math.abs(a.gridRow - b.gridRow);
        if ((dc === 1 && dr === 0) || (dc === 0 && dr === 1)) {
          if (rng.chance(0.15)) {
            a.connections.push(b.id);
            b.connections.push(a.id);
          }
        }
      }
    }

    // Convert grid to pixel positions
    for (const room of rooms) {
      const size = this._getRoomSize(room.type, rng);
      const cellX = room.gridCol * (CELL_W + PADDING) + PADDING;
      const cellY = room.gridRow * (CELL_H + PADDING) + PADDING;
      room.x = snap64(cellX + (CELL_W - size.w) / 2);
      room.y = snap64(cellY + (CELL_H - size.h) / 2);
      room.width = size.w;
      room.height = size.h;
    }

    // Add waystone to entrance room
    const entranceRoomForWaystone = rooms.find(r => r.type === 'entrance');
    if (entranceRoomForWaystone) {
      entranceRoomForWaystone.waystone = {
        x: entranceRoomForWaystone.x + entranceRoomForWaystone.width / 2,
        y: entranceRoomForWaystone.y + entranceRoomForWaystone.height / 2 + 40,
      };
    }

    // Build corridors
    const corridors = [];
    const connectedPairs = new Set();
    for (const room of rooms) {
      for (const connId of room.connections) {
        const pairKey = [room.id, connId].sort().join('-');
        if (connectedPairs.has(pairKey)) continue;
        connectedPairs.add(pairKey);

        const other = rooms.find(r => r.id === connId);
        if (!other) continue;
        const segments = this._buildCorridor(room, other);
        corridors.push({ fromRoomId: room.id, toRoomId: other.id, segments });
      }
    }

    // Place doors at room-corridor junctions
    for (const room of rooms) {
      for (const connId of room.connections) {
        const other = rooms.find(r => r.id === connId);
        if (!other) continue;
        const door = this._computeDoor(room, other);
        if (door) room.doors.push(door);
      }
    }

    // Generate obstacles and enemies per room
    for (const room of rooms) {
      room.obstacles = this._generateObstacles(room.type, room.width, room.height, rng);
      room.enemies = this._generateEnemies(room.type, floor, levelConfig, rng);
    }

    // Compute map bounds
    let maxX = 0, maxY = 0;
    for (const room of rooms) {
      maxX = Math.max(maxX, room.x + room.width);
      maxY = Math.max(maxY, room.y + room.height);
    }
    for (const c of corridors) {
      for (const s of c.segments) {
        maxX = Math.max(maxX, s.x + s.width);
        maxY = Math.max(maxY, s.y + s.height);
      }
    }
    const mapWidth = snap64(maxX + PADDING);
    const mapHeight = snap64(maxY + PADDING);

    return {
      seed,
      floor,
      rooms,
      corridors,
      entranceRoomId: entranceRoom.id,
      exitRoomId: exitRoom.id,
      mapWidth,
      mapHeight,
    };
  }

  _createRoom(id, type, cell, rng) {
    return {
      id,
      type,
      gridCol: cell.col,
      gridRow: cell.row,
      x: 0, y: 0, width: 0, height: 0,
      connections: [],
      obstacles: [],
      enemies: [],
      doors: [],
      revealed: false,
      cleared: false,
      visited: false,
    };
  }

  _pickCriticalRoomType(rng, index, total, floor) {
    if (index === 0) return 'entrance';
    if (index === total - 1) return 'boss';
    if (index === Math.floor(total / 2)) return 'safe';
    return rng.weightedPick({ combat: 50, ambush: 20, arena: 10 + floor * 3, trap: 15 });
  }

  _pickBranchRoomType(rng, floor) {
    return rng.weightedPick({ treasure: 30, trap: 20, shop: 12, puzzle: 12, secret: 10, combat: 16 });
  }

  _getEmptyNeighbors(col, row, grid) {
    const result = [];
    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nc = col + dc, nr = row + dr;
      if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS) {
        if (grid[nr * GRID_COLS + nc] === null) {
          result.push({ col: nc, row: nr });
        }
      }
    }
    return result;
  }

  _getRoomSize(type, rng) {
    const s = ROOM_SIZES[type] || ROOM_SIZES.combat;
    return {
      w: snap64(rng.int(s.minW / 64, s.maxW / 64) * 64),
      h: snap64(rng.int(s.minH / 64, s.maxH / 64) * 64),
    };
  }

  _buildCorridor(roomA, roomB) {
    const cxA = roomA.x + roomA.width / 2;
    const cyA = roomA.y + roomA.height / 2;
    const cxB = roomB.x + roomB.width / 2;
    const cyB = roomB.y + roomB.height / 2;
    const hw = CORRIDOR_WIDTH / 2;

    // If roughly same row, straight horizontal
    if (Math.abs(cyA - cyB) < CELL_H * 0.3) {
      const left = Math.min(roomA.x + roomA.width, roomB.x + roomB.width);
      const right = Math.max(roomA.x, roomB.x);
      const startX = Math.min(left, right);
      const endX = Math.max(left, right);
      const midY = snap64((cyA + cyB) / 2 - hw);
      return [{ x: startX, y: midY, width: endX - startX, height: CORRIDOR_WIDTH }];
    }

    // If roughly same col, straight vertical
    if (Math.abs(cxA - cxB) < CELL_W * 0.3) {
      const top = Math.min(roomA.y + roomA.height, roomB.y + roomB.height);
      const bottom = Math.max(roomA.y, roomB.y);
      const startY = Math.min(top, bottom);
      const endY = Math.max(top, bottom);
      const midX = snap64((cxA + cxB) / 2 - hw);
      return [{ x: midX, y: startY, width: CORRIDOR_WIDTH, height: endY - startY }];
    }

    // L-shaped corridor
    const midX = snap64((cxA + cxB) / 2);
    const segments = [];

    // Horizontal from A center to midX
    const hStartX = Math.min(cxA, midX);
    const hEndX = Math.max(cxA, midX);
    segments.push({
      x: snap64(hStartX - hw), y: snap64(cyA - hw),
      width: snap64(hEndX - hStartX + CORRIDOR_WIDTH), height: CORRIDOR_WIDTH,
    });

    // Vertical from cyA to cyB at midX
    const vStartY = Math.min(cyA, cyB);
    const vEndY = Math.max(cyA, cyB);
    segments.push({
      x: snap64(midX - hw), y: snap64(vStartY - hw),
      width: CORRIDOR_WIDTH, height: snap64(vEndY - vStartY + CORRIDOR_WIDTH),
    });

    // Horizontal from midX to B center
    const hStartX2 = Math.min(midX, cxB);
    const hEndX2 = Math.max(midX, cxB);
    segments.push({
      x: snap64(hStartX2 - hw), y: snap64(cyB - hw),
      width: snap64(hEndX2 - hStartX2 + CORRIDOR_WIDTH), height: CORRIDOR_WIDTH,
    });

    return segments;
  }

  _computeDoor(room, other) {
    const rcx = room.x + room.width / 2;
    const rcy = room.y + room.height / 2;
    const ocx = other.x + other.width / 2;
    const ocy = other.y + other.height / 2;
    const dx = ocx - rcx;
    const dy = ocy - rcy;
    const doorW = CORRIDOR_WIDTH;
    const doorH = 20;

    // Determine which side the door is on
    let side, x, y, w, h;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) { // east door
        side = 'east';
        x = room.x + room.width;
        y = snap64(rcy - doorW / 2);
        w = doorH; h = doorW;
      } else { // west door
        side = 'west';
        x = room.x - doorH;
        y = snap64(rcy - doorW / 2);
        w = doorH; h = doorW;
      }
    } else {
      if (dy > 0) { // south door
        side = 'south';
        x = snap64(rcx - doorW / 2);
        y = room.y + room.height;
        w = doorW; h = doorH;
      } else { // north door
        side = 'north';
        x = snap64(rcx - doorW / 2);
        y = room.y - doorH;
        w = doorW; h = doorH;
      }
    }

    const needsLock = ['combat', 'ambush', 'arena', 'boss'].includes(room.type);

    return {
      id: `door_${room.id}_${other.id}`,
      side,
      connectedRoomId: other.id,
      x, y, width: w, height: h,
      locked: false, // starts unlocked; locked when player enters combat rooms
      hidden: room.type === 'secret',
    };
  }

  _generateObstacles(type, w, h, rng) {
    const obs = [];
    switch (type) {
      case 'combat':
        for (let i = 0; i < rng.int(2, 4); i++) {
          obs.push({ type: 'pillar', x: rng.int(96, w - 96), y: rng.int(96, h - 96), radius: rng.int(16, 28) });
        }
        break;
      case 'ambush':
        for (let i = 0; i < rng.int(1, 3); i++) {
          obs.push({ type: 'pillar', x: rng.int(96, w - 96), y: rng.int(96, h - 96), radius: rng.int(16, 24) });
        }
        break;
      case 'trap':
        for (let i = 0; i < rng.int(3, 5); i++) {
          obs.push({ type: 'pit', x: rng.int(128, w - 128), y: rng.int(128, h - 128), radius: rng.int(30, 50), damage: 5, color: '#e74c3c' });
        }
        for (let i = 0; i < rng.int(1, 2); i++) {
          const zw = rng.int(2, 4) * 64, zh = rng.int(2, 4) * 64;
          obs.push({ type: 'hazard_zone', x: rng.int(64, w - 64 - zw), y: rng.int(64, h - 64 - zh), width: zw, height: zh, damage: 3, color: '#e67e22' });
        }
        break;
      case 'boss': {
        const m = 128;
        obs.push({ type: 'pillar', x: m, y: m, radius: 28 });
        obs.push({ type: 'pillar', x: w - m, y: m, radius: 28 });
        obs.push({ type: 'pillar', x: m, y: h - m, radius: 28 });
        obs.push({ type: 'pillar', x: w - m, y: h - m, radius: 28 });
        break;
      }
      case 'arena':
        for (let i = 0; i < rng.int(3, 6); i++) {
          obs.push({ type: 'pillar', x: rng.int(96, w - 96), y: rng.int(96, h - 96), radius: rng.int(20, 32) });
        }
        if (rng.chance(0.5)) {
          obs.push({ type: 'wall', x: snap64(w / 2 - 64), y: snap64(h / 2 - 10), width: 128, height: 20 });
        }
        break;
      case 'safe':
        obs.push({ type: 'hazard_zone', x: w / 2 - 64, y: h / 2 - 64, width: 128, height: 128, damage: -2, color: '#2ecc71' });
        break;
      case 'puzzle':
        for (let i = 0; i < rng.int(2, 4); i++) {
          obs.push({ type: 'pillar', x: rng.int(128, w - 128), y: rng.int(128, h - 128), radius: 16 });
        }
        break;
      case 'treasure':
        if (rng.chance(0.4)) {
          obs.push({ type: 'pillar', x: w / 2, y: h / 2 - 60, radius: 20 });
        }
        break;
    }
    return obs;
  }

  _generateEnemies(type, floor, levelConfig, rng) {
    const enemyPool = levelConfig.enemyTypes || ['grunt', 'rusher'];
    const diff = levelConfig.difficulty || 1;
    const hpMul = (levelConfig.hpMultiplier || 1.0) * (1 + (floor - 1) * 0.2);
    const spdMul = (levelConfig.speedMultiplier || 1.0) * (1 + (floor - 1) * 0.1);

    const spawns = [];
    switch (type) {
      case 'combat': {
        const count = rng.int(4, 6) + Math.floor(diff * 0.5);
        for (let i = 0; i < count; i++) {
          spawns.push({ type: rng.pick(enemyPool), hpMul, spdMul });
        }
        break;
      }
      case 'ambush': {
        const count = rng.int(5, 8) + Math.floor(diff * 0.5);
        for (let i = 0; i < count; i++) {
          spawns.push({ type: rng.pick(enemyPool), hpMul, spdMul });
        }
        break;
      }
      case 'arena': {
        const count = rng.int(8, 12) + diff;
        for (let i = 0; i < count; i++) {
          spawns.push({ type: rng.pick(enemyPool), hpMul, spdMul });
        }
        // Mini-boss: a brute with extra HP
        if (enemyPool.includes('brute')) {
          spawns.push({ type: 'brute', hpMul: hpMul * 2, spdMul });
        }
        break;
      }
      case 'treasure': {
        // One elite guard
        if (rng.chance(0.6)) {
          spawns.push({ type: rng.pick(enemyPool), hpMul: hpMul * 2, spdMul });
        }
        break;
      }
      case 'boss': {
        // Boss is handled separately via levelConfig.boss
        // Add some regular enemies too
        const count = rng.int(3, 5);
        for (let i = 0; i < count; i++) {
          spawns.push({ type: rng.pick(enemyPool), hpMul, spdMul });
        }
        break;
      }
      case 'trap': {
        const count = rng.int(2, 3);
        for (let i = 0; i < count; i++) {
          spawns.push({ type: rng.pick(enemyPool), hpMul, spdMul });
        }
        break;
      }
      // entrance, safe, shop, puzzle, secret: no enemies by default
    }
    return spawns;
  }

  // Convert dungeon data to LayoutManager-compatible format
  toLayoutData(dungeon) {
    const allRooms = [];
    const allObstacles = [];

    for (const room of dungeon.rooms) {
      allRooms.push({ id: room.id, x: room.x, y: room.y, width: room.width, height: room.height });
      // Offset obstacles to room's world position
      for (const obs of room.obstacles) {
        const worldObs = { ...obs };
        if (obs.type === 'pillar' || obs.type === 'pit') {
          worldObs.x = obs.x + room.x;
          worldObs.y = obs.y + room.y;
        } else if (obs.type === 'wall' || obs.type === 'hazard_zone') {
          worldObs.x = obs.x + room.x;
          worldObs.y = obs.y + room.y;
        }
        allObstacles.push(worldObs);
      }
    }

    // Add waystone obstacles from entrance rooms
    for (const room of dungeon.rooms) {
      if (room.waystone) {
        allObstacles.push({
          type: 'waystone',
          x: room.waystone.x,
          y: room.waystone.y,
          radius: 20,
        });
      }
    }

    // Add corridor segments as rooms
    for (const corridor of dungeon.corridors) {
      for (let i = 0; i < corridor.segments.length; i++) {
        const seg = corridor.segments[i];
        allRooms.push({ id: `corr_${corridor.fromRoomId}_${corridor.toRoomId}_${i}`, ...seg });
      }
    }

    return {
      type: 'dungeon',
      rooms: allRooms,
      obstacles: allObstacles,
    };
  }
}
