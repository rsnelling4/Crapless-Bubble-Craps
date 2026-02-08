<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let amount = 0;
  export let betType = 'Buy'; // 'Buy' or 'Lay'
  export let commission = 0;

  function handleConfirm() {
    dispatch('confirm');
  }

  function handleDecline() {
    dispatch('decline');
  }
</script>

<div class="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
  <div class="bg-[#2a2a2a] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] border border-white/10 p-8 max-w-md w-full flex flex-col items-center gap-8">
    <div class="flex flex-col items-center gap-2">
      <h2 class="text-white text-xl font-medium text-center leading-tight">
        Confirm {betType} Bet Commission
      </h2>
      <p class="text-zinc-400 text-sm text-center">
        A 5% commission of <span class="text-emerald-400 font-bold">${commission.toFixed(2)}</span> is required for this ${amount} {betType} bet.
      </p>
    </div>

    <div class="flex items-center justify-center gap-6 w-full">
      <button 
        on:click={handleConfirm}
        class="flex-1 h-16 rounded-lg bg-emerald-500 hover:bg-emerald-400 border-2 border-emerald-600 shadow-lg flex items-center justify-center transition-all active:scale-95 group"
      >
        <span class="text-white font-black text-xl uppercase tracking-widest">YES</span>
      </button>

      <button 
        on:click={handleDecline}
        class="flex-1 h-16 rounded-lg bg-red-500 hover:bg-red-400 border-2 border-red-600 shadow-lg flex items-center justify-center transition-all active:scale-95 group"
      >
        <span class="text-white font-black text-xl uppercase tracking-widest">NO</span>
      </button>
    </div>

    <div class="text-white/40 text-[10px] uppercase tracking-widest font-bold text-center">
      COMMISSION IS DEDUCTED UPON CONFIRMATION
    </div>
  </div>
</div>
