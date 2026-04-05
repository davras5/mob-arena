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
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.lifetime -= dt;
    if (this.lifetime <= 0) this.dead = true;
  }

  isOutOfBounds(mapWidth, mapHeight) {
    return this.x < -20 || this.x > mapWidth + 20 || this.y < -20 || this.y > mapHeight + 20;
  }
}
