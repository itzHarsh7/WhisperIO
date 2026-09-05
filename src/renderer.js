// Global Startup Error Catchers
window.addEventListener('error', (event) => {
  const errMsg = `Unhandled JS Error: ${event.error ? event.error.message : event.message}\nStack: ${event.error ? event.error.stack : 'N/A'}`;
  console.error(errMsg);
  alert(errMsg);
});

window.addEventListener('unhandledrejection', (event) => {
  const rejectMsg = `Unhandled Promise Rejection: ${event.reason}`;
  console.error(rejectMsg);
  alert(rejectMsg);
});

let config = {};
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordStartTime = null;
let timerInterval = null;

// Web Audio API variables for visualizer and sounds
let audioContext = null;
let analyser = null;
let dataArray = null;
let bufferLength = 0;
let micStream = null;

// DOM Elements
const appContainer = document.getElementById('app-container');
const micBtn = document.getElementById('mic-btn');
const iconMic = micBtn.querySelector('.icon-mic');
const iconStop = micBtn.querySelector('.icon-stop');
const statusText = document.getElementById('status-text');
const timerText = document.getElementById('timer');
const canvas = document.getElementById('waveform');
const ctx = canvas.getContext('2d');
const pinBtn = document.getElementById('pin-btn');
const settingsBtn = document.getElementById('settings-btn');
const hideBtn = document.getElementById('hide-btn');

// Settings Panel Elements
const settingsPanel = document.getElementById('settings-panel');
const apiKeyInput = document.getElementById('api-key');
const toggleApiKeyBtn = document.getElementById('toggle-api-key');
const modelSelect = document.getElementById('model-select');
const audioSelect = document.getElementById('audio-select');
const themeSelect = document.getElementById('theme-select');
const casingSelect = document.getElementById('casing-select');
const cleanStuttersToggle = document.getElementById('clean-stutters-toggle');
const shortcutInput = document.getElementById('shortcut-input');
const autopasteToggle = document.getElementById('autopaste-toggle');
const copyClipboardToggle = document.getElementById('copy-clipboard-toggle');
const soundToggle = document.getElementById('sound-toggle');
const btnCancel = document.getElementById('btn-cancel');
const btnSave = document.getElementById('btn-save');

// Whisper-style Mini-Pill State & Auto-Contract Logic
let isHovered = false;
let hoverTimeout = null;
let isMiniMode = false;
let stateTimeout = null;
let statusTimeout = null;

function clearPendingStateTimers() {
  if (stateTimeout) {
    clearTimeout(stateTimeout);
    stateTimeout = null;
  }
  if (statusTimeout) {
    clearTimeout(statusTimeout);
    statusTimeout = null;
  }
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
    hoverTimeout = null;
  }
}

function resetToIdle() {
  clearPendingStateTimers();
  isRecording = false;
  appContainer.className = 'app-idle';
  statusText.innerText = 'Ready to record';
  timerText.classList.add('hidden');
  canvas.classList.add('hidden');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  iconStop.classList.add('hidden');
  iconMic.classList.remove('hidden');

  if (!settingsPanel.classList.contains('hidden')) {
    closeSettings();
  } else if (!config.pinned && !isHovered) {
    enterMiniMode();
  } else {
    window.api.resizeWindow(480, 75);
  }
}

function enterMiniMode() {
  // Don't shrink if app is active (listening, processing, success, or error)
  if (isRecording || 
      appContainer.classList.contains('app-processing') || 
      appContainer.classList.contains('app-listening') || 
      appContainer.classList.contains('app-success') || 
      appContainer.classList.contains('app-error')) {
    return;
  }
  // Don't shrink if pinned or settings are open
  if (config.pinned || !settingsPanel.classList.contains('hidden')) {
    return;
  }

  isMiniMode = true;
  appContainer.className = 'app-idle app-mini';
  // Resize Electron window to compact Whisper mini capsule
  window.api.resizeWindow(110, 36);
}

