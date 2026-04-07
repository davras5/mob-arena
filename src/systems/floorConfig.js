export class FloorConfig {
  constructor(floorsData) {
    this.floors = floorsData || [];
  }

  getFloor(floorNum) {
    return this.floors.find(f => f.id === floorNum) || this.floors[0];
  }

  getTotalFloors() {
    return this.floors.length;
  }

  // Convert floor data to level config format for dungeon generator
  toLevelConfig(floorNum) {
    const fc = this.getFloor(floorNum);
    if (!fc) return null;

    const midLevel = Math.floor((fc.enemyLevelRange[0] + fc.enemyLevelRange[1]) / 2);

    return {
      id: `floor_${floorNum}`,
      name: fc.name,
      description: fc.description,
      icon: fc.icon,
      waves: 1, // not used in dungeon mode
      boss: fc.mainBoss.type,
      bossLevel: fc.mainBoss.level,
      sideBosses: fc.sideBosses || [],
      enemyTypes: fc.enemyTypes,
      enemyLevelRange: fc.enemyLevelRange,
      tilePrimary: fc.theme.tilePrimary,
      tileSecondary: fc.theme.tileSecondary,
      tileGrid: fc.theme.tileGrid,
      borderColor: fc.theme.tileBorder,
      mapWidth: 1600,
      mapHeight: 1600,
      difficulty: floorNum,
      playerLevelReq: fc.playerLevelReq,
      trapDensity: fc.trapDensity,
      trapTypes: fc.trapTypes,
      roomCount: fc.roomCount,
      dungeonGrid: fc.dungeonGrid,
      dungeonFloors: 1,
    };
  }
}
