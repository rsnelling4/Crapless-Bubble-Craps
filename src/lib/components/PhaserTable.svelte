<script>
  import { onMount, onDestroy } from 'svelte';
  import Phaser from 'phaser';

  let gameContainer;
  let game;
  let chipGroup;
  let balanceTarget = { x: 0, y: 0 };

  export function triggerWinAnimation(chipPositions) {
    if (!game || !game.scene.scenes[0]) return;
    const scene = game.scene.scenes[0];
    
    chipPositions.forEach(pos => {
      if (!pos) return;
      for (let i = 0; i < 3; i++) {
        const chip = scene.add.circle(pos.x, pos.y, 10, 0x9eff00, 0.8);
        scene.physics.add.existing(chip);
        
        scene.tweens.add({
          targets: chip,
          x: balanceTarget.x,
          y: balanceTarget.y,
          duration: 1500 + Math.random() * 1000,
          ease: 'Cubic.easeOut',
          onComplete: () => chip.destroy()
        });
      }
    });
  }

  export function triggerLossAnimation(chipPositions) {
    if (!game || !game.scene.scenes[0]) return;
    const scene = game.scene.scenes[0];
    
    chipPositions.forEach(pos => {
      if (!pos) return;
      for (let i = 0; i < 3; i++) {
        const chip = scene.add.circle(pos.x, pos.y, 10, 0xff3b30, 0.8);
        scene.physics.add.existing(chip);
        
        scene.tweens.add({
          targets: chip,
          x: pos.x + (Math.random() - 0.5) * 100,
          y: window.innerHeight + 100,
          duration: 800 + Math.random() * 400,
          ease: 'Power2.easeIn',
          onComplete: () => chip.destroy()
        });
      }
    });
  }

  onMount(() => {
    // Find balance target position
    const balanceEl = document.querySelector('.playable-balance');
    if (balanceEl) {
      const rect = balanceEl.getBoundingClientRect();
      balanceTarget = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    } else {
      // Fallback
      balanceTarget = { x: window.innerWidth * 0.8, y: 150 };
    }

    const config = {
      type: Phaser.AUTO,
      parent: gameContainer,
      width: '100%',
      height: '100%',
      transparent: true,
      backgroundColor: 'rgba(0,0,0,0)',
      scene: {
        create: create,
        update: update
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 }
        }
      }
    };

    game = new Phaser.Game(config);

    function create() {
      const scene = this;
      
      // Modern interactive "ripple" effect on click
      scene.input.on('pointerdown', (pointer) => {
        const ripple = scene.add.circle(pointer.x, pointer.y, 2, 0xffffff, 0.3);
        scene.tweens.add({
          targets: ripple,
          radius: 100,
          alpha: 0,
          duration: 1000,
          ease: 'Power2',
          onComplete: () => ripple.destroy()
        });
      });

      // Interactive particle effect for mouse movement (smaller, tighter)
      this.particles = scene.add.particles(0, 0, 'flare', {
        speed: { min: -5, max: 5 },
        scale: { start: 0.05, end: 0 },
        alpha: { start: 0.15, end: 0 },
        blendMode: 'ADD',
        frequency: -1,
        gravityY: 0
      });

      scene.input.on('pointermove', (pointer) => {
        if (Math.random() > 0.5) {
          this.particles.emitParticleAt(pointer.x, pointer.y);
        }
      });
    }

    function update(time, delta) {
      // Empty update
    }

    // Handle resize
    window.addEventListener('resize', () => {
      if (game) {
        game.scale.resize(window.innerWidth, window.innerHeight);
      }
    });
  });

  onDestroy(() => {
    if (game) {
      game.destroy(true);
    }
  });
</script>

<div bind:this={gameContainer} class="absolute inset-0 pointer-events-none z-0"></div>

<style>
  div {
    width: 100%;
    height: 100%;
  }
</style>