function exitMiniMode() {
  if (!isMiniMode) return;
  isMiniMode = false;
  appContainer.classList.remove('app-mini');
  if (settingsPanel.classList.contains('hidden')) {
    window.api.resizeWindow(480, 75);
  } else {
    window.api.resizeWindow(480, 470);
  }
}

// Initialization
async function init() {
  config = await window.api.getConfig();
  applyConfigUI();
  populateAudioDevices();

  // Register Electron IPC listeners
  window.api.onToggleRecordShortcut(() => {
    toggleRecording();
  });

  window.api.onCheckCanHide(() => {
    // Hide window only if not currently recording or transcribing
    if (!isRecording && !appContainer.classList.contains('app-processing')) {
      window.api.hideWindow();
    }
  });

  window.api.onOpenSettings(() => {
    openSettings();
  });

  // Auto-contract to Mini-Pill after 2.5 seconds on launch
  setTimeout(() => {
    if (!isHovered) {
      enterMiniMode();
    }
  }, 2500);
}

// Update UI with stored configuration
function applyConfigUI() {
  apiKeyInput.value = config.groqApiKey || '';
  modelSelect.value = config.model || 'whisper-large-v3';
  shortcutInput.value = config.globalShortcut || 'Ctrl+Shift+Space';
  themeSelect.value = config.theme || 'purple';
  casingSelect.value = config.casing || 'default';
  cleanStuttersToggle.checked = config.cleanStutters !== false;
  autopasteToggle.checked = config.autoPaste !== false;
  copyClipboardToggle.checked = config.copyToClipboard !== false;
  soundToggle.checked = config.soundFeedback !== false;
  
  appContainer.setAttribute('data-theme', config.theme || 'purple');

  if (config.pinned) {
    pinBtn.classList.add('active');
  } else {
    pinBtn.classList.remove('active');
  }
}

// Populate audio input options
async function populateAudioDevices() {
  try {
    // Request temporary permission to get label access
    await navigator.mediaDevices.getUserMedia({ audio: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');
    
    // Clear and populate dropdown
    audioSelect.innerHTML = '';
    audioInputs.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `Microphone ${audioSelect.length + 1}`;
      audioSelect.appendChild(option);
    });

    if (config.audioDeviceId) {
      audioSelect.value = config.audioDeviceId;
    }
  } catch (err) {
    console.error('Failed to get audio devices:', err);
    statusText.innerText = 'Microphone access denied!';
  }
}

// SYNTHESIZE PREMIUM SOUND CUES (Pure Web Audio API Oscillators)
function playSoundCue(type) {
  if (config.soundFeedback === false) return;

  try {
    const ctxSound = new (window.AudioContext || window.webkitAudioContext)();
    
    if (type === 'start') {
      // Sleek ascending chime
      const osc1 = ctxSound.createOscillator();
      const osc2 = ctxSound.createOscillator();
      const gainNode = ctxSound.createGain();
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctxSound.destination);
      
      osc1.type = 'sine';
      osc2.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, ctxSound.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.12, ctxSound.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctxSound.currentTime + 0.3);
      
      osc1.frequency.setValueAtTime(523.25, ctxSound.currentTime); // C5
      osc1.frequency.exponentialRampToValueAtTime(783.99, ctxSound.currentTime + 0.15); // G5
      
      osc2.frequency.setValueAtTime(659.25, ctxSound.currentTime + 0.05); // E5
      osc2.frequency.exponentialRampToValueAtTime(1046.50, ctxSound.currentTime + 0.2); // C6
      
      osc1.start();
      osc2.start(ctxSound.currentTime + 0.05);
      
      osc1.stop(ctxSound.currentTime + 0.35);
      osc2.stop(ctxSound.currentTime + 0.35);
    } 
    else if (type === 'success') {
      // Sparkly clean double success tone
      const osc = ctxSound.createOscillator();
      const gainNode = ctxSound.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(ctxSound.destination);
      
      osc.type = 'triangle';
      
      gainNode.gain.setValueAtTime(0, ctxSound.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, ctxSound.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.05, ctxSound.currentTime + 0.12);
      gainNode.gain.linearRampToValueAtTime(0.15, ctxSound.currentTime + 0.16);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctxSound.currentTime + 0.45);
      
      osc.frequency.setValueAtTime(880.00, ctxSound.currentTime); // A5
      osc.frequency.setValueAtTime(1318.51, ctxSound.currentTime + 0.15); // E6
      
      osc.start();
      osc.stop(ctxSound.currentTime + 0.5);
    } 
    else if (type === 'error') {
      // Descending mechanical error warning
      const osc = ctxSound.createOscillator();
      const gainNode = ctxSound.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(ctxSound.destination);
      
      osc.type = 'sawtooth';
      
      gainNode.gain.setValueAtTime(0, ctxSound.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.08, ctxSound.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctxSound.currentTime + 0.4);
      
      osc.frequency.setValueAtTime(329.63, ctxSound.currentTime); // E4
      osc.frequency.linearRampToValueAtTime(196.00, ctxSound.currentTime + 0.3); // G3
      
      osc.start();
      osc.stop(ctxSound.currentTime + 0.45);
    }
  } catch (err) {
    console.error('Failed to synthesize sound:', err);
  }
}

