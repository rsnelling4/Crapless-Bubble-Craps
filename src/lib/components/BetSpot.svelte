<script>
    import { createEventDispatcher } from 'svelte';
    import Chip from './Chip.svelte';
    const dispatch = createEventDispatcher();

    export let label = "";
    export let subLabel = "";
    export let odds = "";
    export let amount = 0;
    export let className = "";
    export let isActive = false;
    export let color = "green";
    export let glow = false;
    export let isLocked = false;
    export let labelClassName = "";

    // New props for hardways and dice bets
    export let id = "";
    export let type = ""; // "dice" or empty
    export let dice = []; // [n1, n2]
    export let payout = "";
    export let hardwayCounter = null;
    export let reverse = false;
    export let status = null;
    // export let isAutoOff = false; // Removed per user request

    const diceDots = {
        1: [4],
        2: [0, 8],
        3: [0, 4, 8],
        4: [0, 2, 6, 8],
        5: [0, 2, 4, 6, 8],
        6: [0, 2, 3, 5, 6, 8]
    };

    const colorClasses = {
        green: isActive ? 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-500/20',
        zinc: 'bg-zinc-900/60 hover:bg-zinc-800/80 border-white/10 backdrop-blur-md',
        blue: 'bg-blue-950/40 hover:bg-blue-900/60 border-blue-500/20',
        red: 'bg-red-950/40 hover:bg-red-900/60 border-red-500/20',
        gold: 'bg-amber-950/40 hover:bg-amber-900/60 border-amber-500/20',
    };

    function getChips(val) {
        const chips = [];
        let remaining = val;
        const values = [100, 50, 25, 10, 5, 3, 2, 1];
        for (const v of values) {
            const count = Math.floor(remaining / v);
            for (let i = 0; i < count; i++) {
                chips.push(v);
                remaining -= v;
                if (chips.length >= 6) break;
            }
            if (chips.length >= 6) break;
        }
        return chips;
    }

    $: chips = amount > 0 ? getChips(amount) : [];
</script>

<button
    on:click={(e) => dispatch('click', e)}
    on:contextmenu|preventDefault={(e) => dispatch('contextmenu', e)}
    data-bet-id={id}
    class="relative flex flex-col items-center justify-center border transition-all active:scale-95 overflow-hidden {colorClasses[color]} {glow ? 'animate-pulse' : ''} {className}"
>
    <div class="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
    
    <slot name="top" />

    {#if type === 'dice'}
        <div class="flex {reverse ? 'flex-row-reverse' : 'flex-row'} items-center gap-2 w-full px-2">
            <!-- Dice Pair -->
            <div class="flex gap-1">
                {#each dice as d}
                    <div class="w-6 h-6 bg-white rounded-[4px] relative shadow-[0_1px_2px_rgba(0,0,0,0.3)] flex-shrink-0">
                        {#each diceDots[d] || [] as dot}
                            <div class="absolute w-[18%] h-[18%] bg-zinc-900 rounded-full" 
                                 style="left: {(dot % 3) * 25 + 16}%; top: {Math.floor(dot / 3) * 25 + 16}%"></div>
                        {/each}
                    </div>
                {/each}
            </div>

            <!-- Labels and Payout -->
            <div class="flex-1 flex flex-col {reverse ? 'items-end' : 'items-start'} leading-none">
                {#if payout}
                    <span class="text-[10px] font-black text-white drop-shadow-md mb-0.5 italic">{payout}</span>
                {/if}
                <div class="flex items-baseline gap-1">
                    {#if label}
                        <span class="text-sm font-black text-white italic leading-none uppercase drop-shadow-sm">{label}</span>
                    {:else}
                        <span class="text-[10px] font-bold text-white/60 uppercase tracking-tighter drop-shadow-sm">{dice[0] === dice[1] ? 'Hard' : ''}</span>
                        <span class="text-xl font-black text-white italic leading-none drop-shadow-md">{dice[0] + dice[1]}</span>
                    {/if}
                </div>
            </div>

            <!-- Hardway Counter -->
            {#if hardwayCounter !== null}
                <div class="flex flex-col items-center justify-center bg-black/50 rounded-lg px-2 py-1 border border-white/10 min-w-[32px] shadow-lg">
                    <span class="text-[8px] font-bold text-white/50 uppercase leading-none mb-0.5 tracking-tighter">Rolls</span>
                    <span class="text-sm font-black {hardwayCounter > 15 ? 'text-red-400' : 'text-emerald-400'} leading-none drop-shadow-sm">{hardwayCounter}</span>
                </div>
            {/if}
        </div>
    {:else}
        {#if subLabel}
            <span class="text-[10px] font-bold uppercase tracking-widest opacity-60 leading-none mb-1 pointer-events-none">{subLabel}</span>
        {/if}
        
        {#if label}
            <span class="font-black leading-none pointer-events-none tracking-tight {labelClassName || 'text-xl'}">{label}</span>
        {/if}
        
        <slot />

        {#if odds}
            <span class="text-[9px] font-black mt-1 opacity-30 pointer-events-none">{odds}</span>
        {/if}
    {/if}
    
    <slot name="bottom" />
    
    {#if amount > 0}
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div class="relative w-12 h-12 flex items-center justify-center">
                {#each chips as chipVal, i}
                    <div
                        class="absolute"
                        style="
                            z-index: {i};
                            transform: translateY(-{i * 3}px);
                        "
                    >
                        <Chip 
                            value={chipVal} 
                            size="w-9 h-9" 
                            fontSize="text-[8px]" 
                            locked={isLocked && i === chips.length - 1}
                        />

                        {#if i === chips.length - 1}
                            <div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-zinc-900 px-1.5 py-0.5 rounded text-[8px] border border-white/20 whitespace-nowrap shadow-xl">
                                ${amount}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    {/if}

    {#if status === 'win'}
        <div class="absolute inset-0 bg-emerald-500/20 animate-pulse pointer-events-none border-2 border-emerald-400"></div>
    {:else if status === 'lose'}
        <div class="absolute inset-0 bg-red-500/20 animate-pulse pointer-events-none border-2 border-red-400"></div>
    {/if}
</button>
