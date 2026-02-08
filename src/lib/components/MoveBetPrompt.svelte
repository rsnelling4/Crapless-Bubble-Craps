<script>
  import { createEventDispatcher } from 'svelte';
  import { X } from 'lucide-svelte';
  const dispatch = createEventDispatcher();

  export let currentPoint = null;
  export let betToMove = { id: '', amount: 0 };
  
  const points = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];

  function handleMove(targetNumber, type) {
    dispatch('move', { targetNumber, type, amount: betToMove.amount, sourceId: betToMove.id });
  }

  function handleClose() {
    dispatch('close');
  }

  function formatLabel(n) {
    if (n === 6) return 'SIX';
    if (n === 9) return 'NINE';
    return n.toString();
  }
</script>

<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
  <div class="bg-[#2a2a2a] rounded-lg shadow-2xl border border-white/10 max-w-4xl w-full flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-2 border-b border-white/5">
      <span class="text-zinc-300 text-sm font-medium">
        You have chips on the new point... Where do you want to move them?
      </span>
      <button on:click={handleClose} class="text-zinc-500 hover:text-white transition-colors">
        <X size={20} />
      </button>
    </div>

    <!-- Content -->
    <div class="p-2 flex gap-1 overflow-x-auto">
      {#each points as n}
        {@const isCurrent = n === currentPoint}
        <div class="flex-1 min-w-[100px] flex flex-col gap-1 {isCurrent ? 'opacity-40 grayscale pointer-events-none' : ''}">
          <!-- Main Number Button (Place Bet) -->
          <button 
            on:click={() => handleMove(n, 'place')}
            class="flex-1 bg-[#0d3b1e] border border-white/20 rounded-t-md p-4 flex flex-col items-center justify-center hover:bg-[#1a4d2e] transition-colors group"
          >
            <span class="text-4xl font-black text-white drop-shadow-md {n === 6 || n === 9 ? 'rotate-[-15deg]' : ''}">
              {formatLabel(n)}
            </span>
          </button>
          
          <!-- Buy Button -->
          <div class="flex border border-white/20 rounded-b-md overflow-hidden h-10">
            <div class="flex-1 bg-transparent border-r border-white/10"></div>
            <button 
              on:click={() => handleMove(n, 'buy')}
              class="flex-1 bg-[#0d3b1e] hover:bg-[#1a4d2e] transition-colors flex items-center justify-center px-2"
            >
              <span class="text-[10px] font-black text-white tracking-widest uppercase">BUY</span>
            </button>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  /* Custom scrollbar for the point list if it overflows */
  .overflow-x-auto::-webkit-scrollbar {
    height: 4px;
  }
  .overflow-x-auto::-webkit-scrollbar-track {
    background: rgba(0,0,0,0.2);
  }
  .overflow-x-auto::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.1);
    border-radius: 2px;
  }
</style>