// TOGGLE RECORDING LOGIC
async function toggleRecording() {
  exitMiniMode(); // Ensure we expand fully before starting recording!
  if (isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
}

// START MICROPHONE AUDIO CAPTURE
async function startRecording() {
  if (isRecording || appContainer.classList.contains('app-processing')) return;

  clearPendingStateTimers();

  // Always close settings panel if open before starting recording!
  if (!settingsPanel.classList.contains('hidden')) {
    closeSettings();
  }
  
  // Validation check: Warn user if Groq Key is missing
  if (!config.groqApiKey) {
    playSoundCue('error');
    statusText.innerText = 'Error: Enter Groq API Key first!';
    appContainer.className = 'app-error';
    openSettings();
    return;
  }

  try {
    audioChunks = [];
    const deviceId = audioSelect.value;
    const constraints = {
      audio: deviceId === 'default' ? true : { deviceId: { exact: deviceId } }
    };

    micStream = await navigator.mediaDevices.getUserMedia(constraints);
    mediaRecorder = new MediaRecorder(micStream, { mimeType: 'audio/webm' });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      console.log('mediaRecorder.onstop fired! Flushing buffers and terminating audio hardware tracks...');
      
      // Gracefully stop all mic hardware tracks inside the callback
      if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
      }
      if (audioContext) {
        audioContext.close().catch(() => {});
      }

      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      console.log('Audio blob created successfully. Size:', audioBlob.size, 'bytes');
      await processAudioWithGroq(audioBlob);
    };

    // Start recording audio data!
    mediaRecorder.start();

    // Set up real-time audio wave analysis
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(micStream);
    source.connect(analyser);
    analyser.fftSize = 256;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    // Switch UI to Listening mode
    isRecording = true;
    appContainer.className = 'app-listening';
    iconMic.classList.add('hidden');
    iconStop.classList.remove('hidden');
    timerText.classList.remove('hidden');
    canvas.classList.remove('hidden');
    
    playSoundCue('start');
    
    // Start visual timer
    recordStartTime = Date.now();
    statusText.innerText = 'Listening...';
    updateTimer();
    timerInterval = setInterval(updateTimer, 500);

    // Run Waveform Canvas loop
    drawWaveform();
  } catch (err) {
    console.error('Recording initialization failed:', err);
    playSoundCue('error');
    statusText.innerText = 'Mic Access Failed!';
    appContainer.className = 'app-error';
    stateTimeout = setTimeout(() => {
      resetToIdle();
    }, 4000);
  }
}

