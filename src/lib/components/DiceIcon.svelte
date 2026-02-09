<script>
  export let value = 1;
  export let size = "w-6 h-6";

  const dotPositions = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };

  $: dots = dotPositions[value] || [];
</script>

<div class="{size} bg-white rounded-[4px] grid grid-cols-3 grid-rows-3 p-[3px] gap-[1px] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.2),0_1px_2px_rgba(0,0,0,0.3)] border border-black/5">
  {#each Array(9) as _, i}
    <div class="flex items-center justify-center">
      {#if dots.includes(i)}
        <div class="w-[85%] h-[85%] bg-[#1a1a1a] rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"></div>
      {/if}
    </div>
  {/each}
</div>
