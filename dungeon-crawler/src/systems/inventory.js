export class Inventory {
  constructor() {
    this.cols = 10;
    this.rows = 6;
    this.grid = Array.from({ length: this.rows }, () => new Array(this.cols).fill(null));
    this.items = {};
    this.hotbar = [null, null, null, null];
  }

  /**
   * Check if an item (with gridW, gridH) can fit at position (col, row).
   * All cells in the rectangle must be null or already occupied by this same item.
   */
  canPlace(item, col, row) {
    const w = item.gridW || 1;
    const h = item.gridH || 1;

    if (col < 0 || row < 0 || col + w > this.cols || row + h > this.rows) {
      return false;
    }

    for (let r = row; r < row + h; r++) {
      for (let c = col; c < col + w; c++) {
        const cell = this.grid[r][c];
        if (cell !== null && cell !== item.id) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Place item in grid. Fill all cells with item.id. Store item in this.items.
   */
  place(item, col, row) {
    const w = item.gridW || 1;
    const h = item.gridH || 1;

    for (let r = row; r < row + h; r++) {
      for (let c = col; c < col + w; c++) {
        this.grid[r][c] = item.id;
      }
    }

    this.items[item.id] = item;
  }

  /**
   * Remove item from grid. Clear all cells that reference this itemId.
   * Remove from this.items. Return the item object.
   */
  remove(itemId) {
    const item = this.items[itemId];
    if (!item) return null;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === itemId) {
          this.grid[r][c] = null;
        }
      }
    }

    delete this.items[itemId];
    return item;
  }

  /**
   * Find the first position where item fits (scan top-left to bottom-right).
   * If found, place it and return true. Otherwise return false.
   */
  autoPlace(item) {
    const w = item.gridW || 1;
    const h = item.gridH || 1;

    for (let r = 0; r <= this.rows - h; r++) {
      for (let c = 0; c <= this.cols - w; c++) {
        if (this.canPlace(item, c, r)) {
          this.place(item, c, r);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Return the item at this cell, or null.
   */
  getItemAt(col, row) {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) {
      return null;
    }

    const itemId = this.grid[row][col];
    if (!itemId) return null;

    return this.items[itemId] || null;
  }

  /**
   * Return true if there's no space for even a 1x1 item.
   */
  isFull() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === null) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Return array of all items in inventory.
   */
  getItems() {
    return Object.values(this.items);
  }

  /**
   * Return array of items with rarity === 'junk'.
   */
  getJunkItems() {
    return this.getItems().filter(item => item.rarity === 'junk');
  }

  /**
   * Return total sell value of all junk items.
   */
  getJunkValue() {
    return this.getJunkItems().reduce((total, item) => total + (item.sellValue || 0), 0);
  }

  /**
   * Remove all junk items, return total sell value.
   */
  removeAllJunk() {
    const junkItems = this.getJunkItems();
    let totalValue = 0;

    for (const item of junkItems) {
      totalValue += item.sellValue || 0;
      // Also clear hotbar references
      for (let s = 0; s < this.hotbar.length; s++) {
        if (this.hotbar[s] === item.id) {
          this.hotbar[s] = null;
        }
      }
      this.remove(item.id);
    }

    return totalValue;
  }

  /**
   * Assign a potion/consumable to hotbar slot (0-3).
   * Validates slot is 0-3 and item exists.
   */
  assignToHotbar(itemId, slot) {
    if (slot < 0 || slot > 3) return false;
    if (!this.items[itemId]) return false;

    this.hotbar[slot] = itemId;
    return true;
  }

  /**
   * Clear hotbar slot.
   */
  removeFromHotbar(slot) {
    if (slot < 0 || slot > 3) return;
    this.hotbar[slot] = null;
  }

  /**
   * Return item for hotbar slot, or null.
   */
  getHotbarItem(slot) {
    if (slot < 0 || slot > 3) return null;
    const itemId = this.hotbar[slot];
    if (!itemId) return null;
    return this.items[itemId] || null;
  }

  /**
   * Consume one from a stacked item. If stack reaches 0, remove from
   * inventory and hotbar. Return the item data (for applying effect) or null.
   */
  useHotbarItem(slot) {
    if (slot < 0 || slot > 3) return null;

    const itemId = this.hotbar[slot];
    if (!itemId) return null;

    const item = this.items[itemId];
    if (!item) {
      this.hotbar[slot] = null;
      return null;
    }

    // Copy item data before potential removal so caller can apply effects
    const itemData = { ...item };

    if (item.stackCount !== undefined && item.stackCount > 0) {
      item.stackCount--;
      if (item.stackCount <= 0) {
        this.hotbar[slot] = null;
        this.remove(itemId);
      }
    } else {
      // Non-stackable consumable: just remove it
      this.hotbar[slot] = null;
      this.remove(itemId);
    }

    return itemData;
  }

  /**
   * Serialize grid, items, and hotbar for localStorage.
   */
  toSaveData() {
    return {
      cols: this.cols,
      rows: this.rows,
      grid: this.grid.map(row => [...row]),
      items: JSON.parse(JSON.stringify(this.items)),
      hotbar: [...this.hotbar],
    };
  }

  /**
   * Restore from saved data.
   */
  loadFromSave(data) {
    if (!data) return;

    if (data.cols !== undefined) this.cols = data.cols;
    if (data.rows !== undefined) this.rows = data.rows;

    if (data.grid) {
      this.grid = data.grid.map(row => [...row]);
    } else {
      this.grid = Array.from({ length: this.rows }, () => new Array(this.cols).fill(null));
    }

    if (data.items) {
      this.items = JSON.parse(JSON.stringify(data.items));
    } else {
      this.items = {};
    }

    if (data.hotbar) {
      this.hotbar = [...data.hotbar];
    } else {
      this.hotbar = [null, null, null, null];
    }
  }

  /**
   * Return { item, col, row } or null. Col/row is the top-left cell of the item.
   */
  findItemById(itemId) {
    const item = this.items[itemId];
    if (!item) return null;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === itemId) {
          // Verify this is the top-left corner: no cell above or to the left
          // should also hold this itemId
          const isTop = r === 0 || this.grid[r - 1][c] !== itemId;
          const isLeft = c === 0 || this.grid[r][c - 1] !== itemId;
          if (isTop && isLeft) {
            return { item, col: c, row: r };
          }
        }
      }
    }

    return null;
  }

  /**
   * Count total stack of a consumable by baseType across the whole inventory.
   * Used by the HUD to render the stack badge on bound action bar slots.
   */
  countByBaseType(baseType) {
    if (!baseType) return 0;
    let total = 0;
    for (const item of Object.values(this.items)) {
      if (item && item.baseType === baseType) {
        total += (item.stackCount || 1);
      }
    }
    return total;
  }

  /**
   * Find the first stack of a consumable by baseType. Returns the item
   * object (live ref, not a clone) or null. Used by the v3 hotbar
   * consumable cast path so we can decrement the stack atomically.
   */
  findFirstByBaseType(baseType) {
    if (!baseType) return null;
    for (const item of Object.values(this.items)) {
      if (item && item.baseType === baseType && (item.stackCount || 1) > 0) {
        return item;
      }
    }
    return null;
  }

  /**
   * Consume one of a stackable item by baseType. Returns the consumed
   * item data (clone) on success, or null if there's no stack to consume.
   * If the stack hits 0 after consumption, the item is removed from the
   * grid (the bound hotbar slot stays bound — auto-refill is handled by
   * the v3 game.js when a new stack arrives).
   */
  consumeOneByBaseType(baseType) {
    const item = this.findFirstByBaseType(baseType);
    if (!item) return null;
    const data = { ...item };
    if (item.stackCount !== undefined && item.stackCount > 0) {
      item.stackCount--;
      if (item.stackCount <= 0) {
        this.remove(item.id);
      }
    } else {
      // Non-stackable: just remove
      this.remove(item.id);
    }
    return data;
  }

  /**
   * Smart add: if stackable and matching stack exists with room, increment count.
   * Otherwise autoPlace. Return true/false.
   */
  addItem(item) {
    // Handle stackable items (potions, consumables) — accepts both 'stackable' and 'isStackable'
    const itemStackable = item.stackable || item.isStackable;
    if (itemStackable && item.baseType) {
      // Try to find an existing stack of the same baseType with room
      const existingItems = this.getItems();
      for (const existing of existingItems) {
        if (
          existing.baseType === item.baseType &&
          (existing.stackable || existing.isStackable) &&
          existing.stackCount !== undefined
        ) {
          const maxStack = existing.maxStack || 5;
          const addCount = item.stackCount || 1;
          if (existing.stackCount + addCount <= maxStack) {
            existing.stackCount += addCount;
            return true;
          } else if (existing.stackCount < maxStack) {
            // Partially fill this stack, then try to place the remainder
            const spaceLeft = maxStack - existing.stackCount;
            existing.stackCount = maxStack;
            const remainder = addCount - spaceLeft;
            if (remainder > 0) {
              const newStack = { ...item, stackCount: remainder };
              return this.autoPlace(newStack);
            }
            return true;
          }
          // This stack is full, keep looking for another
        }
      }

      // No existing stack found (or all full) -- place as new stack
      if (item.stackCount === undefined) {
        item.stackCount = 1;
      }
      return this.autoPlace(item);
    }

    // Non-stackable item
    return this.autoPlace(item);
  }
}