// STOP MICROPHONE AUDIO CAPTURE
function stopRecording() {
  if (!isRecording) return;
  isRecording = false;

  clearInterval(timerInterval);
  timerText.classList.add('hidden');
  canvas.classList.add('hidden');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  iconStop.classList.add('hidden');
  iconMic.classList.remove('hidden');

  // Change state to Processing
  appContainer.className = 'app-processing';
  statusText.innerText = 'Transcribing...';

  // Gracefully terminate MediaRecorder (onstop event will clean up tracks)
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

// GET DYNAMIC WAVE PALETTE ACCORDING TO SELECTED THEME
function getWaveThemeColors() {
  const theme = config.theme || 'purple';
  switch (theme) {
    case 'sunset':
      return [
        'rgba(251, 146, 60, 0.9)',
        'rgba(244, 63, 94, 0.8)',
        'rgba(234, 179, 8, 0.85)',
        'rgba(251, 113, 133, 0.6)',
        'rgba(253, 186, 116, 0.4)'
      ];
    case 'emerald':
      return [
        'rgba(52, 211, 153, 0.9)',
        'rgba(20, 184, 166, 0.8)',
        'rgba(16, 185, 129, 0.85)',
        'rgba(110, 231, 183, 0.6)',
        'rgba(45, 212, 191, 0.4)'
      ];
    case 'ocean':
      return [
        'rgba(56, 189, 248, 0.9)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(6, 182, 212, 0.85)',
        'rgba(125, 211, 252, 0.6)',
        'rgba(147, 197, 253, 0.4)'
      ];
    case 'monochrome':
      return [
        'rgba(255, 255, 255, 0.95)',
        'rgba(203, 213, 225, 0.85)',
        'rgba(148, 163, 184, 0.8)',
        'rgba(226, 232, 240, 0.6)',
        'rgba(241, 245, 249, 0.4)'
      ];
    default: // purple
      return [
        'rgba(168, 85, 247, 0.9)',
        'rgba(236, 72, 153, 0.8)',
        'rgba(99, 102, 241, 0.85)',
        'rgba(192, 132, 252, 0.6)',
        'rgba(129, 140, 248, 0.4)'
      ];
  }
}

// DRAW MULTI-LAYER SIRI ORGANIC GLOWING WAVE VISUALIZER
function drawWaveform() {
  if (!isRecording) return;
  requestAnimationFrame(drawWaveform);

  analyser.getByteTimeDomainData(dataArray);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const colors = getWaveThemeColors();

  // Calculate volume root-mean-square
  let sum = 0;
  for (let i = 0; i < bufferLength; i++) {
    const v = (dataArray[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / bufferLength);
  const volume = Math.max(0.12, rms * 5.2); // Smooth responsive amplification

  const time = Date.now() * 0.008;

  // Layer 5 distinct organic siri waves
  for (let w = 0; w < 5; w++) {
    ctx.beginPath();
    ctx.lineWidth = w === 0 ? 2.8 : (w === 1 ? 2.0 : 1.2);
    ctx.strokeStyle = colors[w];
    
    // Add glowing bloom shadow for primary waves
    if (w < 2) {
      ctx.shadowBlur = 6;
      ctx.shadowColor = colors[0];
    } else {
      ctx.shadowBlur = 0;
    }
    
    const phaseOffset = w * (Math.PI / 3);
    const speedMultiplier = 1 + w * 0.25;

    for (let x = 0; x < canvas.width; x++) {
      const progress = x / canvas.width;
      
      // Smooth bell curve envelope
      const envelope = Math.sin(progress * Math.PI);
      
      // Dual harmonic sine wave equation
      const freq1 = progress * Math.PI * 4 + time * speedMultiplier + phaseOffset;
      const freq2 = progress * Math.PI * 8 - time * 0.5;
      
      const y = (Math.sin(freq1) * 0.7 + Math.cos(freq2) * 0.3) * 
                (canvas.height / 2.2) * volume * envelope + (canvas.height / 2);
      
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  
  // Reset shadow for next frame
  ctx.shadowBlur = 0;
}

// FORMAT & UPDATE TIMER
function updateTimer() {
  const diff = Date.now() - recordStartTime;
  const sec = Math.floor(diff / 1000) % 60;
  const min = Math.floor(diff / 60000);
  timerText.innerText = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

// TEXT FORMATTING & CASE TRANSFORMATION HELPER
function formatTranscriptionText(rawText) {
  let text = rawText ? rawText.trim() : '';
  if (!text) return '';

  const casingMode = config.casing || 'default';
  if (casingMode === 'lowercase') {
    text = text.toLowerCase();
  } else if (casingMode === 'uppercase') {
    text = text.toUpperCase();
  } else if (casingMode === 'titlecase') {
    text = text.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
  }

  return text;
}

// SUBMIT AUDIO BLOB TO GROQ
async function processAudioWithGroq(audioBlob) {
  console.log('processAudioWithGroq() started! Blob size:', audioBlob.size, 'bytes. API key length:', config.groqApiKey ? config.groqApiKey.length : 0);
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'voice.webm');
    formData.append('model', config.model);
    formData.append('temperature', '0.0'); // Greedy deterministic decoding prevents repetitive hallucination loops

    // Dynamic prompt based on Smart Clean-up setting
    if (config.cleanStutters !== false) {
      formData.append(
        'prompt',
        'This is a clean, professional, and fluent transcription of spoken English. Automatically remove all verbal stutters, false starts, filler words (such as "um", "uh", "like", "you know"), and any repeated words or repeated phrases. Format the final output as clear, polished, and grammatically correct English.'
      );
    } else {
      formData.append(
        'prompt',
        'Transcribe exact spoken words into text with clean grammar and proper punctuation.'
      );
    }

    console.log('Sending audio payload to Groq API with model:', config.model);
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.groqApiKey}`
      },
      body: formData
    });

    console.log('Groq API response received! HTTP Status:', response.status, response.statusText);

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Groq API Error: ${response.status} - ${details}`);
    }

    console.log('Successfully received HTTP 200 from Groq. Parsing JSON text...');
    const data = await response.json();
    const rawResultText = data.text;
    console.log('Parsed raw text successfully:', rawResultText);

    const finalFormattedText = formatTranscriptionText(rawResultText);

    if (finalFormattedText && finalFormattedText.trim() !== '') {
      // Transition to Success state
      playSoundCue('success');
      appContainer.className = 'app-success';
      statusText.innerText = 'Copied & Pasted!';

      // Trigger native paste
      console.log('Sending text paste command to main process: ipcMain trigger-paste');
      window.api.triggerPaste(finalFormattedText);

      // Auto dismiss success window after 1.8 seconds
      stateTimeout = setTimeout(() => {
        resetToIdle();
      }, 1800);

    } else {
      throw new Error('No voice transcription caught!');
    }

  } catch (err) {
    console.error('Groq transcription execution failed:', err);
    playSoundCue('error');
    appContainer.className = 'app-error';
    statusText.innerText = err.message || 'Transcription failed!';

    // Revert to idle after 4 seconds to view error description
    stateTimeout = setTimeout(() => {
      resetToIdle();
    }, 4000);
  }
}

// UI EVENT COORDINATORS

// Settings drawer transitions
function openSettings() {
  clearPendingStateTimers();
  if (isRecording) {
    stopRecording();
  }
  exitMiniMode();
  appContainer.classList.add('app-settings-open');
  settingsPanel.classList.remove('hidden');
  settingsBtn.classList.add('active');
  window.api.resizeWindow(480, 540);
}

function closeSettings() {
  clearPendingStateTimers();
  appContainer.classList.remove('app-settings-open');
  settingsPanel.classList.add('hidden');
  settingsBtn.classList.remove('active');
  if (!isRecording && !appContainer.classList.contains('app-processing')) {
    window.api.resizeWindow(480, 75);
  }
}

// Settings toggle API key visibility
toggleApiKeyBtn.addEventListener('click', () => {
  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    toggleApiKeyBtn.innerText = 'Hide';
  } else {
    apiKeyInput.type = 'password';
    toggleApiKeyBtn.innerText = 'Show';
  }
});

