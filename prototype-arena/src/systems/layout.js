const TILE_SIZE = 64;

export class LayoutManager {
  constructor(mapWidth, mapHeight, layoutData) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.tileSize = TILE_SIZE;
    this.cols = Math.ceil(mapWidth / TILE_SIZE);
    this.rows = Math.ceil(mapHeight / TILE_SIZE);
    this.layoutData = layoutData || null;

    // Walkability grid: true = walkable, false = solid
    this.grid = new Array(this.rows * this.cols).fill(true);

    // Obstacles list for rendering and collision
    this.obstacles = [];

    // Rooms (for linear/mixed layouts)
    this.rooms = [];

    if (layoutData) {
      this._buildFromData(layoutData);
    }
  }

  _buildFromData(data) {
    // If layout has rooms, carve them out (everything else is wall)
    if (data.rooms && data.rooms.length > 0) {
      // Start with all solid
      this.grid.fill(false);
      this.rooms = data.rooms;

      // Carve walkable rooms
      for (const room of data.rooms) {
        this._carveRect(room.x, room.y, room.width, room.height);
      }
    }

    // Add obstacles
    if (data.obstacles) {
      for (const obs of data.obstacles) {
        this.obstacles.push(obs);
        // Mark obstacle tiles as solid (for pillar/wall types)
        if (obs.type === 'pillar') {
          this._markCircleSolid(obs.x, obs.y, obs.radius);
        } else if (obs.type === 'wall') {
          this._markRectSolid(obs.x, obs.y, obs.width, obs.height);
        }
        // pits and hazard_zones don't block movement, just deal damage
      }
    }
  }

  _carveRect(x, y, w, h) {
    const startCol = Math.floor(x / this.tileSize);
    const endCol = Math.ceil((x + w) / this.tileSize);
    const startRow = Math.floor(y / this.tileSize);
    const endRow = Math.ceil((y + h) / this.tileSize);
    for (let r = startRow; r < endRow && r < this.rows; r++) {
      for (let c = startCol; c < endCol && c < this.cols; c++) {
        if (r >= 0 && c >= 0) {
          this.grid[r * this.cols + c] = true;
        }
      }
    }
  }

  _markCircleSolid(cx, cy, radius) {
    const startCol = Math.floor((cx - radius) / this.tileSize);
    const endCol = Math.ceil((cx + radius) / this.tileSize);
    const startRow = Math.floor((cy - radius) / this.tileSize);
    const endRow = Math.ceil((cy + radius) / this.tileSize);
    for (let r = startRow; r <= endRow && r < this.rows; r++) {
      for (let c = startCol; c <= endCol && c < this.cols; c++) {
        if (r < 0 || c < 0) continue;
        const tx = (c + 0.5) * this.tileSize;
        const ty = (r + 0.5) * this.tileSize;
        const dx = tx - cx;
        const dy = ty - cy;
        if (Math.sqrt(dx * dx + dy * dy) < radius + this.tileSize * 0.3) {
          this.grid[r * this.cols + c] = false;
        }
      }
    }
  }

  _markRectSolid(x, y, w, h) {
    const startCol = Math.floor(x / this.tileSize);
    const endCol = Math.ceil((x + w) / this.tileSize);
    const startRow = Math.floor(y / this.tileSize);
    const endRow = Math.ceil((y + h) / this.tileSize);
    for (let r = startRow; r < endRow && r < this.rows; r++) {
      for (let c = startCol; c < endCol && c < this.cols; c++) {
        if (r >= 0 && c >= 0) {
          this.grid[r * this.cols + c] = false;
        }
      }
    }
  }

  isWalkable(x, y) {
    const col = Math.floor(x / this.tileSize);
    const row = Math.floor(y / this.tileSize);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return false;
    return this.grid[row * this.cols + col];
  }

  isTileWalkable(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return false;
    return this.grid[row * this.cols + col];
  }

  // Clamp entity position to walkable area, sliding along walls
  clampPosition(x, y, radius) {
    // Basic map boundary clamp
    x = Math.max(radius, Math.min(this.mapWidth - radius, x));
    y = Math.max(radius, Math.min(this.mapHeight - radius, y));

    // Check obstacle collisions (circle vs obstacle shapes)
    for (const obs of this.obstacles) {
      if (obs.type === 'pillar') {
        const dx = x - obs.x;
        const dy = y - obs.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = radius + obs.radius;
        if (dist < minDist && dist > 0) {
          // Push out
          x = obs.x + (dx / dist) * minDist;
          y = obs.y + (dy / dist) * minDist;
        }
      } else if (obs.type === 'wall') {
        // AABB collision
        const nearX = Math.max(obs.x, Math.min(obs.x + obs.width, x));
        const nearY = Math.max(obs.y, Math.min(obs.y + obs.height, y));
        const dx = x - nearX;
        const dy = y - nearY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius && dist > 0) {
          x = nearX + (dx / dist) * radius;
          y = nearY + (dy / dist) * radius;
        } else if (dist === 0) {
          // Inside the wall, push to nearest edge
          const distLeft = x - obs.x;
          const distRight = obs.x + obs.width - x;
          const distTop = y - obs.y;
          const distBottom = obs.y + obs.height - y;
          const minD = Math.min(distLeft, distRight, distTop, distBottom);
          if (minD === distLeft) x = obs.x - radius;
          else if (minD === distRight) x = obs.x + obs.width + radius;
          else if (minD === distTop) y = obs.y - radius;
          else y = obs.y + obs.height + radius;
        }
      }
    }

    // If rooms exist, check tile walkability
    if (this.rooms.length > 0 && !this.isWalkable(x, y)) {
      // Try to find nearest walkable position
      const col = Math.floor(x / this.tileSize);
      const row = Math.floor(y / this.tileSize);
      // Check neighbors
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (this.isTileWalkable(col + dc, row + dr)) {
            x = (col + dc + 0.5) * this.tileSize;
            y = (row + dr + 0.5) * this.tileSize;
            return { x, y };
          }
        }
      }
    }

    // Final boundary clamp
    x = Math.max(radius, Math.min(this.mapWidth - radius, x));
    y = Math.max(radius, Math.min(this.mapHeight - radius, y));

    return { x, y };
  }

  // Check if a projectile line hits a wall obstacle, return hit point or null
  raycast(x1, y1, x2, y2) {
    let closest = null;
    let closestDist = Infinity;

    for (const obs of this.obstacles) {
      if (obs.type === 'pillar') {
        const hit = this._rayCircle(x1, y1, x2, y2, obs.x, obs.y, obs.radius);
        if (hit && hit.dist < closestDist) {
          closestDist = hit.dist;
          closest = hit;
        }
      } else if (obs.type === 'wall') {
        const hit = this._rayRect(x1, y1, x2, y2, obs.x, obs.y, obs.width, obs.height);
        if (hit && hit.dist < closestDist) {
          closestDist = hit.dist;
          closest = hit;
        }
      }
    }

    return closest;
  }

  _rayCircle(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - cx;
    const fy = y1 - cy;
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;
    let disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    disc = Math.sqrt(disc);
    const t = (-b - disc) / (2 * a);
    if (t >= 0 && t <= 1) {
      return { x: x1 + dx * t, y: y1 + dy * t, dist: t * Math.sqrt(a) };
    }
    return null;
  }

  _rayRect(x1, y1, x2, y2, rx, ry, rw, rh) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    let tmin = 0, tmax = 1;

    if (dx !== 0) {
      let t1 = (rx - x1) / dx;
      let t2 = (rx + rw - x1) / dx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    } else if (x1 < rx || x1 > rx + rw) return null;

    if (dy !== 0) {
      let t1 = (ry - y1) / dy;
      let t2 = (ry + rh - y1) / dy;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    } else if (y1 < ry || y1 > ry + rh) return null;

    if (tmin >= 0 && tmin <= 1) {
      const dist = tmin * Math.sqrt(dx * dx + dy * dy);
      return { x: x1 + dx * tmin, y: y1 + dy * tmin, dist };
    }
    return null;
  }

  // Get hazard damage at a position (pits, hazard zones)
  getHazardDamage(x, y) {
    let damage = 0;
    for (const obs of this.obstacles) {
      if (obs.type === 'pit') {
        const dx = x - obs.x;
        const dy = y - obs.y;
        if (Math.sqrt(dx * dx + dy * dy) < obs.radius) {
          damage += obs.damage || 5;
        }
      } else if (obs.type === 'hazard_zone') {
        if (x >= obs.x && x <= obs.x + obs.width && y >= obs.y && y <= obs.y + obs.height) {
          damage += obs.damage || 3;
        }
      }
    }
    return damage;
  }

  // Get valid spawn positions away from obstacles
  getSpawnPosition(mapWidth, mapHeight) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const side = Math.floor(Math.random() * 4);
      const margin = 50;
      let x, y;
      switch (side) {
        case 0: x = margin + Math.random() * (mapWidth - 2 * margin); y = margin; break;
        case 1: x = margin + Math.random() * (mapWidth - 2 * margin); y = mapHeight - margin; break;
        case 2: x = margin; y = margin + Math.random() * (mapHeight - 2 * margin); break;
        case 3: x = mapWidth - margin; y = margin + Math.random() * (mapHeight - 2 * margin); break;
      }
      if (this.isWalkable(x, y)) return { x, y };
    }
    // Fallback
    return { x: mapWidth / 2, y: 50 };
  }
}
