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
        // Discovered floors (and below) are always clickable; only undiscovered
        // floors are gated. Per WIREFRAMES §9 there is no hard level lock.
        const isClickable = state !== 'undiscovered';
        const stateHTML = this._renderBadge(state, f.floor, persistence);

        // Recommended-level warning: yellow ⚠ when the floor is more than 3
        // levels above the player. Non-blocking — the player can still travel.
        const recLvl = f.levelReq || f.recommendedLevel || 1;
        const overleveled = recLvl > playerLevel + 3;
        const warnIcon = (state !== 'undiscovered' && overleveled)
          ? `<span class="waystone-warn" title="Recommended Lv ${recLvl} — you are Lv ${playerLevel}. Enemies will be much stronger.">&#9888;</span>`
          : '';

        let subText;
        if (state === 'undiscovered') {
          subText = `Undiscovered &mdash; descend stairs from Floor ${f.floor - 1} to reach`;
        } else if (overleveled) {
          subText = `Recommended Lv ${recLvl} &mdash; you are Lv ${playerLevel}`;
        } else {
          subText = `Recommended Lv ${recLvl} &middot; ${f.description || ''}`;
        }

        return `
          <div class="waystone-floor ${state} ${isClickable ? 'waystone-clickable' : ''}"
               data-floor="${f.floor}"
               data-overleveled="${overleveled ? '1' : '0'}"
               data-rec-lvl="${recLvl}"
               ${!isClickable ? 'aria-disabled="true"' : ''}>
            <span class="waystone-floor-icon">${f.icon}</span>
            <div class="waystone-floor-info">
              <div class="waystone-floor-name"><strong>Floor ${f.floor} &mdash; ${f.name}</strong> ${warnIcon}</div>
              <div class="waystone-floor-req">${subText}</div>
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
          const overleveled = el.dataset.overleveled === '1';
          const recLvl = parseInt(el.dataset.recLvl, 10) || 1;

          // Soft confirmation when traveling significantly above your level.
          // Per WIREFRAMES §9.3 — non-blocking warning, player can proceed.
          if (overleveled) {
            const ok = window.confirm(
              `Floor recommended for Level ${recLvl}.\n` +
              `You are Level ${playerLevel}.\n\n` +
              `Enemies will be much stronger. Travel anyway?`
            );
            if (!ok) return;
          }
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
    // Per WIREFRAMES §9, there is no longer a player-level LOCKED state.
    // States: cleared, in-progress, discovered, undiscovered.
    // Floor is reachable iff the player has descended into it from the
    // previous floor (or it's floor 1, auto-discovered).
    const discovered = persistence.data.dungeon.discoveredFloors || [];
    const isDiscovered = floor.floor === 1 || discovered.includes(floor.floor);

    if (!isDiscovered) return 'undiscovered';

    if (persistence.isFloorCleared(floor.floor)) {
      return 'cleared';
    }

    const floorState = persistence.getFloorState(floor.floor);
    if (floorState && floorState.roomsCleared && floorState.roomsCleared.length > 0) {
      return 'in-progress';
    }
    return 'discovered';
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
        return '<span class="badge-discovered">&#9679; NEW</span>';
      case 'undiscovered':
        return '<span class="badge-locked">&#128274; UNDISCOVERED</span>';
      default:
        return '';
    }
  }
}
