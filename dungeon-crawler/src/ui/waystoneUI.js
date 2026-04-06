export class WaystoneUI {
  constructor() {
    this.container = document.getElementById('waystone-panel');
    this._onKeyDown = null;
  }

  show(floors, playerLevel, persistence) {
    this.container.classList.remove('hidden');
    this.container.innerHTML = '';

    return new Promise((resolve) => {
      const resolved = { done: false };
      const finish = (result) => {
        if (resolved.done) return;
        resolved.done = true;
        this.hide();
        resolve(result);
      };

      // Build floor rows
      const rows = floors.map((f) => {
        const state = this._getFloorState(f, playerLevel, persistence);
        const isClickable = state !== 'locked';
        const stateHTML = this._renderBadge(state, f.floor, persistence);

        return `
          <div class="waystone-floor ${state} ${isClickable ? 'waystone-clickable' : ''}"
               data-floor="${f.floor}"
               ${!isClickable ? 'aria-disabled="true"' : ''}>
            <span class="waystone-floor-icon">${f.icon}</span>
            <div class="waystone-floor-info">
              <div class="waystone-floor-name"><strong>Floor ${f.floor} &mdash; ${f.name}</strong></div>
              <div class="waystone-floor-req">${state === 'locked' ? `Requires level ${f.levelReq}` : f.description}</div>
            </div>
            <div class="waystone-floor-badge">${stateHTML}</div>
          </div>
        `;
      }).join('');

      this.container.innerHTML = `
        <div class="waystone-header">
          <h2>WAYSTONE TRAVEL</h2>
          <button class="waystone-x-btn" id="waystone-x" title="Close">[X]</button>
        </div>
        <div class="waystone-list">
          ${rows}
        </div>
        <button class="waystone-camp-btn" id="waystone-camp">Return to Camp</button>
      `;

      // --- Click handlers ---

      // Close [X]
      this.container.querySelector('#waystone-x').addEventListener('click', () => {
        finish({ action: 'cancel' });
      });

      // Return to Camp
      this.container.querySelector('#waystone-camp').addEventListener('click', () => {
        finish({ action: 'camp' });
      });

      // Floor rows
      for (const el of this.container.querySelectorAll('.waystone-floor.waystone-clickable')) {
        const handler = (e) => {
          e.preventDefault();
          const floorNum = parseInt(el.dataset.floor, 10);
          finish({ action: 'travel', floor: floorNum });
        };
        el.addEventListener('click', handler);
        el.addEventListener('touchend', handler);
      }

      // ESC key
      this._onKeyDown = (e) => {
        if (e.key === 'Escape') {
          finish({ action: 'cancel' });
        }
      };
      document.addEventListener('keydown', this._onKeyDown);
    });
  }

  hide() {
    this.container.classList.add('hidden');
    if (this._onKeyDown) {
      document.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }
  }

  _getFloorState(floor, playerLevel, persistence) {
    // Floor 1 is always unlocked
    const discovered = persistence.data.dungeon.discoveredFloors || [];
    const isDiscovered = floor.floor === 1 || discovered.includes(floor.floor);

    if (persistence.isFloorCleared(floor.floor)) {
      return 'cleared';
    }

    if (isDiscovered) {
      const floorState = persistence.getFloorState(floor.floor);
      if (floorState && floorState.roomsCleared && floorState.roomsCleared.length > 0) {
        return 'in-progress';
      }
      return 'discovered';
    }

    if (playerLevel >= floor.levelReq) {
      return 'discovered';
    }

    return 'locked';
  }

  _renderBadge(state, floorNum, persistence) {
    switch (state) {
      case 'cleared':
        return '<span class="badge-cleared">&#10003; CLEARED</span>';
      case 'in-progress': {
        const fs = persistence.getFloorState(floorNum);
        const count = fs && fs.roomsCleared ? fs.roomsCleared.length : 0;
        return `<span class="badge-progress">&#9654; IN PROGRESS (${count} rooms)</span>`;
      }
      case 'discovered':
        return '<span class="badge-discovered">&#9679; DISCOVERED</span>';
      case 'locked':
        return '<span class="badge-locked">&#128274; LOCKED</span>';
      default:
        return '';
    }
  }
}
