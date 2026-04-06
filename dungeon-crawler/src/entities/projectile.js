export class Projectile {
  constructor(x, y, vx, vy, damage, isEnemy = false) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.radius = isEnemy ? 5 : 4;
    this.isEnemy = isEnemy;
    this.dead = false;
    this.pierce = 0;      // How many more enemies it can pass through
    this.bounces = 0;      // How many more bounces to nearby enemies
    this.bounceRange = 0;
    this.hitEnemies = new Set();  // Track which enemies already hit (for pierce)
    this.lifetime = 3.0;
    this.homing = 0;           // 0 = no homing, higher = more tracking
    this.homingTarget = null;
  }

  update(dt) {
    // Homing behavior: gently curve toward target
    if (this.homing > 0 && this.homingTarget && !this.homingTarget.dead) {
      const dx = this.homingTarget.x - this.x;
      const dy = this.homingTarget.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        const turnRate = this.homing * dt;
        this.vx += (dx / dist) * turnRate;
        this.vy += (dy / dist) * turnRate;
        // Re-normalize speed
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const targetSpeed = 300;
        this.vx = (this.vx / speed) * targetSpeed;
        this.vy = (this.vy / speed) * targetSpeed;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.lifetime -= dt;
    if (this.lifetime <= 0) this.dead = true;
  }

  isOutOfBounds(mapWidth, mapHeight) {
    return this.x < -20 || this.x > mapWidth + 20 || this.y < -20 || this.y > mapHeight + 20;
  }
}
