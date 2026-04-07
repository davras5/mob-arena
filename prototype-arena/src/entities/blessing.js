export class Blessing {
  constructor(x, y, duration = 15) {
    this.x = x;
    this.y = y;
    this.radius = 40;  // Trigger zone
    this.collected = false;
    this.timer = duration;   // Seconds until it expires
    this.maxTimer = duration;
    this.expired = false;
  }

  update(dt) {
    if (this.collected || this.expired) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.expired = true;
    }
  }
}
