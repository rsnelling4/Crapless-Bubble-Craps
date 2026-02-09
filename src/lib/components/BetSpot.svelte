<script>
    export let label = "";
    export let subLabel = "";
    export let odds = "";
    export let amount = 0;
    export let onClick = () => {};
    export let onRightClick = () => {};
    export let className = "";
    export let isActive = false;
    export let color = "green";

    export let glow = false;

    const colorClasses = {
        green: isActive ? 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-500/20',
        zinc: 'bg-zinc-900/60 hover:bg-zinc-800/80 border-white/10 backdrop-blur-md',
        blue: 'bg-blue-950/40 hover:bg-blue-900/60 border-blue-500/20',
        red: 'bg-red-950/40 hover:bg-red-900/60 border-red-500/20',
        gold: 'bg-amber-950/40 hover:bg-amber-900/60 border-amber-500/20',
    };

    const CHIP_COLORS = {
        1: 'bg-white text-zinc-900 border-zinc-300',
        5: 'bg-red-600 text-white border-red-400',
        25: 'bg-blue-600 text-white border-blue-400',
        100: 'bg-zinc-900 text-white border-zinc-600',
        500: 'bg-purple-600 text-white border-purple-400'
    };

    // Calculate chip stack
    function getChips(val) {
        const chips = [];
        let remaining = val;
        const values = [500, 100, 25, 5, 1];
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
    on:click={onClick}
    on:contextmenu|preventDefault={onRightClick}
    class="relative flex flex-col items-center justify-center border transition-all active:scale-95 overflow-hidden {className} {colorClasses[color]} {glow ? 'animate-pulse' : ''}"
>
    <div class="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
    
    <slot name="top" />

    {#if subLabel}
        <span class="text-[10px] font-bold uppercase tracking-widest opacity-40 leading-none mb-1 pointer-events-none">{subLabel}</span>
    {/if}
    
    {#if label}
        <span class="text-xl font-black leading-none pointer-events-none tracking-tight">{label}</span>
    {/if}
    
    <slot />

    {#if odds}
        <span class="text-[9px] font-black mt-1 opacity-30 pointer-events-none">{odds}</span>
    {/if}
    
    <slot name="bottom" />
    
    {#if amount > 0}
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div class="relative w-12 h-12 flex items-center justify-center">
                {#each chips as chipVal, i}
                    <div
                        class="absolute w-9 h-9 rounded-full border-2 border-dashed flex items-center justify-center shadow-[0_2px_4px_rgba(0,0,0,0.5)] text-[9px] font-black {CHIP_COLORS[chipVal]}"
                        style="
                            z-index: {i};
                            transform: translateY(-{i * 3}px) rotate({i * 15}deg);
                        "
                    >
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
</button>
