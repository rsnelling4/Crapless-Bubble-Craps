<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let passlineAmount = 0;
  export let point = null;

  const limits = { 2: 2, 12: 2, 3: 2, 11: 2, 4: 3, 10: 3, 5: 4, 9: 4, 6: 5, 8: 5 };
  $: maxMultiplier = limits[point] || 3;
  $: multipliers = Array.from({ length: maxMultiplier }, (_, i) => i + 1);

  function handleSelect(multiplier) {
    dispatch('select', multiplier);
  }
</script>

<div class="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
  <div class="bg-[#2a2a2a] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] border border-white/10 p-8 max-w-lg w-full flex flex-col items-center gap-8">
    <h2 class="text-white text-xl font-medium text-center leading-tight">
      What odds do you want to take on a bet "Pass line odds"?
    </h2>

    <div class="flex flex-wrap items-center justify-center gap-4">
      {#each multipliers as m}
        <button 
          on:click={() => handleSelect(m)}
          class="w-16 h-16 rounded-full bg-[#e5e7eb] border-2 border-zinc-400 shadow-[0_4px_8px_rgba(0,0,0,0.4),inset_0_2px_4px_white] flex items-center justify-center transition-transform active:scale-95"
        >
          <span class="text-zinc-800 font-black text-xl">{m}x</span>
        </button>
      {/each}

      <button 
        on:click={() => handleSelect(0)}
        class="w-16 h-16 rounded-full bg-[#e5e7eb] border-2 border-zinc-400 shadow-[0_4px_8px_rgba(0,0,0,0.4),inset_0_2px_4px_white] flex items-center justify-center transition-transform active:scale-95"
      >
        <span class="text-zinc-800 font-black text-[10px] leading-tight text-center uppercase">NO ODDS</span>
      </button>
    </div>

    {#if passlineAmount > 0}
      <div class="text-white/40 text-[10px] uppercase tracking-widest font-bold">
        Point: {point} | Line Bet: ${passlineAmount}
      </div>
    {/if}
  </div>
</div>