// Settings save action
btnSave.addEventListener('click', async () => {
  clearPendingStateTimers();
  const newConfig = {
    groqApiKey: apiKeyInput.value.trim(),
    model: modelSelect.value,
    globalShortcut: shortcutInput.value,
    theme: themeSelect.value,
    casing: casingSelect.value,
    cleanStutters: cleanStuttersToggle.checked,
    autoPaste: autopasteToggle.checked,
    copyToClipboard: copyClipboardToggle.checked,
    soundFeedback: soundToggle.checked,
    audioDeviceId: audioSelect.value
  };

  config = await window.api.saveConfig(newConfig);
  appContainer.setAttribute('data-theme', config.theme || 'purple');
  closeSettings();
  statusText.innerText = 'Settings saved!';
  statusTimeout = setTimeout(() => {
    if (appContainer.classList.contains('app-idle')) {
      statusText.innerText = 'Ready to record';
    }
  }, 2000);
});

// Settings cancel action
btnCancel.addEventListener('click', () => {
  applyConfigUI();
  closeSettings();
});

// Settings gear trigger
settingsBtn.addEventListener('click', () => {
  console.log('Settings button clicked! Panel hidden state:', settingsPanel.classList.contains('hidden'));
  if (settingsPanel.classList.contains('hidden')) {
    openSettings();
  } else {
    closeSettings();
  }
});

