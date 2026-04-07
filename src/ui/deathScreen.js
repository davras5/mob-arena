export class DeathScreen {
  constructor() {
    this.overlay = null;
  }

  show(floorNumber, floorName, goldLost, goldRemaining, roomsCleared, enemiesSlain) {
    return new Promise((resolve) => {
      // Full-screen dark overlay
      const overlay = document.createElement('div');
      Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '9999',
        fontFamily: '"Segoe UI", Arial, sans-serif',
        color: '#ccc',
      });
      this.overlay = overlay;

      // Title — "YOU HAVE FALLEN"
      const title = document.createElement('h1');
      title.textContent = 'YOU HAVE FALLEN';
      Object.assign(title.style, {
        color: '#cc2222',
        fontSize: '48px',
        fontWeight: 'bold',
        letterSpacing: '6px',
        textTransform: 'uppercase',
        margin: '0 0 8px 0',
        textShadow: '0 0 20px rgba(200, 30, 30, 0.6), 0 0 40px rgba(200, 30, 30, 0.3)',
      });
      overlay.appendChild(title);

      // Floor subtitle
      const subtitle = document.createElement('div');
      subtitle.textContent = `Floor ${floorNumber} \u2014 ${floorName}`;
      Object.assign(subtitle.style, {
        fontSize: '20px',
        color: '#999',
        marginBottom: '32px',
        letterSpacing: '2px',
      });
      overlay.appendChild(subtitle);

      // Stats box
      const statsBox = document.createElement('div');
      Object.assign(statsBox.style, {
        background: 'rgba(30, 15, 15, 0.7)',
        border: '1px solid #441111',
        borderRadius: '8px',
        padding: '24px 40px',
        minWidth: '300px',
        marginBottom: '28px',
      });

      const stats = [
        { label: 'Gold lost', value: `${goldLost}g`, color: '#cc4444' },
        { label: 'Gold remaining', value: `${goldRemaining}g`, color: '#ccaa44' },
        { label: 'Rooms cleared this run', value: `${roomsCleared}` },
        { label: 'Enemies slain', value: `${enemiesSlain}` },
      ];

      stats.forEach((stat) => {
        const row = document.createElement('div');
        Object.assign(row.style, {
          display: 'flex',
          justifyContent: 'space-between',
          padding: '6px 0',
          fontSize: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        });

        const label = document.createElement('span');
        label.textContent = stat.label;
        label.style.color = '#aaa';

        const value = document.createElement('span');
        value.textContent = stat.value;
        value.style.color = stat.color || '#ddd';
        value.style.fontWeight = 'bold';

        row.appendChild(label);
        row.appendChild(value);
        statsBox.appendChild(row);
      });

      overlay.appendChild(statsBox);

      // Info messages
      const messages = [
        'Floor progress has been saved.',
        'Items left on the ground are lost.',
      ];

      messages.forEach((text) => {
        const msg = document.createElement('div');
        msg.textContent = text;
        Object.assign(msg.style, {
          fontSize: '14px',
          color: '#777',
          fontStyle: 'italic',
          marginBottom: '4px',
        });
        overlay.appendChild(msg);
      });

      // Spacer before button
      const spacer = document.createElement('div');
      spacer.style.height = '28px';
      overlay.appendChild(spacer);

      // Return to Camp button
      const btn = document.createElement('button');
      btn.textContent = 'Return to Camp';
      Object.assign(btn.style, {
        padding: '14px 48px',
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#eee',
        backgroundColor: '#8b1a1a',
        border: '2px solid #aa3333',
        borderRadius: '6px',
        cursor: 'pointer',
        letterSpacing: '1px',
        transition: 'background-color 0.2s, transform 0.1s',
      });

      btn.addEventListener('mouseenter', () => {
        btn.style.backgroundColor = '#a52a2a';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.backgroundColor = '#8b1a1a';
        btn.style.transform = 'scale(1)';
      });
      btn.addEventListener('mousedown', () => {
        btn.style.transform = 'scale(0.97)';
      });
      btn.addEventListener('mouseup', () => {
        btn.style.transform = 'scale(1)';
      });

      btn.addEventListener('click', () => {
        this.hide();
        resolve();
      });

      overlay.appendChild(btn);

      document.body.appendChild(overlay);
    });
  }

  hide() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
      this.overlay = null;
    }
  }
}
