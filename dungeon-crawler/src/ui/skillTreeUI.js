export class SkillTreeUI {
  constructor() {
    this.container = document.getElementById('skill-tree-panel');
    this.onClose = null;
  }

  show(classId, classConfig, skillTreeData, playerSkillTree, skillPoints, onInvest, onRespec) {
    this.container.classList.remove('hidden');
    this.classId = classId;
    this.classConfig = classConfig;
    this.skillTreeData = skillTreeData;
    this.playerSkillTree = playerSkillTree;
    this.skillPoints = skillPoints;
    this.onInvest = onInvest;
    this.onRespec = onRespec;

    this._render();

    return new Promise((resolve) => {
      this.onClose = resolve;
    });
  }

  _render() {
    const branches = this.skillTreeData.branches;
    const color = this.classConfig.color;
    const points = this.skillPoints;

    let html = `
      <div class="skill-tree-header">
        <span class="skill-tree-title" style="color:${color}">${this.classConfig.name} Skill Tree</span>
        <span class="skill-points-display">Skill Points: <strong>${points}</strong></span>
        <button class="skill-tree-respec-btn" id="respec-btn">Respec</button>
        <button class="skill-tree-close-btn" id="skill-tree-close">Close</button>
      </div>
      <div class="skill-tree-branches">
    `;

    for (const branch of branches) {
      html += `<div class="skill-branch">`;
      html += `<div class="branch-name" style="color:${branch.color}">${branch.name}</div>`;

      for (const skill of branch.skills) {
        const currentRank = this.playerSkillTree[skill.id] || 0;
        const isMaxed = currentRank >= skill.maxRanks;
        const pointsInBranch = this._getPointsInBranch(branch);
        const canUnlock = pointsInBranch >= skill.tier - 1 && !isMaxed && this.skillPoints > 0;

        let stateClass = 'locked';
        if (isMaxed) stateClass = 'maxed';
        else if (currentRank > 0) stateClass = 'purchased';
        else if (canUnlock) stateClass = 'available';

        // Rank pips
        let pips = '';
        for (let i = 0; i < skill.maxRanks; i++) {
          pips += `<span class="rank-pip ${i < currentRank ? 'filled' : ''}">${i < currentRank ? '\u25cf' : '\u25cb'}</span>`;
        }

        const typeLabel = skill.type === 'passive' ? 'P' : skill.type === 'augment' ? 'A' : skill.type === 'active' ? 'X' : 'C';

        html += `
          <div class="skill-node ${stateClass}" data-skill-id="${skill.id}" data-branch-id="${branch.id}" style="--branch-color:${branch.color}">
            <div class="skill-node-icon">${skill.icon}</div>
            <div class="skill-node-name">${skill.name}</div>
            <div class="skill-node-type">${typeLabel}</div>
            <div class="skill-node-pips">${pips}</div>
          </div>
        `;
      }

      html += `</div>`;
    }

    html += `</div>`;

    // Detail panel
    html += `<div class="skill-detail-panel" id="skill-detail"></div>`;

    this.container.innerHTML = html;

    // Event handlers
    this.container.querySelector('#skill-tree-close').addEventListener('click', () => this.hide());
    this.container.querySelector('#respec-btn').addEventListener('click', () => {
      if (this.onRespec) {
        this.onRespec();
        this._render(); // Re-render
      }
    });

    // Skill node clicks
    for (const node of this.container.querySelectorAll('.skill-node.available, .skill-node.purchased')) {
      node.addEventListener('click', (e) => {
        const skillId = node.dataset.skillId;
        this._showDetail(skillId, node.dataset.branchId);
      });
      node.addEventListener('touchend', (e) => {
        e.preventDefault();
        const skillId = node.dataset.skillId;
        this._showDetail(skillId, node.dataset.branchId);
      });
    }
  }

  _showDetail(skillId, branchId) {
    const branch = this.skillTreeData.branches.find(b => b.id === branchId);
    const skill = branch.skills.find(s => s.id === skillId);
    const currentRank = this.playerSkillTree[skillId] || 0;
    const nextRank = currentRank + 1;
    const isMaxed = currentRank >= skill.maxRanks;

    const panel = this.container.querySelector('#skill-detail');
    let html = `
      <div class="detail-name">${skill.icon} ${skill.name}</div>
      <div class="detail-desc">${skill.description}</div>
      <div class="detail-rank">Rank: ${currentRank} / ${skill.maxRanks}</div>
    `;

    if (currentRank > 0) {
      html += `<div class="detail-current">Current: ${this._effectText(skill.effects[currentRank - 1])}</div>`;
    }
    if (!isMaxed && skill.effects[nextRank - 1]) {
      html += `<div class="detail-next">Next: ${this._effectText(skill.effects[nextRank - 1])}</div>`;
    }

    const pointsInBranch = this._getPointsInBranch(branch);
    const canInvest = !isMaxed && this.skillPoints > 0 && pointsInBranch >= skill.tier - 1;

    if (canInvest) {
      html += `<button class="invest-btn" id="invest-btn">Invest Point</button>`;
    } else if (isMaxed) {
      html += `<div class="detail-maxed">MAXED</div>`;
    } else if (this.skillPoints <= 0) {
      html += `<div class="detail-locked">No skill points available</div>`;
    } else {
      html += `<div class="detail-locked">Requires ${skill.tier - 1} points in ${branch.name}</div>`;
    }

    panel.innerHTML = html;

    if (canInvest) {
      panel.querySelector('#invest-btn').addEventListener('click', () => {
        if (this.onInvest) {
          this.onInvest(skillId);
          this.skillPoints--;
          this.playerSkillTree[skillId] = (this.playerSkillTree[skillId] || 0) + 1;
          this._render();
        }
      });
    }
  }

  _effectText(effect) {
    if (!effect) return '';
    return Object.entries(effect).map(([k, v]) => {
      // Format stat name
      const name = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      const val = typeof v === 'number' && v < 1 && v > 0 ? `${Math.round(v * 100)}%` : v;
      return `${name}: ${val}`;
    }).join(', ');
  }

  _getPointsInBranch(branch) {
    let total = 0;
    for (const skill of branch.skills) {
      total += this.playerSkillTree[skill.id] || 0;
    }
    return total;
  }

  hide() {
    this.container.classList.add('hidden');
    if (this.onClose) this.onClose();
  }
}
