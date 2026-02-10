<script>
  import { createEventDispatcher } from 'svelte';
  import { User, Lock, Smile, Play, LogIn, UserPlus } from 'lucide-svelte';

  const dispatch = createEventDispatcher();

  export let errorMessage = '';
  let mode = 'login'; // 'login', 'signup', 'guest'
  let username = '';
  let password = '';
  let nickname = '';
  let error = '';
  let loading = false;

  $: if (errorMessage) {
    error = errorMessage;
    loading = false;
  }

  function handleAuth() {
    error = '';
    console.log('handleAuth triggered', { mode, username, password, nickname });
    if (mode === 'signup') {
      if (!username || !password || !nickname) {
        error = 'All fields are required for signup';
        return;
      }
      loading = true;
      dispatch('signup', { username, password, nickname });
    } else if (mode === 'login') {
      if (!username || !password) {
        error = 'Username and password are required';
        return;
      }
      console.log('Dispatching login event', { username, password });
      loading = true;
      dispatch('login', { username, password });
    }
  }

  // Clear loading if error changes (likely from parent alert or internal)
  $: if (error) loading = false;

  function handleGuest() {
    console.log('handleGuest triggered');
    dispatch('guest');
  }
</script>

<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl">
  <div class="w-full max-w-md p-8 bg-[#1a4d2e] rounded-3xl border-2 border-emerald-400/30 shadow-[0_0_50px_rgba(0,0,0,0.8),inset_0_0_30px_rgba(0,0,0,0.4)] relative overflow-hidden group">
    <!-- Background Glow -->
    <div class="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-colors duration-700"></div>
    <div class="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-colors duration-700"></div>

    <!-- Header -->
    <div class="text-center mb-8 relative z-10">
      <div class="inline-flex gap-2 p-4 rounded-2xl bg-black/40 border border-white/10 mb-4 shadow-inner">
        <img src="https://img.icons8.com/color/96/dice.png" alt="logo" class="w-16 h-16 drop-shadow-lg" />
        <img src="https://img.icons8.com/color/96/dice.png" alt="logo" class="w-16 h-16 drop-shadow-lg" />
      </div>
      <h1 class="text-3xl font-black text-white tracking-tighter uppercase italic">
        Bobby's Bubble <span class="text-emerald-400">Craps</span>
      </h1>
      <p class="text-zinc-400 text-sm font-medium mt-1">Authentic Casino Craps Experience</p>
    </div>

    <!-- Auth Form -->
    <form on:submit|preventDefault={handleAuth} class="space-y-4 relative z-10">
      {#if mode !== 'guest'}
        <div class="space-y-4">
          <!-- Username -->
          <div class="relative">
            <User class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              bind:value={username}
              placeholder="Username"
              disabled={loading}
              class="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-colors shadow-inner disabled:opacity-50"
            />
            <p class="text-[9px] text-zinc-500 mt-1 ml-2 uppercase font-bold tracking-tighter">Note: Usernames are case insensitive</p>
          </div>

          <!-- Password -->
          <div class="relative">
            <Lock class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="password"
              bind:value={password}
              placeholder="Password"
              disabled={loading}
              class="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-colors shadow-inner disabled:opacity-50"
            />
          </div>

          {#if mode === 'signup'}
            <!-- Nickname -->
            <div class="relative animate-in fade-in slide-in-from-top-2 duration-300">
              <Smile class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                type="text"
                bind:value={nickname}
                placeholder="Display Nickname"
                disabled={loading}
                class="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-colors shadow-inner disabled:opacity-50"
              />
            </div>
          {/if}
        </div>

        {#if error}
          <p class="text-red-400 text-xs font-bold text-center animate-pulse">{error}</p>
        {/if}

        <!-- Action Button -->
        <button
          type="submit"
          disabled={loading}
          class="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if loading}
            <div class="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
            Processing...
          {:else}
            {#if mode === 'login'}
              <LogIn size={20} /> Sign In
            {:else}
              <UserPlus size={20} /> Create Account
            {/if}
          {/if}
        </button>

        <!-- Toggle Mode -->
        <div class="flex items-center justify-between px-2">
          <button
            type="button"
            on:click={() => { 
              mode = mode === 'login' ? 'signup' : 'login'; 
              error = ''; 
              dispatch('toggleMode');
            }}
            disabled={loading}
            class="text-xs font-black text-zinc-400 hover:text-white uppercase tracking-tighter transition-colors disabled:opacity-50"
          >
            {mode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </button>
          <button
            type="button"
            on:click={() => mode = 'guest'}
            disabled={loading}
            class="text-xs font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-tighter transition-colors disabled:opacity-50"
          >
            Play as Guest
          </button>
        </div>
      {:else}
        <!-- Guest Mode Confirmation -->
        <div class="text-center py-4 space-y-6 animate-in zoom-in-95 duration-300">
          <p class="text-zinc-300 text-sm font-medium px-4">
            Guest progress is <span class="text-red-400">not saved</span>. Create an account to track your bankroll and shooter stats across sessions!
          </p>
          <button
            type="button"
            on:click={handleGuest}
            class="w-full py-4 bg-white hover:bg-zinc-200 text-black font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Play size={20} fill="currentColor" /> Start Guest Session
          </button>
          <button
            type="button"
            on:click={() => mode = 'login'}
            class="text-xs font-black text-zinc-400 hover:text-white uppercase tracking-tighter transition-colors"
          >
            Go Back to Login
          </button>
        </div>
      {/if}
    </form>
  </div>
</div>

<style>
  /* Custom Lucide icon coloring if needed */
  :global(.lucide) {
    stroke-width: 2.5px;
  }
</style>
