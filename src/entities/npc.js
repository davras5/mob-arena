export class NPC {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.x = config.x;
    this.y = config.y;
    this.radius = config.radius || 16;
    this.color = config.color || '#fff';
    this.interactRadius = config.interactRadius || 60;
    this.type = config.type; // 'trainer', 'vendor', 'waystone'
    this.icon = config.icon || '';
  }

  isPlayerInRange(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    return Math.sqrt(dx * dx + dy * dy) < this.interactRadius;
  }
}
