<script>
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import { createGame3D } from '../game/DiceGame3D';

    const dispatch = createEventDispatcher();
    let gameInstance;

    onMount(() => {
        gameInstance = createGame3D('dice-container', (d1, d2) => {
            dispatch('result', { d1, d2 });
        });
    });

    onDestroy(() => {
        if (gameInstance) {
            gameInstance.destroy();
        }
    });

    export function roll() {
        if (gameInstance) {
            gameInstance.roll();
        }
    }
</script>

<div class="relative flex flex-col items-center justify-center p-2">
  <!-- The Bubble Container -->
  <div class="relative w-[180px] h-[150px]">
    <!-- Bottom Base Shadow -->
    <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[140px] h-[10px] bg-black/40 rounded-full blur-md pointer-events-none"></div>

    <!-- 3D Game Instance -->
    <div 
      id="dice-container" 
      class="w-full h-full relative z-10"
    ></div>
  </div>
  
  <!-- Status Text -->
  <div class="mt-2 text-center">
    <p class="text-white/10 text-[6px] uppercase tracking-[0.2em] font-black italic">Bubble System</p>
  </div>
</div>
