export class WorldMap {
  constructor() {
    this.container = document.getElementById('world-map');
    this.nodesContainer = document.getElementById('world-map-nodes');
    this.onSelect = null;
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
      if (level.unlockRequires) {
        const parent = levels.find(l => l.id === level.unlockRequires);
        if (parent) {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', parent.position.x);
          line.setAttribute('y1', parent.position.y);
          line.setAttribute('x2', level.position.x);
          line.setAttribute('y2', level.position.y);
          const isUnlocked = !level.unlockRequires || clearedLevels.includes(level.unlockRequires);
          line.setAttribute('class', isUnlocked ? 'path-unlocked' : 'path-locked');
          svg.appendChild(line);
        }
      }
    }
    this.nodesContainer.appendChild(svg);

    // Draw level nodes
    for (const level of levels) {
      const isCleared = clearedLevels.includes(level.id);
      const isUnlocked = !level.unlockRequires || clearedLevels.includes(level.unlockRequires);

      const node = document.createElement('div');
      node.className = `world-node ${isCleared ? 'cleared' : ''} ${isUnlocked ? 'unlocked' : 'locked'}`;
      node.style.left = level.position.x + '%';
      node.style.top = level.position.y + '%';

      node.innerHTML = `
        <div class="node-icon">${level.icon}</div>
        <div class="node-name">${level.name}</div>
        ${isCleared ? '<div class="node-check">✓</div>' : ''}
        ${!isUnlocked ? '<div class="node-lock">🔒</div>' : ''}
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
      node.title = `${level.name}\n${level.description}\nWaves: ${level.waves} | Difficulty: ${'★'.repeat(level.difficulty)}`;

      this.nodesContainer.appendChild(node);
    }
  }

  hide() {
    this.container.classList.add('hidden');
  }
}
