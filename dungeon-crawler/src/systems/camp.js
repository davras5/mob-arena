import { NPC } from '../entities/npc.js';
import { LayoutManager } from './layout.js';

export class CampManager {
  constructor(campData) {
    this.campData = campData;
    this.npcs = campData.npcs.map(n => new NPC(n));
    this.nearestNPC = null;
    this.campfire = campData.campfire || null;

    // Create layout
    this.layoutManager = new LayoutManager(
      campData.mapWidth,
      campData.mapHeight,
      campData.layout
    );
  }

  update(playerX, playerY) {
    // Find nearest interactable NPC
    this.nearestNPC = null;
    let nearestDist = Infinity;

    for (const npc of this.npcs) {
      if (npc.isPlayerInRange(playerX, playerY)) {
        const dx = playerX - npc.x;
        const dy = playerY - npc.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          this.nearestNPC = npc;
        }
      }
    }

    return this.nearestNPC;
  }

  getPlayerSpawn() {
    return this.campData.playerSpawn || { x: 608, y: 720 };
  }
}
