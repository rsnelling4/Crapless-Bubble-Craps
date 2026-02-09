<script>
  import { createEventDispatcher } from 'svelte';
  import { Trophy, X, User, DollarSign, TrendingUp, TrendingDown, RotateCcw } from 'lucide-svelte';

  const dispatch = createEventDispatcher();

  export let users = []; // Array of { username, nickname, highestBalance, largestWin, largestLoss, resetCount }

  // Sort users by highestBalance by default
  $: sortedUsers = [...users]
    .filter(u => u.username !== 'Guest')
    .sort((a, b) => (b.highestBalance || 0) - (a.highestBalance || 0))
    .slice(0, 10);
</script>

<div class="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
  <div class="w-full max-w-4xl p-8 bg-[#1a4d2e] rounded-3xl border-2 border-emerald-400/30 shadow-[0_0_50px_rgba(0,0,0,0.8),inset_0_0_30px_rgba(0,0,0,0.4)] relative overflow-hidden group">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8 relative z-10">
      <div class="flex items-center gap-4">
        <div class="p-3 rounded-2xl bg-yellow-500/20 border border-yellow-500/30 text-yellow-500 shadow-lg">
          <Trophy size={32} />
        </div>
        <div>
          <h2 class="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">Global <span class="text-emerald-400">Leaderboard</span></h2>
          <p class="text-zinc-400 text-sm font-medium mt-1 uppercase tracking-widest">Top Performers (No Guests)</p>
        </div>
      </div>
      <button 
        on:click={() => dispatch('close')}
        class="p-2 rounded-xl bg-black/40 border border-white/10 text-zinc-400 hover:text-white transition-all hover:scale-110"
      >
        <X size={24} />
      </button>
    </div>

    <!-- Table -->
    <div class="relative z-10 overflow-hidden rounded-2xl border border-white/5 bg-black/40 shadow-inner">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-black/60 border-b border-white/10">
            <th class="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Rank</th>
            <th class="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Player</th>
            <th class="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Highest Balance</th>
            <th class="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Largest Win</th>
            <th class="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Largest Loss</th>
            <th class="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Resets</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          {#each sortedUsers as user, i}
            <tr class="hover:bg-white/[0.02] transition-colors {i === 0 ? 'bg-yellow-500/5' : ''}">
              <td class="px-6 py-4">
                <div class="flex items-center justify-center w-8 h-8 rounded-lg font-black italic 
                  {i === 0 ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 
                   i === 1 ? 'bg-zinc-300 text-black shadow-[0_0_15px_rgba(212,212,216,0.3)]' : 
                   i === 2 ? 'bg-orange-400 text-black shadow-[0_0_15px_rgba(251,146,60,0.3)]' : 
                   'bg-white/5 text-zinc-400'}">
                  {i + 1}
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <User size={16} />
                  </div>
                  <span class="font-black text-white uppercase tracking-tight italic">
                    {user.nickname || user.username}
                  </span>
                </div>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-1 font-black text-emerald-400 tabular-nums">
                  <DollarSign size={14} />
                  {(user.highestBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-1 font-black text-yellow-400 tabular-nums">
                  <TrendingUp size={14} />
                  {(user.largestWin || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-1 font-black text-red-400 tabular-nums">
                  <TrendingDown size={14} />
                  {(user.largestLoss || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-1 font-black text-zinc-500 tabular-nums">
                  <RotateCcw size={12} />
                  {user.resetCount || 0}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

      {#if sortedUsers.length === 0}
        <div class="py-20 flex flex-col items-center justify-center text-zinc-500">
          <Trophy size={48} class="opacity-10 mb-4" />
          <p class="font-black uppercase tracking-widest text-sm italic">No ranking players yet</p>
        </div>
      {/if}
    </div>

    <!-- Background Decoration -->
    <div class="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
  </div>
</div>
