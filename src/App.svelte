<script>
  import { onMount } from 'svelte';
  import { Settings, RotateCcw, Info, History } from 'lucide-svelte';
  import BetSpot from './lib/components/BetSpot.svelte';
  import PhaserTable from './lib/components/PhaserTable.svelte';
  import Chip from './lib/components/Chip.svelte';
  import OddsPrompt from './lib/components/OddsPrompt.svelte';
  import MoveBetPrompt from './lib/components/MoveBetPrompt.svelte';
  import CommissionPrompt from './lib/components/CommissionPrompt.svelte';
  import DiceBubble from './lib/components/DiceBubble.svelte';

  // --- Audio ---
  const audioContext = typeof window !== 'undefined' ? new (window.AudioContext || window.webkitAudioContext)() : null;
  let chipSoundBuffer = null;

  async function loadChipSound() {
    if (!audioContext) return;
    try {
      // Use relative path with BASE_URL for GitHub Pages compatibility
      const baseUrl = import.meta.env.BASE_URL || '/';
      const soundUrl = `${baseUrl}poker_chip.mp3`.replace(/\/+/g, '/');
      
      const response = await fetch(soundUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Modern promise-based decodeAudioData
      try {
        chipSoundBuffer = await audioContext.decodeAudioData(arrayBuffer);
      } catch (decodeError) {
        // Fallback for older browsers
        chipSoundBuffer = await new Promise((resolve, reject) => {
          audioContext.decodeAudioData(arrayBuffer, resolve, reject);
        });
      }
    } catch (e) {
      console.error('Failed to load chip sound:', e.message || e);
    }
  }

  onMount(() => {
    loadChipSound();
  });
  
  function playChipSound(type = 'place') {
    if (!audioContext) return;

    // Use downloaded sound for select/place/remove/win/loss
    if (chipSoundBuffer) {
      const source = audioContext.createBufferSource();
      source.buffer = chipSoundBuffer;
      const gainNode = audioContext.createGain();
      
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Slightly vary pitch for more natural feel
      source.playbackRate.value = 0.9 + Math.random() * 0.2;
      
      // Adjust volume based on type
      if (type === 'select') {
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      } else if (type === 'win') {
        gainNode.gain.setValueAtTime(0.7, audioContext.currentTime);
        // Play multiple sounds for win
        const source2 = audioContext.createBufferSource();
        source2.buffer = chipSoundBuffer;
        source2.playbackRate.value = 1.1 + Math.random() * 0.2;
        source2.connect(gainNode);
        source2.start(audioContext.currentTime + 0.1);
      } else if (type === 'loss') {
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        source.playbackRate.value = 0.7 + Math.random() * 0.1; // Lower pitch for loss
      } else {
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
      }

      source.start(0);
      return;
    }
    
    // Fallback to synthesized sounds for win/loss (or if buffer not loaded)
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    const now = audioContext.currentTime;
    
    if (type === 'win') {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, now);
      oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.2, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      oscillator.start(now);
      oscillator.stop(now + 0.3);
    } else if (type === 'loss') {
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(200, now);
      oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.2);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      oscillator.start(now);
      oscillator.stop(now + 0.2);
    } else {
      // place/remove - clicky sound
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(1500, now);
      oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.05);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      oscillator.start(now);
      oscillator.stop(now + 0.05);
    }
  }

  // --- Animations ---
  let phaserTableRef;

  // --- State ---
  let balance = 218.39;
  let selectedChip = 5;
  let activeTab = 'hardways';
  let puckResetStatus = 0; // 0 = default, 1 = can reset, 2 = manual reset triggered
  let showDiceBubble = false;
  let diceBubbleRef;

  const hoppingHardWays = [
    [2, 2], [3, 3], [4, 4], [5, 5]
  ];

  const easyHops = [
    { col: 1, dice: [[1, 3], [1, 4], [2, 3], [2, 4], [1, 5]] },
    { col: 2, dice: [[1, 6], [2, 5], [3, 4]] },
    { col: 3, dice: [[2, 6], [3, 5], [3, 6], [4, 5], [4, 6]] }
  ];

  function getCategoryTotal(prefix) {
    return Object.keys(bets)
      .filter(id => id.startsWith(prefix))
      .reduce((sum, id) => sum + bets[id], 0);
  }

  let bets = {};
  let betStatus = {}; // Stores 'off' status for specific bets
  let rolling = false;
  let point = null;
  let betsOff = false;
  let showOddsPrompt = false;
  let showMoveBetPrompt = false;
  let showCommissionPrompt = false;
  let commissionData = { id: '', amount: 0, betType: '', commission: 0 };
  let moveBetData = { id: '', amount: 0 };
  let message = "MINIMUM TOTAL BET: $3";
  let lastRolls = [
    { dice: [6, 6], total: 12, establishesPoint: false },
    { dice: [4, 4], total: 8, establishesPoint: false },
    { dice: [3, 5], total: 8, establishesPoint: false },
    { dice: [2, 6], total: 8, establishesPoint: false },
    { dice: [1, 5], total: 6, establishesPoint: false },
    { dice: [4, 2], total: 6, establishesPoint: false },
    { dice: [5, 6], total: 11, establishesPoint: false },
    { dice: [3, 5], total: 8, establishesPoint: false },
    { dice: [4, 4], total: 8, establishesPoint: false },
    { dice: [2, 3], total: 5, establishesPoint: false },
    { dice: [5, 6], total: 11, establishesPoint: false }
  ];
  let hardwayCounters = { 4: 12, 6: 4, 8: 0, 10: 24 }; // Mock initial values
  let luckyRollerHits = new Set();
  let canPlaceLuckyRoller = true;

  // --- Win/Loss Display ---
  let showWinOverlay = false;
  let showLossOverlay = false;
  let winAmountDisplay = 0;
  let lossAmountDisplay = 0;
  let winOverlayTimer = null;
  let lossOverlayTimer = null;
  let milestoneFlash = false;
  let countInterval = null;

  let lastWinAmount = 0;
  let lastLossAmount = 0;
  let lastRollResult = "";
  // Roller tally state
  let lastRollTotalBet = 0;
  let lastRollWinnings = 0;
  let rollerTally = 0;
  let previousWasSevenOut = false;

  $: console.log('Stats Update:', { lastRollTotalBet, lastRollWinnings, rollerTally });

  function triggerWinOverlay(targetAmount) {
    if (targetAmount <= 0) return;
    
    lastWinAmount = targetAmount;
    lastLossAmount = 0;
    // Reset and start count-up
    winAmountDisplay = 0;
    showWinOverlay = true;
    showLossOverlay = false;
    milestoneFlash = false;
    
    if (countInterval) clearInterval(countInterval);
    if (winOverlayTimer) clearTimeout(winOverlayTimer);

    const duration = 1500; // 1.5 seconds for count
    const steps = 60;
    const increment = targetAmount / steps;
    let current = 0;
    let lastMilestone = 0;

    countInterval = setInterval(() => {
      current += increment;
      if (current >= targetAmount) {
        current = targetAmount;
        clearInterval(countInterval);
      }
      
      // Milestone check (every $10 hit)
      const currentMilestone = Math.floor(current / 10);
      if (currentMilestone > lastMilestone) {
        lastMilestone = currentMilestone;
        triggerMilestoneEffect();
      }
      
      winAmountDisplay = current;
    }, duration / steps);

    winOverlayTimer = setTimeout(() => {
      showWinOverlay = false;
    }, 4500); // Extended to account for count-up
  }

  function triggerLossOverlay(targetAmount) {
    if (targetAmount <= 0) return;
    
    lastLossAmount = targetAmount;
    lastWinAmount = 0;
    // Reset and start count-up
    lossAmountDisplay = 0;
    showLossOverlay = true;
    showWinOverlay = false;
    milestoneFlash = false;
    
    if (countInterval) clearInterval(countInterval);
    if (lossOverlayTimer) clearTimeout(lossOverlayTimer);

    const duration = 1200; // Slightly faster for loss
    const steps = 60;
    const increment = targetAmount / steps;
    let current = 0;
    let lastMilestone = 0;

    countInterval = setInterval(() => {
      current += increment;
      if (current >= targetAmount) {
        current = targetAmount;
        clearInterval(countInterval);
      }
      
      // Milestone check (every $10 hit)
      const currentMilestone = Math.floor(current / 10);
      if (currentMilestone > lastMilestone) {
        lastMilestone = currentMilestone;
        triggerMilestoneEffect();
      }
      
      lossAmountDisplay = current;
    }, duration / steps);

    lossOverlayTimer = setTimeout(() => {
      showLossOverlay = false;
    }, 4000);
  }

  function triggerMilestoneEffect() {
    milestoneFlash = true;
    playChipSound('select'); // Reuse chip sound for "hit" effect
    setTimeout(() => { milestoneFlash = false; }, 100);
  }

  $: if (puckResetStatus === 2) {
    betsOff = true;
    puckResetStatus = 0; // Reset after applying
  }

  // --- Reactive Logic ---
  $: isPressAvailable = point !== null && (
    (bets.passline || 0) > 0 || 
    (bets.field || 0) > 0 || 
    (bets.bet_c || 0) > 0 || 
    (bets.bet_e || 0) > 0 || 
    (bets.bet_ce || 0) > 0 || 
    (bets.any_craps || 0) > 0 || 
    (bets.any_7 || 0) > 0 || 
    (bets.horn_bet || 0) > 0 ||
    (bets.horn_2 || 0) > 0 ||
    (bets.horn_3 || 0) > 0 ||
    (bets.horn_11 || 0) > 0 ||
    (bets.horn_12 || 0) > 0 ||
    (bets.roll_em_all || 0) > 0 ||
    (bets.low_rolls || 0) > 0 ||
    (bets.high_rolls || 0) > 0 ||
    Object.keys(bets).some(k => k.startsWith('hop_') && (bets[k] || 0) > 0)
  );

  $: activeBetsTotal = Object.entries(bets).reduce((sum, [id, amount]) => {
    // Determine if bet is currently active
    let isActive = true;
    if (betsOff) {
      if (id.startsWith('place_') || id.startsWith('buy_') || id.startsWith('hard_') || id === 'take_odds') {
        isActive = false;
      }
    } else {
      if (betStatus[id] === 'off') isActive = false;
      // Hardways auto-off on come-out if not manually on
      if (point === null && id.startsWith('hard_') && betStatus[id] !== 'on') isActive = false;
    }
    return isActive ? sum + amount : sum;
  }, 0);

  $: betsAreValid = point !== null ? activeBetsTotal >= 3 : (bets.passline >= 3);

  function handlePress() {
    if (!isPressAvailable || point === null) {
      if (point === null) message = "PRESS ONLY AFTER COME-OUT";
      else message = "PLACE ACTION BETS TO PRESS";
      return;
    }
    
    const placeBetId = `place_${point}`;
    const buyBetId = `buy_${point}`;
    
    const currentPlaceBet = bets[placeBetId] || 0;
    const currentBuyBet = bets[buyBetId] || 0;
    
    if (currentPlaceBet > 0) {
      if (balance < currentPlaceBet) {
        message = "INSUFFICIENT CREDIT TO PRESS";
        return;
      }
      balance -= currentPlaceBet;
      bets[placeBetId] = currentPlaceBet * 2;
      
      if (bets[placeBetId] >= 2000000) { // Disabled auto-buy for now as per user preference
        bets[buyBetId] = (bets[buyBetId] || 0) + bets[placeBetId];
        delete bets[placeBetId];
        message = `PRESSED & AUTO-BOUGHT ${point}`;
      } else {
        message = `PRESSED ${point} TO $${bets[placeBetId]}`;
      }
      bets = bets;
    } else if (currentBuyBet > 0) {
      if (balance < currentBuyBet) {
        message = "INSUFFICIENT CREDIT TO PRESS";
        return;
      }
      balance -= currentBuyBet;
      bets[buyBetId] = currentBuyBet * 2;
      message = `PRESSED BUY ${point} TO $${bets[buyBetId]}`;
      bets = bets;
    } else {
      message = `NO PLACE BET ON ${point} TO PRESS`;
    }
  }

  function handleAcross() {
    if (point === null) {
      message = "ACROSS ONLY AFTER COME-OUT";
      return;
    }

    const points = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
    const targetPoints = points.filter(p => p !== point);
    const totalCost = targetPoints.length * selectedChip;

    if (balance < totalCost) {
      message = "INSUFFICIENT CREDIT FOR ACROSS";
      return;
    }

    targetPoints.forEach(p => {
      const placeId = `place_${p}`;
      balance -= selectedChip;
      bets[placeId] = (bets[placeId] || 0) + selectedChip;
    });

    bets = bets;
    message = `PLACED $${selectedChip} ACROSS`;
  }

  // --- Logic ---
  let currentRoll = [1, 1];
  
  onMount(() => {
    // Timer logic removed
  });
  
  function handlePlaceBet(id) {
    if (rolling || showCommissionPrompt) return;
    
    // Toggle individual bet status if clicking an already active bet with ALT key
    // In a real touchscreen, this would be a long press or sub-menu
    if (bets[id] > 0) {
      // For this implementation, let's use a simple shift-click or similar logic
      // but for now, we'll just handle the bet placement.
    }

    if (id === 'passline' && point !== null) {
      message = "PASS LINE IS A CONTRACT BET";
      return;
    }

    if (id === 'come' && point === null) {
      message = "PLACE COME BET AFTER POINT";
      return;
    }
    
    // Lucky Roller placement rules
    if (['low_rolls', 'high_rolls', 'roll_em_all'].includes(id)) {
      if (!canPlaceLuckyRoller) {
        message = "PLACEMENT ONLY AFTER SEVEN";
        return;
      }
    }

    // Odds limits for Crapless Craps
    if (id === 'take_odds') {
      if (point === null) {
        message = "POINT NOT SET";
        return;
      }
      
      const passlineBet = bets.passline || 0;
      if (passlineBet === 0) {
        message = "PLACE PASS LINE FIRST";
        return;
      }

      const currentOdds = bets.take_odds || 0;
      // Limits: 2x for 2, 3, 11, 12; 3x for 4, 10; 4x for 5, 9; 5x for 6, 8
      const limits = { 2: 2, 12: 2, 3: 2, 11: 2, 4: 3, 10: 3, 5: 4, 9: 4, 6: 5, 8: 5 };
      const multiplier = limits[point] || 3;
      const maxOdds = passlineBet * multiplier;

      if (currentOdds + selectedChip > maxOdds) {
        message = `${multiplier}X ODDS LIMIT ($${maxOdds})`;
        return;
      }
    }

    if (balance < selectedChip) {
      message = "INSUFFICIENT CREDIT";
      return;
    }

    // Buy/Lay commission logic
    if (id.startsWith('buy_') || id.startsWith('lay_')) {
      const commission = selectedChip * 0.05;
      if (balance < selectedChip + commission) {
        message = "INSUFFICIENT CREDIT FOR COMMISSION";
        return;
      }
      
      commissionData = {
        id,
        amount: selectedChip,
        betType: id.startsWith('buy_') ? 'Buy' : 'Lay',
        commission: commission
      };
      showCommissionPrompt = true;
      return; // Wait for confirmation
    }

    balance -= selectedChip;
    bets[id] = (bets[id] || 0) + selectedChip;
    playChipSound('place');

    bets = bets;
  }

  function handleCommissionConfirm() {
    const { id, amount, commission } = commissionData;
    balance -= (amount + commission);
    bets[id] = (bets[id] || 0) + amount;
    bets = bets;
    showCommissionPrompt = false;
    message = "COMMISSION PAID";
  }

  function handleCommissionDecline() {
    showCommissionPrompt = false;
    message = "BET CANCELLED";
  }

  function toggleBetStatus(id) {
    if (rolling) return;
    if (!bets[id]) return;
    
    // Unstoppable bets cannot be turned off
    const unstoppable = ['passline', 'come', 'field', 'any_7', 'any_craps', 'roll_em_all', 'low_rolls', 'high_rolls'];
    if (unstoppable.includes(id) || id.startsWith('hop_')) {
      message = "BET IS ALWAYS WORKING";
      return;
    }

    betStatus[id] = betStatus[id] === 'off' ? 'on' : 'off';
    betStatus = betStatus;
    message = `${id.replace('_', ' ').toUpperCase()} ${betStatus[id].toUpperCase()}`;
  }

  function handleOddsSelection(event) {
    const multiplier = event.detail;
    showOddsPrompt = false;
    
    if (multiplier > 0 && point !== null && bets.passline > 0) {
      const amount = bets.passline * multiplier;
      if (balance >= amount) {
        balance -= amount;
        bets.take_odds = (bets.take_odds || 0) + amount;
        bets = bets;
        message = `${multiplier}X ODDS APPLIED`;
      } else {
        message = "INSUFFICIENT CREDIT FOR ODDS";
      }
    }
  }

  function handleMoveBet(event) {
    const { targetNumber, type, amount, sourceId } = event.detail;
    showMoveBetPrompt = false;

    // Remove from source
    delete bets[sourceId];

    // Add to target
    const targetId = `${type}_${targetNumber}`;
    bets[targetId] = (bets[targetId] || 0) + amount;
    
    // Auto-Buy logic for Place bets moved to $20+
    if (type === 'place' && bets[targetId] >= 20) {
      bets[`buy_${targetNumber}`] = (bets[`buy_${targetNumber}`] || 0) + bets[targetId];
      delete bets[targetId];
      message = `MOVED TO BUY ${targetNumber}`;
    } else {
      message = `MOVED TO ${type.toUpperCase()} ${targetNumber}`;
    }

    bets = bets;
  }

  function rollDice() {
    if (rolling || showCommissionPrompt) return;
    
    if (point === null && (bets.passline || 0) < 3) {
      message = "MINIMUM $3 PASS LINE REQUIRED";
      return;
    }

    if (!betsAreValid) {
      message = "MINIMUM TOTAL ACTIVE BET: $3";
      return;
    }
    
    showDiceBubble = true;
    message = "ROLLING...";
    
    if (diceBubbleRef) {
      diceBubbleRef.roll();
    } else {
      setTimeout(() => {
        if (diceBubbleRef) diceBubbleRef.roll();
      }, 50);
    }
  }

  function handleDiceRolled(event) {
    const { dice: roll, total } = event.detail;
    
    // Check if this roll will establish a point (before processResults updates it)
    const establishesPoint = (point === null && total !== 7);
    
    // Update game state
    currentRoll = roll;
    lastRolls = [{ dice: roll, total, establishesPoint }, ...lastRolls.slice(0, 14)];
    message = `YOU ROLLED ${total}`;
    
    // Process results
    processResults(total);
    
    // Keep icons bouncing for a moment so user can see result
    setTimeout(() => {
      rolling = false;
    }, 1000);
  }

  function handleManualRoll() {
    if (rolling || showCommissionPrompt) return;
    
    if (diceBubbleRef) {
      diceBubbleRef.roll();
    } else {
      rollDice();
    }
  }

  function handleKeyDown(event) {
    if (event.code === 'Space') {
      event.preventDefault();
      handleManualRoll();
    }
  }

  const numbers = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
  
  const placeOdds = {
    2: 11/2, 3: 11/4, 4: 9/5, 5: 7/5, 6: 7/6,
    8: 7/6, 9: 7/5, 10: 9/5, 11: 11/4, 12: 11/2
  };

  const trueOdds = {
    2: 6/1, 3: 3/1, 4: 2/1, 5: 3/2, 6: 6/5,
    8: 6/5, 9: 3/2, 10: 2/1, 11: 3/1, 12: 6/1
  };

  const hardwayOdds = {
    4: 7, 6: 9, 8: 9, 10: 7
  };

  function formatOdds(n) {
    const odds = {
      2: "11 TO 2", 3: "11 TO 4", 4: "9 TO 5", 5: "7 TO 5", 6: "7 TO 6",
      8: "7 TO 6", 9: "7 TO 5", 10: "9 TO 5", 11: "11 TO 4", 12: "11 TO 2"
    };
    return odds[n] || "";
  }

  function processResults(total) {
    let winnings = 0;
    const currentBets = { ...bets };
    const winningBets = [];
    const losingBets = [];

    // Capture total bet at start of roll
    lastRollTotalBet = Object.keys(bets).reduce((sum, id) => sum + (bets[id] || 0), 0);
    
    // Helper to check if a bet is active for the current roll
    const isBetActive = (id) => {
      if (betsOff) {
        if (id.startsWith('place_') || id.startsWith('buy_') || id.startsWith('num_') || id.startsWith('hard_') || id === 'take_odds') {
          return false;
        }
      }
      if (betStatus[id] === 'off') return false;
      // For num_ prefix (Place bets)
      if (id.startsWith('num_') && betStatus[id] === 'off') return false;
      // Hardways auto-off on come-out if not manually on
      if (point === null && id.startsWith('hard_') && betStatus[id] !== 'on') return false;
      return true;
    };

    // Increment hardway counters
    [4, 6, 8, 10].forEach(n => hardwayCounters[n]++);
    // Reset if it's a hardway
    if (currentRoll[0] === currentRoll[1] && [4, 6, 8, 10].includes(total)) {
      hardwayCounters[total] = 0;
    }
    hardwayCounters = hardwayCounters;

    lastRollResult = "";

    // Lucky Roller Hit Tracking
    if (total !== 7) {
      luckyRollerHits.add(total);
      luckyRollerHits = luckyRollerHits;
      canPlaceLuckyRoller = false;
    }

    // Field Bet (ALWAYS WORKING)
    if (currentBets.field) {
      if ([2, 3, 4, 9, 10, 11, 12].includes(total)) {
        let multiplier = (total === 2 || total === 12) ? 2 : 1;
        const win = currentBets.field * multiplier;
        winnings += currentBets.field + win;
        winningBets.push('field');
        lastRollResult += `Field $${win.toFixed(2)} WIN. `;
        delete bets.field;
      } else {
        losingBets.push('field');
        lastRollResult += `Field $${currentBets.field.toFixed(2)} LOSS. `;
        delete bets.field;
      }
    }

    // Any Seven (ALWAYS WORKING)
    if (currentBets.any_7) {
      if (total === 7) {
        const win = currentBets.any_7 * 4;
        winnings += currentBets.any_7 + win;
        winningBets.push('any_7');
        lastRollResult += `Any 7 $${win.toFixed(2)} WIN. `;
      } else {
        losingBets.push('any_7');
        lastRollResult += `Any 7 $${currentBets.any_7.toFixed(2)} LOSS. `;
      }
      delete bets.any_7;
    }

    // Any Craps (ALWAYS WORKING)
    if (currentBets.any_craps || currentBets.bet_c) {
      const amount = (currentBets.any_craps || 0) + (currentBets.bet_c || 0);
      if ([2, 3, 12].includes(total)) {
        const win = amount * 7;
        winnings += amount + win;
        if (currentBets.any_craps) winningBets.push('any_craps');
        if (currentBets.bet_c) winningBets.push('bet_c');
        lastRollResult += `Craps $${win.toFixed(2)} WIN. `;
      } else {
        if (currentBets.any_craps) losingBets.push('any_craps');
        if (currentBets.bet_c) losingBets.push('bet_c');
        lastRollResult += `Craps $${amount.toFixed(2)} LOSS. `;
      }
      delete bets.any_craps;
      delete bets.bet_c;
    }

    // Eleven (ALWAYS WORKING)
    if (currentBets.bet_e || currentBets.horn_11) {
      const amount = (currentBets.bet_e || 0) + (currentBets.horn_11 || 0);
      if (total === 11) {
        const win = amount * 15;
        winnings += amount + win;
        if (currentBets.bet_e) winningBets.push('bet_e');
        if (currentBets.horn_11) winningBets.push('horn_11');
        lastRollResult += `Yo-11 $${win.toFixed(2)} WIN. `;
      } else {
        if (currentBets.bet_e) losingBets.push('bet_e');
        if (currentBets.horn_11) losingBets.push('horn_11');
        lastRollResult += `Yo-11 $${amount.toFixed(2)} LOSS. `;
      }
      delete bets.bet_e;
      delete bets.horn_11;
    }

    // Horn Bet (ALWAYS WORKING)
    if (currentBets.horn_bet) {
      const quarter = currentBets.horn_bet / 4;
      if (total === 2 || total === 12 || total === 3 || total === 11) {
        let win = 0;
        if (total === 2 || total === 12) win = quarter * 30 - (3 * quarter);
        else if (total === 3 || total === 11) win = quarter * 15 - (3 * quarter);
        winnings += quarter + win;
        winningBets.push('horn_bet');
        lastRollResult += `Horn $${win.toFixed(2)} WIN. `;
      } else {
        losingBets.push('horn_bet');
        lastRollResult += `Horn $${currentBets.horn_bet.toFixed(2)} LOSS. `;
      }
      delete bets.horn_bet;
    }

    // C&E (ALWAYS WORKING)
    if (currentBets.bet_ce) {
      if ([2, 3, 12, 11].includes(total)) {
        let win = 0;
        if ([2, 3, 12].includes(total)) win = currentBets.bet_ce * 3;
        else if (total === 11) win = currentBets.bet_ce * 7;
        winnings += currentBets.bet_ce + win;
        winningBets.push('bet_ce');
        lastRollResult += `C&E $${win.toFixed(2)} WIN. `;
      } else {
        losingBets.push('bet_ce');
        lastRollResult += `C&E $${currentBets.bet_ce.toFixed(2)} LOSS. `;
      }
      delete bets.bet_ce;
    }

    // Other Horn Bets (ALWAYS WORKING)
    ['horn_2', 'horn_3', 'horn_12'].forEach(id => {
      if (currentBets[id]) {
        const n = parseInt(id.split('_')[1]);
        if (total === n) {
          const win = currentBets[id] * ((n === 2 || n === 12) ? 30 : 15);
          winnings += currentBets[id] + win;
          winningBets.push(id);
          lastRollResult += `Horn ${n} $${win.toFixed(2)} WIN. `;
        } else {
          losingBets.push(id);
          lastRollResult += `Horn ${n} $${currentBets[id].toFixed(2)} LOSS. `;
        }
        delete bets[id];
      }
    });

    // Hop Bets (ALWAYS WORKING)
    Object.keys(currentBets).forEach(id => {
      if (id.startsWith('hop_')) {
        const parts = id.split('_');
        const d1 = parseInt(parts[1]);
        const d2 = parseInt(parts[2]);
        const betAmount = currentBets[id];
        if ((currentRoll[0] === d1 && currentRoll[1] === d2) || (currentRoll[0] === d2 && currentRoll[1] === d1)) {
          const win = betAmount * ((d1 === d2) ? 30 : 15);
          winnings += betAmount + win;
          winningBets.push(id);
          lastRollResult += `Hop ${d1}/${d2} $${win.toFixed(2)} WIN. `;
        } else {
          losingBets.push(id);
          lastRollResult += `Hop ${d1}/${d2} $${betAmount.toFixed(2)} LOSS. `;
        }
        delete bets[id];
      }
    });

    // Hardways (Subject to OFF status)
    [4, 6, 8, 10].forEach(n => {
      const betId = `hard_${n}`;
      if (currentBets[betId] && isBetActive(betId)) {
        if (total === n && currentRoll[0] === currentRoll[1]) {
          const win = currentBets[betId] * hardwayOdds[n];
          winnings += currentBets[betId] + win;
          winningBets.push(betId);
          lastRollResult += `Hard ${n} $${win.toFixed(2)} WIN. `;
          delete bets[betId];
        } else if (total === 7 || (total === n && currentRoll[0] !== currentRoll[1])) {
          losingBets.push(betId);
          lastRollResult += `Hard ${n} $${currentBets[betId].toFixed(2)} LOSS. `;
          delete bets[betId];
        }
      }
    });

    // Pass Line & Odds (ALWAYS WORKING)
    if (point === null) {
      if (total === 7) {
        if (currentBets.passline) {
          const win = currentBets.passline;
          winnings += (currentBets.passline + win);
          winningBets.push('passline');
          lastRollResult += `Pass Line $${win.toFixed(2)} WIN. `;
        }
        
        // Remove ALL other bets on the table on a Seven Out (Roll #1 win for Pass Line)
        Object.keys(bets).forEach(id => {
          if (id !== 'passline') {
            losingBets.push(id);
            if (currentBets[id]) {
              lastRollResult += `${id.replace('_',' ')} $${currentBets[id].toFixed(2)} LOSS. `;
            }
          }
          delete bets[id];
        });

        betsOff = true; 
      } else {
        // Roll #1 win condition is a 7, no losing condition, point established on a 2, 3, 4, 5, 6, 8, 9, 10, 11, or 12.
        point = total;
        message = `POINT IS ${point}`;
        lastRollResult += `Point set to ${point}. `;
        betsOff = false; 
        if (bets.take_odds) {
          balance += bets.take_odds;
          delete bets.take_odds;
        }
        if (bets.passline > 0) showOddsPrompt = true;
      }
    } else {
      // Come Bet Processing (when point exists)
      if (currentBets.come) {
        if (total === 7) {
          const win = currentBets.come;
          winnings += (currentBets.come + win);
          winningBets.push('come');
          lastRollResult += `Come $${win.toFixed(2)} WIN. `;
          delete bets.come;
        } else {
          // Move Come bet to the number
          const targetId = `come_${total}`;
          bets[targetId] = (bets[targetId] || 0) + currentBets.come;
          delete bets.come;
          lastRollResult += `Come moved to ${total}. `;
        }
      }

      // Established Come Bets Processing
      numbers.forEach(n => {
        const comeId = `come_${n}`;
        if (currentBets[comeId]) {
          if (total === n) {
            const win = currentBets[comeId];
            winnings += (currentBets[comeId] + win);
            winningBets.push(comeId);
            lastRollResult += `Come ${n} $${win.toFixed(2)} WIN. `;
            delete bets[comeId];
          } else if (total === 7) {
            losingBets.push(comeId);
            lastRollResult += `Come ${n} $${currentBets[comeId].toFixed(2)} LOSS. `;
            delete bets[comeId];
          }
        }
      });

      if (total === point) {
        if (currentBets.passline) {
          const win = currentBets.passline;
          winnings += (currentBets.passline + win);
          winningBets.push('passline');
          lastRollResult += `Pass Line $${win.toFixed(2)} WIN. `;
        }
        if (currentBets.take_odds && isBetActive('take_odds')) {
          const win = currentBets.take_odds * trueOdds[point];
          winnings += (currentBets.take_odds + win);
          winningBets.push('take_odds');
          lastRollResult += `Odds $${win.toFixed(2)} WIN. `;
        }
        delete bets.passline;
        delete bets.take_odds;
        point = null;
        message = "WINNER! PASS LINE PAYS";
      } else if (total === 7) {
        if (currentBets.passline) {
          losingBets.push('passline');
          lastRollResult += `Pass Line $${currentBets.passline.toFixed(2)} LOSS. `;
        }
        if (currentBets.take_odds) {
          losingBets.push('take_odds');
          lastRollResult += `Odds $${currentBets.take_odds.toFixed(2)} LOSS. `;
        }
        
        // Remove ALL other bets on the table on a Seven Out
        Object.keys(bets).forEach(id => {
          if (id !== 'passline' && id !== 'take_odds') {
            losingBets.push(id);
            if (currentBets[id]) lastRollResult += `${id.replace('_',' ')} $${currentBets[id].toFixed(2)} LOSS. `;
          }
          delete bets[id];
        });
        
        point = null;
        message = "SEVEN OUT";
        betsOff = true; 
        previousWasSevenOut = true;
      }
    }

    // Place & Buy Bets (Subject to OFF status)
    numbers.forEach(n => {
      const placeId = `place_${n}`;
      if (currentBets[placeId] && isBetActive(placeId)) {
        if (total === n) {
          const win = Math.floor(currentBets[placeId] * placeOdds[n]);
          winnings += win; // Only add profit, bet stays
          winningBets.push(placeId);
          lastRollResult += `Place ${n} $${win.toFixed(2)} WIN. `;
        } else if (total === 7) {
          // Already handled in point === null / point !== null blocks for total === 7
        }
      }

      const buyId = `buy_${n}`;
      if (currentBets[buyId] && isBetActive(buyId)) {
        if (total === n) {
          const winAmount = Math.floor(currentBets[buyId] * trueOdds[n]);
          const commission = Math.ceil(winAmount * 0.05);
          const win = winAmount - commission;
          winnings += win; // Only add profit, bet stays
          winningBets.push(buyId);
          lastRollResult += `Buy ${n} $${win.toFixed(2)} WIN (Comm $${commission}). `;
        } else if (total === 7) {
          // Already handled in point === null / point !== null blocks for total === 7
        }
      }
    });

    // Lucky Roller Result Processing
    if (total === 7) {
      // Already handled in point blocks
      luckyRollerHits = new Set();
      canPlaceLuckyRoller = true;
    } else {
      const lowSet = [2, 3, 4, 5, 6];
      const highSet = [8, 9, 10, 11, 12];
      const allSet = [...lowSet, ...highSet];

      if (bets.low_rolls && lowSet.every(n => luckyRollerHits.has(n))) {
        const win = bets.low_rolls * 30;
        winnings += bets.low_rolls + win;
        winningBets.push('low_rolls');
        delete bets.low_rolls;
        message = "LUCKY ROLLER LOW WIN!";
        lastRollResult += `Lucky Low $${win.toFixed(2)} WIN. `;
      }
      if (bets.high_rolls && highSet.every(n => luckyRollerHits.has(n))) {
        const win = bets.high_rolls * 30;
        winnings += bets.high_rolls + win;
        winningBets.push('high_rolls');
        delete bets.high_rolls;
        message = "LUCKY ROLLER HIGH WIN!";
        lastRollResult += `Lucky High $${win.toFixed(2)} WIN. `;
      }
      if (bets.roll_em_all && allSet.every(n => luckyRollerHits.has(n))) {
        const win = bets.roll_em_all * 155;
        winnings += bets.roll_em_all + win;
        winningBets.push('roll_em_all');
        delete bets.roll_em_all;
        message = "ROLL 'EM ALL WIN!";
        lastRollResult += `Roll 'Em All $${win.toFixed(2)} WIN. `;
      }
    }

    // Finalize roll stats and tally
    lastRollWinnings = winnings;
    
    // Net result of THIS ROLL: 
    // (Amount returned to player) - (Amount they had at risk at the start of the roll)
    const netRoll = lastRollWinnings - lastRollTotalBet;
    
    // Update tally
    if (previousWasSevenOut && point === null) {
      rollerTally = netRoll;
      previousWasSevenOut = false;
    } else {
      rollerTally += netRoll;
    }

    // Force reactivity for all stats variables
    lastRollTotalBet = Number(lastRollTotalBet);
    lastRollWinnings = Number(lastRollWinnings);
    rollerTally = Number(rollerTally);

    console.log('Finalized Stats:', { lastRollTotalBet, lastRollWinnings, rollerTally, netRoll });

    // Animation & Sounds
    try {
      if (phaserTableRef) {
        const getPos = (id) => {
          const el = document.querySelector(`[data-bet-id="${id}"]`);
          if (el) {
            const rect = el.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          }
          return null;
        };

        if (total === 7) {
          // On a Seven Out, all bets are cleared from the table (even winners like Any 7)
          // We trigger loss animations for everything that was on the table
          const lossPositions = losingBets.map(getPos).filter(p => p !== null);
          const totalLoss = losingBets.reduce((sum, id) => sum + (currentBets[id] || 0), 0);
          
          if (lossPositions.length > 0) {
            phaserTableRef.triggerLossAnimation(lossPositions);
            playChipSound('loss');
            if (totalLoss > 0) triggerLossOverlay(totalLoss);
          }
          
          // Special case for Any 7 which technically wins on 7
          if (winningBets.includes('any_7')) {
            playChipSound('win');
            triggerWinOverlay(currentBets.any_7 * 4); // Any 7 pays 4:1
          }
          
          // Special case for Pass Line on come-out
          if (winningBets.includes('passline')) {
            playChipSound('win');
            triggerWinOverlay(currentBets.passline); // Pass line pays 1:1
          }
        } else {
          if (winningBets.length > 0) {
            const winPositions = winningBets.map(getPos).filter(p => p !== null);
            if (winPositions.length > 0) {
              phaserTableRef.triggerWinAnimation(winPositions);
              playChipSound('win');
              triggerWinOverlay(winnings);
            }
          }

          if (losingBets.length > 0) {
            const lossPositions = losingBets.map(getPos).filter(p => p !== null);
            if (lossPositions.length > 0) {
              const totalLoss = losingBets.reduce((sum, id) => sum + (currentBets[id] || 0), 0);
              phaserTableRef.triggerLossAnimation(lossPositions);
              playChipSound('loss');
              triggerLossOverlay(totalLoss);
            }
          }
        }
      }
    } catch (e) {
      console.error("Error in animation/sound processing:", e);
    }

    balance += winnings;
    bets = bets;
    if (winnings > 0) message = `WINNER! $${winnings.toFixed(2)}`;
  }

  function handleRemoveBet(id, event) {
    if (rolling || showCommissionPrompt) return;
    if (event) event.preventDefault();

    if (id === 'passline' && point !== null) {
      message = "PASS LINE IS A CONTRACT BET";
      return;
    }
    
    // Odds can be removed even when point is set
    if (bets[id]) {
      balance += bets[id];
      delete bets[id];
      bets = bets;
      message = "BET REMOVED";
      playChipSound('remove');
    }
  }

  function clearBets() {
    if (rolling || showCommissionPrompt) return;
    const newBets = {};
    let refund = 0;
    
    Object.keys(bets).forEach(id => {
      if (id === 'passline' && point !== null) {
        newBets[id] = bets[id];
      } else {
        refund += bets[id];
      }
    });
    
    balance += refund;
    bets = newBets;
    if (bets.passline && point !== null) {
      message = "CONTRACT BETS REMAINED";
    }
  }

  const diceDots = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };
  // --- Computed ---
  $: totalBet = Object.values(bets).reduce((a, b) => a + b, 0);

