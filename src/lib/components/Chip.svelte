<script>
  export let value = 1;
  export let displayValue = null;
  export let selected = false;
  export let size = "w-12 h-12";
  export let fontSize = "text-[10px]";
  export let locked = false;
  export let betType = ""; // 'P' for Place, 'B' for Buy

  const chipColors = {
    1: { border: 'border-zinc-300', accent: 'bg-zinc-400' },
    2: { border: 'border-blue-500', accent: 'bg-blue-600' },
    3: { border: 'border-amber-300', accent: 'bg-amber-400' },
    5: { border: 'border-red-500', accent: 'bg-red-600' },
    10: { border: 'border-orange-400', accent: 'bg-orange-500' },
    25: { border: 'border-emerald-400', accent: 'bg-emerald-500' },
    50: { border: 'border-blue-400', accent: 'bg-blue-500' },
    100: { border: 'border-zinc-800', accent: 'bg-zinc-900' }
  };

  $: config = chipColors[value] || chipColors[1];
</script>

<style>
  @keyframes eclipse-spin-breath {
    0% { transform: rotate(0deg) scale(0.8); opacity: 0.4; }
    50% { transform: rotate(180deg) scale(1.1); opacity: 0.9; }
    100% { transform: rotate(360deg) scale(0.8); opacity: 0.4; }
  }
  .animate-eclipse-rays {
    animation: eclipse-spin-breath 5s linear infinite;
  }
</style>

<div 
  class="relative {size} rounded-full flex items-center justify-center transition-all duration-300
         {selected ? 'scale-110 -translate-y-2' : ''}"
>
  <!-- Outer Glow (Selected Only) -->
  {#if selected}
    <!-- Base soft glow -->
    <div class="absolute inset-[-8px] rounded-full bg-[#9eff00]/60 blur-md animate-pulse z-0"></div>
    
    <!-- Breathing Rays (Eclipse Effect) -->
    <div class="absolute inset-[-25px] rounded-full z-0 pointer-events-none">
      <div class="absolute inset-0 animate-eclipse-rays"
           style="background: repeating-conic-gradient(from 0deg, #9eff00 0deg 1deg, transparent 1deg 6deg);
                  mask-image: radial-gradient(circle, black 30%, transparent 75%);
                  -webkit-mask-image: radial-gradient(circle, black 30%, transparent 75%);"></div>
    </div>

    <!-- Secondary outer blur -->
    <div class="absolute inset-[-15px] rounded-full bg-[#9eff00]/30 blur-2xl z-0"></div>
  {/if}

  <!-- Chip Base -->
  <div class="absolute inset-0 rounded-full bg-white shadow-xl overflow-hidden border-2 {config.border} z-10">
    <!-- Texture/Stripes in center -->
    <div class="absolute inset-0 opacity-10 pointer-events-none" 
         style="background: repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px);"></div>
    
    <!-- Accent Tabs (Outer Ring) -->
    <div class="absolute inset-0 rounded-full border-[6px] border-transparent">
      {#each Array(6) as _, i}
        <div 
          class="absolute top-1/2 left-1/2 w-full h-[8px] {config.accent} -translate-x-1/2 -translate-y-1/2"
          style="transform: translate(-50%, -50%) rotate({i * 60}deg); clip-path: polygon(0 15%, 15% 0, 15% 100%, 0 85%);"
        ></div>
      {/each}
    </div>

    <!-- Inner Circle -->
    <div class="absolute inset-[6px] rounded-full bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] border border-black/5 flex flex-col items-center justify-center">
      {#if betType}
        <span class="text-[9px] font-black text-zinc-500 uppercase leading-none -mb-0.5">{betType}</span>
      {/if}
      <span class="{fontSize} font-black text-zinc-800 drop-shadow-sm tracking-tighter leading-none">${displayValue !== null ? displayValue : value}</span>
    </div>

    <!-- Shine effect -->
    <div class="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/30 to-white/10 pointer-events-none"></div>
  </div>

  <!-- Locked Indicator (Outside overflow-hidden) -->
  {#if locked}
    <div class="absolute inset-0 flex items-center justify-center z-[100]">
      <!-- Enhanced Green Glow Effect -->
      <div class="absolute w-6 h-6 rounded-full bg-[#9eff00]/80 blur-[6px] animate-pulse"></div>
      
      <!-- Lock Body (White/Silver like image) -->
      <div class="relative w-5 h-5 bg-white rounded-md border border-zinc-400 flex items-center justify-center shadow-[0_4px_8px_rgba(0,0,0,0.5),inset_0_1px_1px_white]">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-3 h-3 text-zinc-800">
          <path fill-rule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clip-rule="evenodd" />
        </svg>
      </div>
    </div>
  {/if}
</div>
