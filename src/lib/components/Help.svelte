<script>
  import { createEventDispatcher } from 'svelte';
  import { X, HelpCircle, Info, DollarSign, Zap } from 'lucide-svelte';

  const dispatch = createEventDispatcher();

  const rules = [
    {
      title: "The Game",
      content: "Crapless Bubble Craps is a variation where 2, 3, 11, and 12 are point numbers instead of immediate losers (craps) or winners (naturals) on the come-out roll."
    },
    {
      title: "Come Out Roll",
      content: "The first roll of a round. 7 is an immediate win for the Pass Line. Any other number becomes the 'Point'."
    },
    {
      title: "Point Phase",
      content: "Once a point is established, you want to roll that number again before rolling a 7. If you roll the point, you win. If you roll a 7, you lose (Seven Out)."
    }
  ];

  const payouts = [
    { bet: "Pass Line", payout: "1 to 1", description: "Win on 7 (come out) or hitting the point." },
    { bet: "Place Bets (6, 8)", payout: "7 to 6", description: "Bet on specific numbers to roll before a 7." },
    { bet: "Place Bets (5, 9)", payout: "7 to 5", description: "Bet on specific numbers to roll before a 7." },
    { bet: "Place Bets (4, 10)", payout: "9 to 5", description: "Bet on specific numbers to roll before a 7." },
    { bet: "Place Bets (2, 3, 11, 12)", payout: "11 to 2 / 3 to 1", description: "Extreme outside numbers in Crapless Craps." },
    { bet: "Hardways", payout: "7 to 1 / 9 to 1", description: "Rolling a number as a pair (e.g., 2-2 for Hard 4)." },
    { bet: "Any 7", payout: "4 to 1", description: "The next roll will be a 7." }
  ];
</script>

<div class="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-300 px-4">
  <div class="w-full max-w-2xl bg-[#0a2e0a] rounded-3xl border-2 border-emerald-400/30 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh] overflow-hidden">
    <!-- Header -->
    <div class="p-6 border-b border-white/10 flex items-center justify-between bg-black/20 shrink-0">
      <div class="flex items-center gap-3">
        <div class="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
          <HelpCircle size={24} />
        </div>
        <div>
          <h2 class="text-2xl font-black text-white tracking-tighter uppercase italic leading-none">How to <span class="text-emerald-400">Play</span></h2>
          <p class="text-[10px] font-medium text-zinc-500 uppercase tracking-widest mt-1">Rules & Payouts Guide</p>
        </div>
      </div>
      <button 
        on:click={() => dispatch('close')}
        class="p-2 rounded-xl bg-black/40 border border-white/10 text-zinc-400 hover:text-white transition-all hover:scale-110"
      >
        <X size={20} />
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
      <!-- Quick Rules -->
      <section>
        <div class="flex items-center gap-2 mb-4">
          <Info size={16} class="text-emerald-400" />
          <h3 class="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">Game Rules</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          {#each rules as rule}
            <div class="p-4 rounded-2xl bg-black/40 border border-white/5 shadow-inner">
              <h4 class="text-xs font-black text-emerald-400 uppercase mb-2 tracking-tight">{rule.title}</h4>
              <p class="text-[11px] text-zinc-400 leading-relaxed font-medium uppercase">{rule.content}</p>
            </div>
          {/each}
        </div>
      </section>

      <!-- Payouts Table -->
      <section>
        <div class="flex items-center gap-2 mb-4">
          <DollarSign size={16} class="text-emerald-400" />
          <h3 class="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">Payout Guide</h3>
        </div>
        <div class="rounded-2xl border border-white/5 overflow-hidden bg-black/40 shadow-inner">
          <table class="w-full text-left">
            <thead>
              <tr class="bg-black/60 border-b border-white/10">
                <th class="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase">Bet Type</th>
                <th class="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase">Payout</th>
                <th class="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase">Description</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              {#each payouts as item}
                <tr class="hover:bg-white/[0.02] transition-colors">
                  <td class="px-4 py-3 text-xs font-black text-white uppercase">{item.bet}</td>
                  <td class="px-4 py-3 text-xs font-black text-emerald-400 tabular-nums">{item.payout}</td>
                  <td class="px-4 py-3 text-[10px] font-medium text-zinc-500 uppercase leading-tight">{item.description}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <!-- Tips -->
      <section class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
        <div class="flex items-start gap-3">
          <div class="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
            <Zap size={16} />
          </div>
          <div>
            <h4 class="text-xs font-black text-emerald-400 uppercase tracking-tight mb-1">Pro Tip</h4>
            <p class="text-[10px] font-medium text-zinc-400 uppercase leading-relaxed">
              Use "Odds" bets behind your Pass Line. They pay true mathematical odds with zero house edge, making them the best bets in the casino!
            </p>
          </div>
        </div>
      </section>
    </div>

    <!-- Footer -->
    <div class="p-6 border-t border-white/10 bg-black/20 flex justify-center shrink-0">
      <button 
        on:click={() => dispatch('close')}
        class="px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
      >
        Got it!
      </button>
    </div>
  </div>
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>