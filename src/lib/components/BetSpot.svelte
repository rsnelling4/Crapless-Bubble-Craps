<script>
  import Chip from './Chip.svelte';
  export let label = "";
  export let subLabel = "";
  export let odds = "";
  export let active = false;
  export let amount = 0;
  export let className = "";
  export let type = "default"; // 'number', 'field', 'come', 'pass', 'prop', 'dice'
  export let dice = []; // Array of numbers [1, 1] etc
  export let dicePosition = "left"; // 'left', 'right', 'top', 'bottom'
  
  export let reverse = false; // Reverse order of dice/label
  export let labelClassName = ""; // Custom label styling

  function getChipValue(amt) {
    if (amt >= 100) return 100;
    if (amt >= 50) return 50;
    if (amt >= 25) return 25;
    if (amt >= 10) return 10;
    if (amt >= 5) return 5;
    if (amt >= 3) return 3;
    if (amt >= 2) return 2;
    return 1;
  }

  const diceDots = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };

  export let diceSize = "w-8 h-8";
  export let status = "on"; // 'on', 'off'
  export let isAutoOff = false;
  export let isLocked = false;
  export let payout = ""; // Special payout display
  export let hardwayCounter = null; // Number of rolls since last hit
  export let id = "";
  export let betType = ""; // Override for chip identifier ('P', 'B')

  $: betTypeDisplay = betType || 
                      (id.startsWith('place_') || id.startsWith('num_') ? 'P' : 
                       id.startsWith('buy_') ? 'B' : '');
</script>

<button
  {id}
  data-bet-id={id}
  on:click
  on:contextmenu
  class="relative flex items-center justify-center border border-white/20 transition-all active:scale-95 group overflow-hidden {className} 
  {type === 'dice' ? (reverse ? 'flex-row-reverse gap-2 px-2' : 'flex-row gap-2 px-2') : 'flex-col'}
  {active ? 'bg-white/10' : 'hover:bg-white/5'}
  {(status === 'off' || isAutoOff) && amount > 0 ? 'grayscale-[0.5]' : ''}"
>
  <slot>
    {#if (status === 'off' || isAutoOff) && amount > 0}
      <div class="absolute inset-0 bg-red-900/10 backdrop-blur-[0.5px] z-[5] pointer-events-none flex items-start justify-end p-0.5">
        <div class="bg-red-600 text-[6px] font-black text-white px-1 rounded-sm border border-white/20 shadow-sm uppercase tracking-tighter">OFF</div>
      </div>
    {/if}

    {#if type === 'dice'}
      <div class="flex gap-1 p-0.5 shrink-0">
        {#each dice as d}
          <div class="{diceSize} bg-white shadow-[0_2px_4px_rgba(0,0,0,0.3)] rounded-[2px] relative">
            {#each diceDots[d] as dot}
              <div class="absolute w-[22%] h-[22%] bg-zinc-900 rounded-full" 
                   style="left: {(dot % 3) * 25 + 14}%; top: {Math.floor(dot / 3) * 25 + 14}%"></div>
            {/each}
          </div>
        {/each}
      </div>
    {/if}

    <div class="flex flex-col items-center justify-center">
      {#if hardwayCounter !== null}
        <div class="flex flex-col items-center gap-1">
          <div class="bg-black/40 px-2 py-0.5 rounded-full border border-white/10 shadow-inner flex flex-col items-center min-w-[44px]">
            <span class="text-[12px] font-black text-white/40 leading-none">#{hardwayCounter}</span>
          </div>
          {#if payout}
            <span class="text-base font-black text-white drop-shadow-md leading-none">{payout.replace(':', ' TO ')}</span>
          {/if}
        </div>
      {:else if payout}
        <span class="text-base font-black text-white drop-shadow-md leading-none">{payout}</span>
      {:else if label}
        <span class="uppercase tracking-tighter leading-none 
          {type === 'number' ? 'text-4xl font-black' : 
           label === 'SEVEN' || label === 'ANY CRAPS' ? 'text-[28px] font-black text-[#ff3b30] drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)] italic' : 
           label === 'COME' || label === 'FIELD' || label === 'PASS LINE' ? 'text-3xl font-black italic' : 
           label === 'BUY' || label === 'PLACE' ? 'text-xl font-medium' :
           label === 'C' || label === 'E' || label === 'C&E' ? 'text-2xl font-medium text-white drop-shadow-md' :
           type === 'dice' ? 'text-[11px] font-black text-white/90' : 'text-[10px] font-black'} {labelClassName}">{label}</span>
      {/if}
      
      {#if subLabel}
        <span class="text-[12px] font-medium text-emerald-400/80 uppercase mt-0.5">{subLabel}</span>
      {/if}

      {#if odds && !payout}
        <span class="text-[9px] font-black text-emerald-400 mt-1">{odds}</span>
      {/if}
    </div>
  </slot>

  {#if amount > 0}
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <div class="relative w-12 h-12 flex items-center justify-center">
        <!-- Multiple chips stacked effect -->
        {#each Array(Math.min(3, Math.ceil(amount / 25))) as _, i}
          <div 
            class="absolute"
                    style="transform: translateY(-{i * 3}px) rotate({i * 10}deg);"
                  >
                    <Chip value={getChipValue(amount)} displayValue={amount} size="w-12 h-12" fontSize="text-[10px]" locked={isLocked && i === Math.min(3, Math.ceil(amount / 25)) - 1} betType={betTypeDisplay} />
                  </div>
        {/each}
      </div>
    </div>
  {/if}
</button>

<style>
  button {
    min-height: 40px;
  }
</style>