</script>

<svelte:window on:keydown={handleKeyDown} />

<main class="h-screen w-full bg-[#0a2e0a] text-white flex flex-col font-sans overflow-hidden select-none relative"
      style="background-image: radial-gradient(circle at 50% 50%, #1a4d2e 0%, #0a2e0a 100%)">
  
  <PhaserTable bind:this={phaserTableRef} roll={currentRoll} />

  <!-- Win Overlay -->
  {#if showWinOverlay}
    <div class="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none">
      <div class="relative flex items-center justify-center scale-[1.5] animate-bounce {milestoneFlash ? 'scale-[1.7] brightness-150' : ''} transition-all duration-75">
        <!-- Gold Win Amount Text -->
        <div class="relative flex items-center">
          <span class="text-7xl font-black italic tracking-tighter drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] 
                       bg-gradient-to-b from-yellow-200 via-yellow-500 to-yellow-800 bg-clip-text text-transparent
                       border-text-stroke flex items-baseline">
            <span>${Math.floor(winAmountDisplay)}</span>
            <span class="relative">
              .
              <!-- Radial Burst Background (Now positioned at the decimal point) -->
              <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] flex items-center justify-center opacity-80 pointer-events-none -z-10">
                <div class="absolute inset-0 bg-[radial-gradient(circle,rgba(255,223,0,0.8)_0%,transparent_70%)] animate-pulse"></div>
                {#each Array(12) as _, i}
                  <div class="absolute w-[2px] h-[150px] bg-gradient-to-t from-transparent via-yellow-400 to-transparent"
                       style="transform: rotate({i * 30}deg)"></div>
                {/each}
              </div>
            </span>
            <span>{(winAmountDisplay % 1).toFixed(2).split('.')[1]}</span>
          </span>
        </div>
      </div>
    </div>
  {/if}

  <!-- Loss Overlay -->
  {#if showLossOverlay}
    <div class="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none">
      <div class="relative flex items-center justify-center scale-[1.5] animate-bounce {milestoneFlash ? 'scale-[1.7] brightness-150' : ''} transition-all duration-75">
        <!-- Red Loss Amount Text -->
        <div class="relative flex items-center">
          <span class="text-7xl font-black italic tracking-tighter drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] 
                       bg-gradient-to-b from-red-200 via-red-500 to-red-800 bg-clip-text text-transparent
                       border-text-stroke flex items-baseline">
            <span>-${Math.floor(lossAmountDisplay)}</span>
            <span class="relative">
              .
              <!-- Red Radial Burst Background (Now positioned at the decimal point) -->
              <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] flex items-center justify-center opacity-80 pointer-events-none -z-10">
                <div class="absolute inset-0 bg-[radial-gradient(circle,rgba(255,59,48,0.8)_0%,transparent_70%)] animate-pulse"></div>
                {#each Array(12) as _, i}
                  <div class="absolute w-[2px] h-[150px] bg-gradient-to-t from-transparent via-red-500 to-transparent"
                       style="transform: rotate({i * 30}deg)"></div>
                {/each}
              </div>
            </span>
            <span>{(lossAmountDisplay % 1).toFixed(2).split('.')[1]}</span>
          </span>
        </div>
      </div>
    </div>
  {/if}
  
  {#if showOddsPrompt}
    <OddsPrompt 
      point={point} 
      passlineAmount={bets.passline || 0} 
      on:select={handleOddsSelection} 
    />
  {/if}

  {#if showMoveBetPrompt}
    <MoveBetPrompt 
      currentPoint={point}
      betToMove={moveBetData}
      on:move={handleMoveBet}
      on:close={() => showMoveBetPrompt = false}
    />
  {/if}

  {#if showCommissionPrompt}
    <CommissionPrompt
      amount={commissionData.amount}
      betType={commissionData.betType}
      commission={commissionData.commission}
      on:confirm={handleCommissionConfirm}
      on:decline={handleCommissionDecline}
    />
  {/if}
  
  <!-- Header / Top Info -->
  <div class="h-12 flex items-center justify-center px-4 bg-black/40 border-b border-white/10 shrink-0">
    <div class="text-center flex items-center gap-6">
      <div class="flex flex-col items-center min-w-[200px]">
        <span class="text-xs font-black uppercase tracking-widest {rolling ? 'text-red-500 animate-pulse' : (!betsAreValid ? 'text-red-500' : 'text-white/80')}">
          {rolling ? 'NO MORE BETS' : (!betsAreValid ? 'BETS ARE NOT VALID YET!' : (lastRollResult || message))}
        </span>
      </div>
    </div>
  </div>

  <!-- Main Game Area -->
  <div class="flex-1 flex flex-col p-2 gap-1.5 overflow-hidden max-w-[1400px] mx-auto w-full">
    
    <!-- Top Feature: Lucky Roller, Dice Bubble & Placeholder -->
    <div class="h-[18%] flex justify-between items-stretch gap-3 shrink-0 mb-1">
      <div class="w-[42%] bg-[#1a4d2e] rounded-2xl border-2 border-emerald-400/50 shadow-[0_0_40px_rgba(0,0,0,0.6),inset_0_0_30px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden relative group">
        
        <!-- Progress Bubbles & Dice Row (Top) -->
        <div class="h-[55%] flex items-center justify-between px-6 relative z-10">
          <!-- Low Rolls Section -->
          <div class="flex flex-col items-center">
            <span class="text-4xl font-black italic text-yellow-500/20 drop-shadow-2xl tracking-tighter mb-1" style="font-family: 'Brush Script MT', cursive;">Lucky</span>
            <div class="flex gap-1">
              {#each [2,3,4,5,6] as n}
                <div class="w-7 h-7 rounded-full {luckyRollerHits.has(n) ? 'bg-yellow-400 text-black shadow-[0_0_12px_rgba(250,204,21,0.6)]' : 'bg-emerald-800/60 text-emerald-400/40'} text-xs flex items-center justify-center font-black transition-all duration-300 border border-emerald-400/20">{n}</div>
              {/each}
            </div>
          </div>

          <!-- Center: Large Rolling Dice Visualization -->
          <div class="flex-1 flex justify-center items-center px-2 relative h-full">
            <div class="flex gap-2 items-center scale-110">
              <img src="https://img.icons8.com/fluency/96/dice.png" alt="dice" class="w-16 h-16 drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] rotate-[15deg] {rolling ? 'animate-bounce' : 'opacity-90'} grayscale brightness-125 contrast-110" />
              <img src="https://img.icons8.com/fluency/96/dice.png" alt="dice" class="w-16 h-16 drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] -rotate-[15deg] {rolling ? 'animate-bounce [animation-delay:0.1s]' : 'opacity-90'} grayscale brightness-125 contrast-110" />
            </div>
          </div>

          <!-- High Rolls Section -->
          <div class="flex flex-col items-center">
            <span class="text-4xl font-black italic text-yellow-500/20 drop-shadow-2xl tracking-tighter mb-1" style="font-family: 'Brush Script MT', cursive;">Roller</span>
            <div class="flex gap-1">
              {#each [8,9,10,11,12] as n}
                <div class="w-7 h-7 rounded-full {luckyRollerHits.has(n) ? 'bg-yellow-400 text-black shadow-[0_0_12px_rgba(250,204,21,0.6)]' : 'bg-emerald-800/60 text-emerald-400/40'} text-xs flex items-center justify-center font-black transition-all duration-300 border border-emerald-400/20">{n}</div>
              {/each}
            </div>
          </div>
        </div>

        <!-- Betting Labels & Payouts Row (Bottom) -->
        <div class="h-[45%] flex divide-x-2 divide-white/10 bg-[#0a2e0a]/80 border-t border-white/10">
          <BetSpot 
            id="low_rolls" 
            className="flex-1 flex flex-col items-center justify-center p-0.5 hover:bg-white/5 transition-all relative overflow-hidden"
            on:click={() => handlePlaceBet('low_rolls')} 
            on:contextmenu={(e) => handleRemoveBet('low_rolls', e)} 
            amount={bets.low_rolls}
          >
            <span class="text-[9px] font-black text-white tracking-widest uppercase">LOW ROLLS</span>
            <span class="text-[7px] font-bold text-emerald-400/60 uppercase">BET HERE</span>
            <span class="text-base font-black text-white drop-shadow-md leading-none">30 <span class="text-[9px] opacity-60">TO</span> 1</span>
          </BetSpot>

          <BetSpot 
            id="roll_em_all" 
            className="flex-[1.2] flex flex-col items-center justify-center p-0.5 hover:bg-white/5 transition-all relative overflow-hidden"
            on:click={() => handlePlaceBet('roll_em_all')} 
            on:contextmenu={(e) => handleRemoveBet('roll_em_all', e)} 
            amount={bets.roll_em_all}
          >
            <span class="text-[9px] font-black text-white tracking-widest uppercase">ROLL 'EM ALL</span>
            <span class="text-[7px] font-bold text-emerald-400/60 uppercase">BET HERE</span>
            <span class="text-lg font-black text-white drop-shadow-md leading-none">155 <span class="text-xs opacity-60">TO</span> 1</span>
          </BetSpot>

          <BetSpot 
            id="high_rolls" 
            className="flex-1 flex flex-col items-center justify-center p-0.5 hover:bg-white/5 transition-all relative overflow-hidden"
            on:click={() => handlePlaceBet('high_rolls')} 
            on:contextmenu={(e) => handleRemoveBet('high_rolls', e)} 
            amount={bets.high_rolls}
          >
            <span class="text-[9px] font-black text-white tracking-widest uppercase">HIGH ROLLS</span>
            <span class="text-[7px] font-bold text-emerald-400/60 uppercase">BET HERE</span>
            <span class="text-base font-black text-white drop-shadow-md leading-none">30 <span class="text-[9px] opacity-60">TO</span> 1</span>
          </BetSpot>
        </div>
      </div>

      <DiceBubble 
        bind:this={diceBubbleRef}
        show={true}
        on:rollStart={() => rolling = true}
        on:rolled={handleDiceRolled}
        on:close={() => {
          showDiceBubble = false;
          rolling = false;
        }}
      />

      <!-- Info Block (Moved from Header) -->
      <div class="flex-1 min-w-[500px] bg-[#1a4d2e] rounded-2xl border-2 border-emerald-400/50 shadow-[0_0_40px_rgba(0,0,0,0.6),inset_0_0_30px_rgba(0,0,0,0.4)] flex items-center justify-between px-4 overflow-hidden relative group">
        <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent"></div>
        
        <div class="flex items-center gap-4 relative z-10 flex-1 min-w-0">
          <!-- Compact Stats Box -->
          <div class="flex items-center bg-black/40 rounded-xl border border-white/10 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] divide-x divide-white/10 shrink-0">
            <div class="flex flex-col items-center px-3 py-1">
              <span class="text-[8px] font-black text-zinc-500 uppercase tracking-tighter mb-0">Last Bet</span>
              <span class="text-xs font-black text-white leading-tight">${lastRollTotalBet.toFixed(2)}</span>
            </div>
            <div class="flex flex-col items-center px-3 py-1">
              <span class="text-[8px] font-black text-zinc-500 uppercase tracking-tighter mb-0">Last Win</span>
              <span class="text-xs font-black text-emerald-400 leading-tight">${lastRollWinnings.toFixed(2)}</span>
            </div>
            <div class="flex flex-col items-center px-3 py-1 min-w-[90px] bg-white/5">
              <span class="text-[8px] font-black text-zinc-400 uppercase tracking-tighter mb-0">Shooter P/L</span>
              <span class="text-xs font-black {rollerTally >= 0 ? 'text-emerald-400' : 'text-red-400'} leading-tight">
                {rollerTally >= 0 ? '+' : ''}${Math.abs(rollerTally).toFixed(2)}
              </span>
            </div>
          </div>
          
          <div class="flex flex-col playable-balance shrink-0 ml-2">
            <span class="text-[9px] font-black text-zinc-400 uppercase leading-none tracking-tighter">Balance</span>
            <span class="text-xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">${balance.toFixed(2)}</span>
          </div>
        </div>

        <div class="flex items-center gap-3 relative z-10 shrink-0">
          <div class="flex flex-col items-end">
            <span class="text-[9px] font-black text-zinc-400 uppercase leading-none tracking-tighter">Current Bet</span>
            <span class="text-xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">${totalBet.toFixed(2)}</span>
          </div>
          <button class="p-1.5 rounded-full bg-black/40 border border-white/10 text-zinc-400 hover:text-white transition-colors shadow-inner">
            <Settings size={18} />
          </button>
        </div>
      </div>
    </div>

    <!-- Middle: Main Betting Board -->
    <div class="flex-1 flex gap-2 min-h-0 {rolling ? 'pointer-events-none opacity-80' : ''} transition-all duration-300">
      
      <!-- Left: Prop/Hardways -->
      <div class="w-[35%] flex flex-col gap-1 shrink-0">
        <!-- Tabs (Matching Image Exactly) -->
        <div class="flex gap-1 h-12 mb-2">
          <div class="flex-1 relative">
            {#if activeTab === 'hardways'}
              <div class="absolute inset-[-2px] rounded-t-xl bg-[#9eff00]/60 blur-md animate-pulse z-0"></div>
            {/if}
            <button 
              on:click={() => activeTab = 'hardways'}
              class="relative w-full h-full flex items-center justify-between px-3 py-1.5 rounded-t-xl transition-all border-b-2 z-10
              bg-gradient-to-b from-zinc-100 to-zinc-300 border-white/20 shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.8)]
              {activeTab === 'hardways' ? 'ring-1 ring-[#9eff00]/50' : 'opacity-80'}"
            >
              <span class="text-[11px] font-black text-zinc-800 uppercase tracking-tight">HARDWAYS</span>
              <div class="bg-black/30 px-3 py-1 rounded shadow-inner text-[11px] font-black text-white border border-black/10 min-w-[60px] text-right">
                ${(getCategoryTotal('hard_') + getCategoryTotal('any_') + getCategoryTotal('horn_') + getCategoryTotal('bet_')).toFixed(2)}
              </div>
            </button>
          </div>
          <div class="flex-1 relative">
            {#if activeTab === 'hops'}
              <div class="absolute inset-[-2px] rounded-t-xl bg-[#9eff00]/60 blur-md animate-pulse z-0"></div>
            {/if}
            <button 
              on:click={() => activeTab = 'hops'}
              class="relative w-full h-full flex items-center justify-between px-3 py-1.5 rounded-t-xl transition-all border-b-2 z-10
              bg-gradient-to-b from-zinc-100 to-zinc-300 border-white/20 shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.8)]
              {activeTab === 'hops' ? 'ring-1 ring-[#9eff00]/50' : 'opacity-80'}"
            >
              <span class="text-[11px] font-black text-zinc-800 uppercase tracking-tight">HOP BETS</span>
              <div class="bg-black/30 px-3 py-1 rounded shadow-inner text-[11px] font-black text-white border border-black/10 min-w-[60px] text-right">
                ${getCategoryTotal('hop_').toFixed(2)}
              </div>
            </button>
          </div>
        </div>
        
        <!-- Tab Content Area -->
        <div class="bg-[#1a4d2e] rounded-2xl border-2 border-emerald-400/50 shadow-[0_0_40px_rgba(0,0,0,0.6),inset_0_0_30px_rgba(0,0,0,0.4)] p-1.5 flex-1 flex flex-col gap-1.5 relative overflow-hidden group">
          {#if activeTab === 'hardways'}
            <!-- HARDWAYS SECTION (Matching Image Exactly) -->
            <div class="flex flex-col flex-1 min-h-0">
              <div class="bg-[#0a2e0a]/80 py-1 text-center border-t border-b border-white/20 mb-2">
                <span class="text-[10px] font-black text-white uppercase tracking-widest">HARD WAYS <span class="opacity-70 font-bold">(# of rolls since last)</span></span>
              </div>
              
              <div class="grid grid-cols-2 gap-x-2 gap-y-2 h-[35%]">
                <!-- Left Half -->
                <div class="flex flex-col gap-2 border-r-2 border-white/20 pr-1">
                  <BetSpot 
                    id="hard_6" 
                    type="dice" 
                    dice={[3,3]} 
                    payout="9:1" 
                    hardwayCounter={hardwayCounters[6]}
                    className="flex-1 bg-[#1a4d2e] border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)] rounded-xl hover:bg-emerald-700/50 transition-colors" 
                    on:click={() => handlePlaceBet('hard_6')} 
                    on:contextmenu={(e) => handleRemoveBet('hard_6', e)} 
                    amount={bets.hard_6} 
                    status={betStatus.hard_6} 
                    isAutoOff={point === null} 
                  />
                  <BetSpot 
                    id="hard_8" 
                    type="dice" 
                    dice={[4,4]} 
                    payout="9:1" 
                    hardwayCounter={hardwayCounters[8]}
                    className="flex-1 bg-[#1a4d2e] border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)] rounded-xl hover:bg-emerald-700/50 transition-colors" 
                    on:click={() => handlePlaceBet('hard_8')} 
                    on:contextmenu={(e) => handleRemoveBet('hard_8', e)} 
                    amount={bets.hard_8} 
                    status={betStatus.hard_8} 
                    isAutoOff={point === null} 
                  />
                </div>
                <!-- Right Half -->
                <div class="flex flex-col gap-2 pl-1">
                  <BetSpot 
                    id="hard_10" 
                    type="dice" 
                    dice={[5,5]} 
                    payout="7:1" 
                    hardwayCounter={hardwayCounters[10]}
                    reverse={true}
                    className="flex-1 bg-[#1a4d2e] border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)] rounded-xl hover:bg-emerald-700/50 transition-colors" 
                    on:click={() => handlePlaceBet('hard_10')} 
                    on:contextmenu={(e) => handleRemoveBet('hard_10', e)} 
                    amount={bets.hard_10} 
                    status={betStatus.hard_10} 
                    isAutoOff={point === null} 
                  />
                  <BetSpot 
                    id="hard_4" 
                    type="dice" 
                    dice={[2,2]} 
                    payout="7:1" 
                    hardwayCounter={hardwayCounters[4]}
                    reverse={true}
                    className="flex-1 bg-[#1a4d2e] border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)] rounded-xl hover:bg-emerald-700/50 transition-colors" 
                    on:click={() => handlePlaceBet('hard_4')} 
                    on:contextmenu={(e) => handleRemoveBet('hard_4', e)} 
                    amount={bets.hard_4} 
                    status={betStatus.hard_4} 
                    isAutoOff={point === null} 
                  />
                </div>
              </div>

              <!-- ONE ROLL BETS SECTION (Matching Image Exactly) -->
              <div class="flex-1 flex flex-col mt-3 min-h-0">
                <div class="bg-[#0a2e0a]/80 py-1 text-center border-t border-b border-white/20">
                  <span class="text-[10px] font-black text-white uppercase tracking-widest">One Roll Bets</span>
                </div>
                
                <div class="flex-1 flex flex-col gap-2 mt-2">
                  <!-- SEVEN -->
                  <BetSpot 
                    id="any_7" 
                    className="h-[20%] bg-[#1a4d2e] border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)] rounded-xl flex flex-row items-center justify-between px-6 relative overflow-hidden" 
                    on:click={() => handlePlaceBet('any_7')} 
                    on:contextmenu={(e) => handleRemoveBet('any_7', e)} 
                    amount={bets.any_7}
                  >
                    <span class="text-base font-black text-white drop-shadow-md leading-none">4 TO 1</span>
                    <span class="text-xs font-black text-white/40">•</span>
                    <div class="flex-1 flex justify-center">
                      <span class="uppercase tracking-tighter leading-none text-[28px] font-black text-[#ff3b30] drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)] italic">SEVEN</span>
                    </div>
                    <span class="text-xs font-black text-white/40">•</span>
                    <span class="text-base font-black text-white drop-shadow-md leading-none">4 TO 1</span>
                  </BetSpot>

                  <!-- HORN BETS -->
                  <div class="flex-1 grid grid-cols-2 grid-rows-2 gap-px relative border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)] rounded-xl overflow-hidden">
                      <!-- Horn 2 -->
                      <BetSpot id="horn_2" type="dice" dice={[1,1]} payout="30 TO 1" className="bg-[#1a4d2e] border-emerald-400/20 hover:bg-emerald-700/40 transition-colors" on:click={() => handlePlaceBet('horn_2')} on:contextmenu={(e) => handleRemoveBet('horn_2', e)} amount={bets.horn_2} />
                      <!-- Horn 3 -->
                      <BetSpot id="horn_3" type="dice" dice={[1,2]} payout="15 TO 1" reverse={true} className="bg-[#1a4d2e] border-emerald-400/20 hover:bg-emerald-700/40 transition-colors" on:click={() => handlePlaceBet('horn_3')} on:contextmenu={(e) => handleRemoveBet('horn_3', e)} amount={bets.horn_3} />
                      <!-- Horn 12 -->
                      <BetSpot id="horn_12" type="dice" dice={[6,6]} payout="30 TO 1" className="bg-[#1a4d2e] border-emerald-400/20 hover:bg-emerald-700/40 transition-colors" on:click={() => handlePlaceBet('horn_12')} on:contextmenu={(e) => handleRemoveBet('horn_12', e)} amount={bets.horn_12} />
                      <!-- Horn 11 -->
                      <BetSpot id="horn_11" type="dice" dice={[5,6]} payout="15 TO 1" reverse={true} className="bg-[#1a4d2e] border-emerald-400/20 hover:bg-emerald-700/40 transition-colors" on:click={() => handlePlaceBet('horn_11')} on:contextmenu={(e) => handleRemoveBet('horn_11', e)} amount={bets.horn_11} />
                      
                      <!-- Horn Label Overlay -->
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <BetSpot 
                        id="horn_bet" 
                        className="bg-[#1a4d2e] border-2 border-emerald-400/50 px-4 py-1 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)] pointer-events-auto" 
                        on:click={() => handlePlaceBet('horn_bet')} 
                        on:contextmenu={(e) => handleRemoveBet('horn_bet', e)} 
                        amount={bets.horn_bet}
                      >
                        <span class="text-[11px] font-black text-white uppercase tracking-wider">Horn Bet</span>
                      </BetSpot>
                    </div>
                  </div>

                  <!-- ANY CRAPS -->
                  <div class="h-[20%] flex">
                    <BetSpot 
                      id="any_craps" 
                      className="flex-1 bg-[#1a4d2e] border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)] rounded-xl flex flex-row items-center justify-between px-4 relative overflow-hidden" 
                      on:click={() => handlePlaceBet('any_craps')} 
                      on:contextmenu={(e) => handleRemoveBet('any_craps', e)} 
                      amount={bets.any_craps}
                    >
                      <span class="text-sm font-black text-white drop-shadow-md leading-none">7:1</span>
                      <div class="flex-1 flex justify-center">
                        <span class="uppercase tracking-tighter leading-none text-xl font-black text-[#ff3b30] drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)] italic">ANY CRAPS</span>
                      </div>
                      <span class="text-sm font-black text-white drop-shadow-md leading-none">7:1</span>
                    </BetSpot>
                  </div>
                </div>
              </div>
            </div>
          {:else}
            <!-- HOP BETS TAB CONTENT (Matching Image Exactly) -->
            <div class="flex flex-col flex-1 min-h-0 gap-2">
              
              <!-- HOPPING HARD WAYS (31 FOR 1) -->
              <div class="flex flex-col h-[35%]">
                <div class="bg-[#0a2e0a]/80 py-1 flex items-center justify-between px-4 border-t border-b border-white/20 rounded-t-lg">
                  <span class="text-[9px] font-black text-white/60">31 FOR 1</span>
                  <span class="text-[10px] font-black text-white uppercase tracking-widest">• HOPPING HARD WAYS •</span>
                  <span class="text-[9px] font-black text-white/60">31 FOR 1</span>
                </div>
                
                <div class="flex-1 grid grid-cols-2 grid-rows-2 gap-1 mt-1">
                  <BetSpot id="hop_2_2" type="dice" dice={[2,2]} label="2-2" className="bg-[#1a4d2e] border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)] rounded-xl hover:bg-emerald-700/50 transition-colors" labelClassName="bg-[#1a4d2e] px-1.5 py-0.5 rounded border border-white/10" on:click={() => handlePlaceBet('hop_2_2')} on:contextmenu={() => handleRemoveBet('hop_2_2')} amount={bets.hop_2_2} />
                  <BetSpot id="hop_4_4" type="dice" dice={[4,4]} label="4-4" reverse={true} className="bg-[#1a4d2e] border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)] rounded-xl hover:bg-emerald-700/50 transition-colors" labelClassName="bg-[#1a4d2e] px-1.5 py-0.5 rounded border border-white/10" on:click={() => handlePlaceBet('hop_4_4')} on:contextmenu={() => handleRemoveBet('hop_4_4')} amount={bets.hop_4_4} />
                  <BetSpot id="hop_3_3" type="dice" dice={[3,3]} label="3-3" className="bg-[#1a4d2e] border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)] rounded-xl hover:bg-emerald-700/50 transition-colors" labelClassName="bg-[#1a4d2e] px-1.5 py-0.5 rounded border border-white/10" on:click={() => handlePlaceBet('hop_3_3')} on:contextmenu={() => handleRemoveBet('hop_3_3')} amount={bets.hop_3_3} />
                  <BetSpot id="hop_5_5" type="dice" dice={[5,5]} label="5-5" reverse={true} className="bg-[#1a4d2e] border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)] rounded-xl hover:bg-emerald-700/50 transition-colors" labelClassName="bg-[#1a4d2e] px-1.5 py-0.5 rounded border border-white/10" on:click={() => handlePlaceBet('hop_5_5')} on:contextmenu={() => handleRemoveBet('hop_5_5')} amount={bets.hop_5_5} />
                </div>
              </div>

              <!-- EASY HOP BETS (16 FOR 1) -->
              <div class="flex-1 flex flex-col min-h-0">
                <div class="bg-[#0a2e0a]/80 py-1 flex items-center justify-between px-4 border-t border-b border-white/20">
                  <span class="text-[9px] font-black text-white/60">16 FOR 1</span>
                  <span class="text-[10px] font-black text-white uppercase tracking-widest">• HOP BETS •</span>
                  <span class="text-[9px] font-black text-white/60">16 FOR 1</span>
                </div>

                <div class="flex-1 flex gap-1 mt-1 min-h-0">
                  <!-- Col 1 (1-3, 1-4, 2-3, 2-4, 1-5) -->
                  <div class="flex-1 flex flex-col gap-1">
                    {#each [[1,3,"1-3"], [1,4,"1-4"], [2,3,"2-3"], [2,4,"2-4"], [1,5,"1-5"]] as [d1, d2, label]}
                      <BetSpot id={`hop_${d1}_${d2}`} type="dice" dice={[d1, d2]} {label} className="flex-1 bg-[#1a4d2e] border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)] rounded-xl hover:bg-emerald-700/50 transition-colors" labelClassName="bg-[#1a4d2e] px-1.5 py-0.5 rounded border border-white/10" on:click={() => handlePlaceBet(`hop_${d1}_${d2}`)} on:contextmenu={() => handleRemoveBet(`hop_${d1}_${d2}`)} amount={bets[`hop_${d1}_${d2}`]} />
                    {/each}
                  </div>
                  <!-- Col 2 (1-6, 2-5, 3-4) -->
                  <div class="flex-1 flex flex-col gap-1 py-4">
                    {#each [[1,6,"1-6"], [2,5,"2-5"], [3,4,"3-4"]] as [d1, d2, label]}
                      <BetSpot id={`hop_${d1}_${d2}`} type="dice" dice={[d1, d2]} {label} className="flex-1 bg-[#1a4d2e] border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)] rounded-xl hover:bg-emerald-700/50 transition-colors flex-col gap-0 px-0" labelClassName="bg-[#1a4d2e] w-full text-center py-0.5 border-t border-white/10" on:click={() => handlePlaceBet(`hop_${d1}_${d2}`)} on:contextmenu={() => handleRemoveBet(`hop_${d1}_${d2}`)} amount={bets[`hop_${d1}_${d2}`]} />
                    {/each}
                  </div>
                  <!-- Col 3 (2-6, 3-5, 3-6, 4-5, 4-6) -->
                  <div class="flex-1 flex flex-col gap-1">
                    {#each [[2,6,"2-6"], [3,5,"3-5"], [3,6,"3-6"], [4,5,"4-5"], [4,6,"4-6"]] as [d1, d2, label]}
                      <BetSpot id={`hop_${d1}_${d2}`} type="dice" dice={[d1, d2]} {label} reverse={true} className="flex-1 bg-[#1a4d2e] border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)] rounded-xl hover:bg-emerald-700/50 transition-colors" labelClassName="bg-[#1a4d2e] px-1.5 py-0.5 rounded border border-white/10" on:click={() => handlePlaceBet(`hop_${d1}_${d2}`)} on:contextmenu={() => handleRemoveBet(`hop_${d1}_${d2}`)} amount={bets[`hop_${d1}_${d2}`]} />
                    {/each}
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>

      </div>

      <!-- Center: Main Grid & Control Column -->
      <div class="flex-1 flex flex-col gap-1 min-w-0">
        
        <!-- Buy/Place Numbers -->
        <div class="flex gap-1 h-[45%] relative">
          {#if betsOff}
            <div class="absolute inset-0 bg-red-900/10 backdrop-blur-[0.5px] z-10 flex items-center justify-center pointer-events-none overflow-hidden">
               <div class="flex gap-8">
                 {#each [1,2,3] as _}
                   <span class="text-[10px] font-black text-red-400/60 border border-red-400/40 px-3 py-1 rounded -rotate-12 bg-black/20 uppercase tracking-widest">Global Off</span>
                 {/each}
               </div>
            </div>
          {/if}
          {#each numbers as n}
              <div class="flex-1 flex flex-col gap-1 relative">
                <!-- Highlight border around the column when this number is the point -->
                {#if point === n}
                  <div class="absolute -inset-[3px] border-2 border-white rounded-lg pointer-events-none z-20"></div>
                {/if}
                
                <!-- Pass Line Point (Puck Area) -->
                <div class="h-[15%] bg-emerald-900/40 border border-white/5 rounded flex items-center justify-center relative overflow-hidden">
                  {#if point === n}
                    <!-- ON Puck -->
                    <div class="relative w-10 h-10 flex items-center justify-center">
                      <!-- Base soft glow -->
                      <div class="absolute inset-[-4px] rounded-full bg-[#9eff00]/60 blur-md animate-pulse z-0"></div>
                      
                      <!-- Breathing Rays (Eclipse Effect) -->
                      <div class="absolute inset-[-20px] rounded-full z-0 pointer-events-none">
                        <div class="absolute inset-0 animate-eclipse-rays"
                             style="background: repeating-conic-gradient(from 0deg, #9eff00 0deg 1deg, transparent 1deg 6deg);
                                    mask-image: radial-gradient(circle, black 30%, transparent 75%);
                                    -webkit-mask-image: radial-gradient(circle, black 30%, transparent 75%);"></div>
                      </div>

                      <!-- Secondary outer blur -->
                      <div class="absolute inset-[-12px] rounded-full bg-[#9eff00]/30 blur-2xl z-0"></div>
                      
                      <!-- Puck Body -->
                      <div class="relative w-full h-full rounded-full bg-white border-2 border-zinc-400 flex items-center justify-center shadow-[0_4px_8px_rgba(0,0,0,0.5),inset_0_2px_2px_rgba(255,255,255,1)] z-10 transform scale-90">
                        <!-- Black Inner Circle & Indented Area -->
                        <div class="w-7 h-7 rounded-full bg-white border border-black/10 flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
                          <span class="text-[10px] font-black text-zinc-800 uppercase drop-shadow-sm">ON</span>
                        </div>
                      </div>
                    </div>
                  {:else if point === null && n === 4} <!-- Just show one OFF puck when no point -->
                    <!-- OFF Puck -->
                    <div class="w-10 h-10 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center shadow-[0_4px_8px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.2)] transform scale-90">
                      <!-- Black Inner Circle & Indented Area -->
                      <div class="w-7 h-7 rounded-full bg-zinc-900 border border-black flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]">
                        <span class="text-[10px] font-black text-white/90 uppercase">OFF</span>
                      </div>
                    </div>
                  {/if}
                </div>

                <BetSpot id={`buy_${n}`} label="BUY" className="h-[16%] bg-emerald-700/50 border-2 border-emerald-400/50 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.4),inset_0_0_10px_rgba(0,0,0,0.3)]" labelClassName="leading-none" on:click={() => handlePlaceBet(`buy_${n}`)} on:contextmenu={(e) => handleRemoveBet(`buy_${n}`, e)} amount={bets[`buy_${n}`]} status={betStatus[`buy_${n}`]} isAutoOff={point === null} />
                <BetSpot id={`place_${n}`} label={n === 6 ? 'SIX' : n === 9 ? 'NINE' : n} type="number" className="flex-1 bg-[#0a2e0a]/80 border-2 border-emerald-400/50 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.5),inset_0_0_15px_rgba(0,0,0,0.4)]" on:click={() => handlePlaceBet(`place_${n}`)} on:contextmenu={(e) => handleRemoveBet(`place_${n}`, e)} amount={bets[`place_${n}`]} status={betStatus[`place_${n}`]} isAutoOff={point === null} />
                <div class="h-[18%] flex gap-1 relative">
                  <BetSpot id={`place_label_${n}`} label="PLACE" subLabel={formatOdds(n)} className="flex-1 bg-emerald-700/50 border-2 border-emerald-400/50 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.4),inset_0_0_10px_rgba(0,0,0,0.3)]" labelClassName="leading-none text-[9px]" on:click={() => handlePlaceBet(`place_${n}`)} on:contextmenu={(e) => handleRemoveBet(`place_${n}`, e)} amount={bets[`place_${n}`]} hideChips={true} status={betStatus[`place_${n}`]} isAutoOff={point === null} />
                  
                  <!-- Come Bet established on this number -->
                  {#if bets[`come_${n}`]}
                    <div class="absolute -top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                      <Chip value={bets[`come_${n}`]} size="w-10 h-10" fontSize="text-[8px]" betType="COME" />
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
        </div>

        <!-- Lower Section: Come, Field, Passline -->
        <div class="flex-1 flex gap-2">
          <!-- Column 1: Controls (Rectangles) -->
          <div class="w-24 flex flex-col gap-1 py-1 shrink-0">
            <button 
              on:click={() => betsOff = !betsOff}
              class="h-[16%] {betsOff ? 'bg-red-600 text-white' : 'bg-gradient-to-b from-zinc-100 to-zinc-300 text-zinc-800'} rounded-xl border-b-2 border-white/20 transition-all active:translate-y-1 shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.8)] text-[9px] font-black uppercase"
            >
              {betsOff ? 'Off' : 'Bets Off'}
            </button>
            <div class="h-[16%] relative group">
              {#if isPressAvailable}
                <!-- Base soft glow -->
                <div class="absolute inset-[-4px] rounded-xl bg-[#9eff00]/60 blur-md animate-pulse z-0"></div>
                
                <!-- Secondary outer blur -->
                <div class="absolute inset-[-8px] rounded-xl bg-[#9eff00]/20 blur-xl animate-pulse z-0"></div>
              {/if}
              <button 
                on:click={handlePress}
                class="relative w-full h-full bg-gradient-to-b from-zinc-100 to-zinc-300 text-zinc-800 rounded-xl border-b-2 border-white/20 transition-all active:translate-y-1 shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.8)] z-10 text-[9px] font-black uppercase
                       {isPressAvailable ? 'ring-1 ring-[#9eff00]/50' : 'opacity-60 cursor-not-allowed'}"
              >
                Press
              </button>
            </div>
            <div class="h-[16%] relative group">
              {#if isPressAvailable}
                <!-- Base soft glow -->
                <div class="absolute inset-[-4px] rounded-xl bg-[#9eff00]/60 blur-md animate-pulse z-0"></div>
                
                <!-- Secondary outer blur -->
                <div class="absolute inset-[-8px] rounded-xl bg-[#9eff00]/20 blur-xl animate-pulse z-0"></div>
              {/if}
              <button 
                on:click={handleAcross}
                class="relative w-full h-full bg-gradient-to-b from-zinc-100 to-zinc-300 text-zinc-800 rounded-xl border-b-2 border-white/20 transition-all active:translate-y-1 shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.8)] z-10 text-[9px] font-black uppercase
                       {isPressAvailable ? 'ring-1 ring-[#9eff00]/50' : 'opacity-60 cursor-not-allowed'}"
              >
                Across
              </button>
            </div>

            <!-- Moved C, CE, E buttons here -->
            <div class="flex-1 flex flex-col items-center justify-between py-1 shrink-0 mt-2">
              <BetSpot id="bet_c" label="C" className="w-12 h-12 rounded-full border-2 border-emerald-400/50 bg-[#1a4d2e] shadow-[0_4px_10px_rgba(0,0,0,0.5),inset_0_0_10px_rgba(0,0,0,0.3)] active:translate-y-0.5 active:shadow-inner transition-all" on:click={() => handlePlaceBet('bet_c')} on:contextmenu={() => handleRemoveBet('bet_c')} amount={bets.bet_c} />
              <BetSpot id="bet_ce" label="C&E" className="w-14 h-14 rounded-full border-2 border-emerald-400/50 bg-[#1a4d2e] shadow-[0_4px_10px_rgba(0,0,0,0.5),inset_0_0_10px_rgba(0,0,0,0.3)] active:translate-y-0.5 active:shadow-inner transition-all" on:click={() => handlePlaceBet('bet_ce')} on:contextmenu={() => handleRemoveBet('bet_ce')} amount={bets.bet_ce} />
              <BetSpot id="bet_e" label="E" className="w-12 h-12 rounded-full border-2 border-emerald-400/50 bg-[#1a4d2e] shadow-[0_4px_10px_rgba(0,0,0,0.5),inset_0_0_10px_rgba(0,0,0,0.3)] active:translate-y-0.5 active:shadow-inner transition-all" on:click={() => handlePlaceBet('bet_e')} on:contextmenu={() => handleRemoveBet('bet_e')} amount={bets.bet_e} />
            </div>
          </div>

          <!-- Column 3: Main Betting Spots -->
          <div class="flex-1 flex flex-col gap-2 min-w-0">
            <!-- COME -->
            <BetSpot id="come" className="h-[30%] bg-[#1a4d2e] rounded-xl border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)] flex items-center justify-center" on:click={() => handlePlaceBet('come')} on:contextmenu={(e) => handleRemoveBet('come', e)} amount={bets.come}>
              <span class="text-5xl font-black italic text-[#ff3b30] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] uppercase tracking-tighter">COME</span>
            </BetSpot>

            <!-- FIELD -->
            <BetSpot id="field" className="h-[42%] bg-[#1a4d2e]/60 rounded-xl border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)]" on:click={() => handlePlaceBet('field')} on:contextmenu={(e) => handleRemoveBet('field', e)} amount={bets.field}>
              <div class="flex flex-col items-center justify-center w-full h-full py-2">
                <!-- Numbers Row -->
                <div class="flex items-end justify-center w-full px-4 text-white font-black gap-3 relative -mt-3">
                  <!-- 2 -->
                  <div class="flex flex-col items-center translate-y-0.5 mx-3">
                    <div class="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-xl shadow-lg bg-black/30">2</div>
                    <span class="text-[11px] font-black uppercase mt-1 leading-none">PAYS DOUBLE</span>
                  </div>
                  
                  <span class="text-xl opacity-80 translate-y-[-4px] mx-1.5">•</span>
                  <span class="text-3xl drop-shadow-md translate-y-[-8px]">3</span>
                  
                  <span class="text-xl opacity-80 translate-y-[-11px] mx-1.5">•</span>
                  <span class="text-3xl drop-shadow-md -translate-y-[14px]">4</span>
                  
                  <span class="text-xl opacity-80 translate-y-[-17px] mx-1.5">•</span>
                  <div class="flex flex-col items-center -translate-y-[20px] relative">
                    <span class="text-4xl drop-shadow-xl text-white">9</span>
                    <!-- FIELD text exactly as in image -->
                    <div class="absolute top-[42px] left-1/2 -translate-x-1/2 flex flex-col items-center">
                      <span class="text-2xl font-black text-white tracking-normal leading-none">FIELD</span>
                    </div>
                  </div>
                  <span class="text-xl opacity-80 translate-y-[-17px] mx-1.5">•</span>
                  
                  <span class="text-3xl drop-shadow-md -translate-y-[14px]">10</span>
                  <span class="text-xl opacity-80 translate-y-[-11px] mx-1.5">•</span>
                  
                  <span class="text-3xl drop-shadow-md translate-y-[-8px]">11</span>
                  <span class="text-xl opacity-80 translate-y-[-4px] mx-1.5">•</span>
                  
                  <!-- 12 -->
                  <div class="flex flex-col items-center translate-y-0.5 mx-3">
                    <div class="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-xl shadow-lg bg-black/30">12</div>
                    <span class="text-[11px] font-black uppercase mt-1 leading-none">PAYS DOUBLE</span>
                  </div>
                </div>
              </div>
            </BetSpot>

            <!-- PASS LINE / TAKE ODDS -->
            <div class="h-[28%] flex gap-2">
              <BetSpot id="take_odds" className="w-[25%] bg-[#1a4d2e] rounded-xl border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)] flex items-center justify-center px-2" on:click={() => handlePlaceBet('take_odds')} on:contextmenu={(e) => handleRemoveBet('take_odds', e)} amount={bets.take_odds}>
                <span class="text-[11px] font-black text-white leading-tight text-center uppercase tracking-tighter">TAKE<br/>ODDS</span>
              </BetSpot>
              <BetSpot id="passline" className="flex-1 bg-[#1a4d2e] rounded-xl border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)] flex items-center justify-center" on:click={() => handlePlaceBet('passline')} on:contextmenu={(e) => handleRemoveBet('passline', e)} amount={bets.passline} isLocked={point !== null}>
                <span class="text-4xl font-serif italic text-white font-medium tracking-widest drop-shadow-lg">Pass Line</span>
              </BetSpot>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom: History & Chips -->
  <div class="h-24 shrink-0 flex flex-col gap-2">
    <!-- History Scroll -->
    <div class="h-10 bg-[#1a4d2e] rounded-xl border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.4),inset_0_0_15px_rgba(0,0,0,0.3)] flex items-center px-3 gap-4 overflow-x-auto whitespace-nowrap scrollbar-hide relative group">
      {#each lastRolls as { dice: [d1, d2], total, establishesPoint }, i}
        <div class="flex items-center gap-1.5 {i === 0 ? 'opacity-100' : 'opacity-40'}">
          <div class="w-6 h-6 rounded flex items-center justify-center text-[10px] font-black border
                      {total === 7 
                        ? 'bg-red-600 border-red-500 text-white' 
                        : (establishesPoint 
                            ? 'bg-blue-600 border-blue-500 text-white' 
                            : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400')}"
          >
            {total}
          </div>
          <div class="flex gap-2 scale-90">
             {#each [d1, d2] as d}
               <div class="w-4 h-4 bg-white rounded-[2px] relative shadow-inner">
                 {#each diceDots[d] as dot}
                   <div class="absolute w-[18%] h-[18%] bg-zinc-900 rounded-full" 
                        style="left: {(dot % 3) * 25 + 16}%; top: {Math.floor(dot / 3) * 25 + 16}%"></div>
                 {/each}
               </div>
             {/each}
          </div>
        </div>
      {/each}
    </div>

    <!-- Chip Selector & Controls -->
    <div class="flex-1 bg-[#1a4d2e] rounded-xl border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)] flex items-center justify-between px-6 backdrop-blur-xl">
        <div class="flex gap-2">
          <button on:click={clearBets} class="px-4 py-2 bg-gradient-to-b from-zinc-100 to-zinc-300 rounded-xl border-b-2 border-white/20 flex items-center gap-2 text-zinc-800 shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.8)] hover:scale-105 transition-transform active:scale-95 group">
            <div class="w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center group-hover:rotate-180 transition-transform duration-500 shadow-sm">
              <RotateCcw size={12} color="white" />
            </div>
            <div class="flex flex-col items-start leading-none">
              <span class="text-[9px] font-black uppercase tracking-tighter">Take Down</span>
              <span class="text-[8px] font-bold opacity-80 text-red-600">ALL BETS</span>
            </div>
          </button>
        </div>

        <div class="flex items-center gap-2">
          {#each [1, 2, 3, 5, 10, 25, 50, 100] as value}
            <button 
              on:click={() => {
                selectedChip = value;
                playChipSound('select');
              }}
              class="relative"
            >
              <Chip {value} selected={selectedChip === value} />
            </button>
          {/each}
        </div>

        <div class="flex gap-2">
          <button class="px-3 py-2 bg-gradient-to-b from-zinc-100 to-zinc-300 rounded-xl border-b-2 border-white/20 flex items-center gap-1.5 text-zinc-800 shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.8)] hover:scale-105 transition-transform active:scale-95">
            <div class="w-4 h-4 rounded-full bg-zinc-800/20 flex items-center justify-center text-[8px] font-black text-zinc-800 border border-zinc-800/30">x2</div>
            <div class="flex flex-col items-start leading-none">
              <span class="text-[8px] font-black uppercase">Double</span>
              <span class="text-[7px] font-bold opacity-70">Bet</span>
            </div>
          </button>
          <button class="px-3 py-2 bg-gradient-to-b from-zinc-100 to-zinc-300 rounded-xl border-b-2 border-white/20 flex items-center gap-1.5 text-zinc-800 shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.8)] hover:scale-105 transition-transform active:scale-95">
            <div class="w-4 h-4 rounded-full bg-zinc-800/20 flex items-center justify-center border border-zinc-800/30">
              <RotateCcw size={10} color="#27272a" />
            </div>
            <div class="flex flex-col items-start leading-none">
              <span class="text-[8px] font-black uppercase">Repeat</span>
              <span class="text-[7px] font-bold opacity-70">Last Bet</span>
            </div>
          </button>
          <button 
            on:click={handleManualRoll}
            disabled={rolling || !betsAreValid}
            class="px-8 py-2 bg-[#1a4d2e] text-white rounded-xl border-2 border-emerald-400/50 text-xs font-black uppercase shadow-[0_0_20px_rgba(52,211,153,0.3),inset_0_0_15px_rgba(0,0,0,0.4)] hover:shadow-[0_0_30px_rgba(52,211,153,0.5)] hover:bg-emerald-800 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
          >
            {rolling ? 'Rolling' : 'Roll'}
          </button>
        </div>
      </div>
    </div>
  </div>

</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #000;
  }
  
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  @keyframes eclipse-spin-breath {
    0% { transform: rotate(0deg) scale(0.8); opacity: 0.4; }
    50% { transform: rotate(180deg) scale(1.1); opacity: 0.9; }
    100% { transform: rotate(360deg) scale(0.8); opacity: 0.4; }
  }
  .animate-eclipse-rays {
    animation: eclipse-spin-breath 5s linear infinite;
  }
  .border-text-stroke {
    -webkit-text-stroke: 1.5px rgba(0,0,0,0.5);
  }
</style>
