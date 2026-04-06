export class WorldMap {
  constructor() {
    this.container = document.getElementById('world-map');
    this.nodesContainer = document.getElementById('world-map-nodes');
    this.onSelect = null;
  }

  _isUnlocked(level, clearedLevels) {
    // No requirement = always unlocked
    if (!level.unlockRequires && !level.unlockRequiresAny) return true;

    // unlockRequiresAny: at least one must be cleared (OR logic)
    if (level.unlockRequiresAny) {
      const any = Array.isArray(level.unlockRequiresAny) ? level.unlockRequiresAny : [level.unlockRequiresAny];
      if (!any.some(id => clearedLevels.includes(id))) return false;
    }

    // unlockRequires: string = single, array = all must be cleared (AND logic)
    if (level.unlockRequires) {
      if (Array.isArray(level.unlockRequires)) {
        return level.unlockRequires.every(id => clearedLevels.includes(id));
      }
      return clearedLevels.includes(level.unlockRequires);
    }

    return true;
  }

  _getParentIds(level) {
    const parents = [];
    if (level.unlockRequires) {
      if (Array.isArray(level.unlockRequires)) {
        parents.push(...level.unlockRequires);
      } else {
        parents.push(level.unlockRequires);
      }
    }
    if (level.unlockRequiresAny) {
      const any = Array.isArray(level.unlockRequiresAny) ? level.unlockRequiresAny : [level.unlockRequiresAny];
      parents.push(...any);
    }
    return parents;
  }

  show(levels, clearedLevels, onSelect) {
    this.container.classList.remove('hidden');
    this.nodesContainer.innerHTML = '';
    this.onSelect = onSelect;

    // Draw connecting lines as SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'world-map-lines');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');

    for (const level of levels) {
      const parentIds = this._getParentIds(level);
      for (const parentId of parentIds) {
        const parent = levels.find(l => l.id === parentId);
        if (parent) {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', parent.position.x);
          line.setAttribute('y1', parent.position.y);
          line.setAttribute('x2', level.position.x);
          line.setAttribute('y2', level.position.y);
          const isUnlocked = this._isUnlocked(level, clearedLevels);
          line.setAttribute('class', isUnlocked ? 'path-unlocked' : 'path-locked');
          svg.appendChild(line);
        }
      }
    }
    this.nodesContainer.appendChild(svg);

    // Draw level nodes
    for (const level of levels) {
      const isCleared = clearedLevels.includes(level.id);
      const isUnlocked = this._isUnlocked(level, clearedLevels);

      const node = document.createElement('div');
      node.className = `world-node ${isCleared ? 'cleared' : ''} ${isUnlocked ? 'unlocked' : 'locked'}`;
      node.style.left = level.position.x + '%';
      node.style.top = level.position.y + '%';

      node.innerHTML = `
        <div class="node-icon">${level.icon}</div>
        <div class="node-name">${level.name}</div>
        ${isCleared ? '<div class="node-check">\u2713</div>' : ''}
        ${!isUnlocked ? '<div class="node-lock">\ud83d\udd12</div>' : ''}
      `;

      if (isUnlocked) {
        node.addEventListener('click', () => {
          this.hide();
          if (this.onSelect) this.onSelect(level);
        });
        node.addEventListener('touchend', (e) => {
          e.preventDefault();
          this.hide();
          if (this.onSelect) this.onSelect(level);
        });
      }

      // Tooltip on hover
      const diffStars = '\u2605'.repeat(level.difficulty);
      node.title = `${level.name}\n${level.description}\nWaves: ${level.waves} | Difficulty: ${diffStars}`;

      this.nodesContainer.appendChild(node);
    }
  }

  hide() {
    this.container.classList.add('hidden');
  }
}