// Always on top Pin action
pinBtn.addEventListener('click', () => {
  const isPinned = !config.pinned;
  config.pinned = isPinned;
  window.api.togglePin(isPinned);
  
  if (isPinned) {
    pinBtn.classList.add('active');
    pinBtn.title = 'Unpin Window';
  } else {
    pinBtn.classList.remove('active');
    pinBtn.title = 'Pin Always on Top';
  }
});

// Hide button trigger
hideBtn.addEventListener('click', () => {
  window.api.hideWindow();
});

// Toggle mic on button click
micBtn.addEventListener('click', () => {
  toggleRecording();
});

// GLOBAL KEYBOARD HOTKEY CAPTURER
let isRecordingShortcut = false;

shortcutInput.addEventListener('focus', () => {
  isRecordingShortcut = true;
  shortcutInput.value = 'Press keys to capture...';
  shortcutInput.style.borderColor = 'hsl(265, 85%, 65%)';
});

shortcutInput.addEventListener('keydown', (e) => {
  if (!isRecordingShortcut) return;
  e.preventDefault();
  
  const pressedKeys = [];
  if (e.ctrlKey) pressedKeys.push('Ctrl');
  if (e.shiftKey) pressedKeys.push('Shift');
  if (e.altKey) pressedKeys.push('Alt');
  if (e.metaKey) pressedKeys.push('CommandOrControl'); // Electron crossplatform key name
  
  const keyName = e.key;
  if (keyName !== 'Control' && keyName !== 'Shift' && keyName !== 'Alt' && keyName !== 'OS') {
    if (keyName === ' ') {
      pressedKeys.push('Space');
    } else {
      // Capitalize first character
      const cleanKey = keyName.charAt(0).toUpperCase() + keyName.slice(1);
      pressedKeys.push(cleanKey);
    }
  }

  if (pressedKeys.length > 0) {
    // Normalise CommandOrControl to Ctrl for cleaner viewing, but keep it standard
    let shortcutString = pressedKeys.join('+');
    shortcutInput.value = shortcutString;
  }
});

shortcutInput.addEventListener('blur', () => {
  isRecordingShortcut = false;
  shortcutInput.style.borderColor = '';
  if (shortcutInput.value === 'Press keys to capture...') {
    shortcutInput.value = config.globalShortcut || 'Ctrl+Shift+Space';
  }
});

// Register hover triggers for Whisper-style Mini-Pill
document.body.addEventListener('mouseenter', () => {
  isHovered = true;
  clearTimeout(hoverTimeout);
  exitMiniMode();
});

document.body.addEventListener('mouseleave', () => {
  isHovered = false;
  clearTimeout(hoverTimeout);
  hoverTimeout = setTimeout(() => {
    enterMiniMode();
  }, 400); // 400ms delay to feel smooth and intentional
});

// Fire init
init();
