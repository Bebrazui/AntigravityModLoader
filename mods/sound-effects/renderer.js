// @ts-check
(function() {
  console.log('[Sound Effects Mod] Initialized.');

  // Web Audio API Synthesizer (Zero external audio files needed!)
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  function playClick() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.04);
  }

  function playSuccessChime() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major arpeggio
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      }, i * 65);
    });
  }

  // Play click on sidebar navigation or buttons
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target && (target.closest('button') || target.closest('[role="button"]') || target.closest('a'))) {
      playClick();
    }
  }, true);

  // Expose sound triggers to other mods
  window.AntigravityAudio = {
    click: playClick,
    chime: playSuccessChime
  };
})();
