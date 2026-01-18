/**
 * Sonara - Offscreen Audio Player
 * Handles background audio playback that continues when popup is closed
 */

let currentBookmarkId = null;
let currentAudioUrl = null;
let audioPlayer = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  audioPlayer = document.getElementById('audioPlayer');
  
  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sendResponse);
    return true; // Keep channel open for async response
  });
  
  // Send playback state updates
  audioPlayer.addEventListener('play', () => {
    sendStateUpdate('playing');
  });
  
  audioPlayer.addEventListener('pause', () => {
    sendStateUpdate('paused');
  });
  
  audioPlayer.addEventListener('ended', () => {
    sendStateUpdate('ended');
  });
  
  audioPlayer.addEventListener('timeupdate', () => {
    sendTimeUpdate();
  });
  
  audioPlayer.addEventListener('loadedmetadata', () => {
    sendTimeUpdate();
  });
  
  // Send periodic updates every second when playing
  setInterval(() => {
    if (audioPlayer && !audioPlayer.paused && currentBookmarkId) {
      sendTimeUpdate();
    }
  }, 1000);
});

/**
 * Handle messages from popup/background
 */
async function handleMessage(message, sender, sendResponse) {
  try {
    let result = { success: true };
    
    switch (message.type) {
      case 'LOAD_AUDIO':
        await loadAudio(message.bookmarkId, message.audioData, message.mimeType, message.title, message.forceLoad || false);
        break;
        
      case 'PLAY_AUDIO':
        await playAudio(message.bookmarkId, message.audioData, message.mimeType, message.title);
        break;
        
      case 'AUDIO_PAUSE':
      case 'PAUSE_AUDIO':
        pauseAudio();
        break;
        
      case 'AUDIO_RESUME':
      case 'RESUME_AUDIO':
        await resumeAudio(message.bookmarkId);
        break;
        
      case 'AUDIO_STOP':
      case 'STOP_AUDIO':
        stopAudio();
        break;
        
      case 'SET_VOLUME':
        setVolume(message.volume);
        break;
        
      case 'SET_PLAYBACK_RATE':
        setPlaybackRate(message.rate);
        break;
        
      case 'SEEK_AUDIO':
        seekAudio(message.time);
        break;
        
      case 'GET_AUDIO_STATE':
        // Return state even if bookmarkId doesn't match (for checking if any audio is playing)
        result = {
          success: true,
          state: {
            playing: audioPlayer && !audioPlayer.paused,
            currentTime: audioPlayer ? audioPlayer.currentTime : 0,
            duration: audioPlayer ? audioPlayer.duration : 0,
            bookmarkId: currentBookmarkId,
            title: message.title || null
          }
        };
        break;
        
      default:
        result = { success: false, error: 'Unknown message type' };
    }
    
    // Always send response
    if (sendResponse) {
      sendResponse(result);
    }
    
    return true; // Keep channel open for async
  } catch (error) {
    console.error('Error handling message:', error);
    const errorResponse = { success: false, error: error.message };
    if (sendResponse) {
      sendResponse(errorResponse);
    }
    return true;
  }
}

/**
 * Load audio (without playing)
 * IMPORTANT: If audio is currently playing, don't load new audio - let current playback continue
 * UNLESS forceLoad is true (when user explicitly clicks play)
 */
async function loadAudio(bookmarkId, audioData, mimeType, title, forceLoad = false) {
  try {
    // If same audio already loaded, don't reload
    if (currentBookmarkId === bookmarkId && audioPlayer.src) {
      console.log('Audio already loaded in offscreen for bookmark:', bookmarkId);
      return;
    }
    
    // CRITICAL: If different audio is currently playing and we're not forcing, don't load new audio yet
    // This prevents stopping current playback when just opening a new article
    if (!forceLoad && currentBookmarkId && currentBookmarkId !== bookmarkId && audioPlayer && !audioPlayer.paused) {
      console.log('Audio is currently playing for bookmark:', currentBookmarkId, '- not loading new audio for:', bookmarkId);
      console.log('New audio will be loaded when user clicks play');
      // Store the new audio data for later loading when play is clicked
      // For now, just return without loading
      return;
    }
    
    // If forceLoad is true, stop current audio first
    if (forceLoad && currentBookmarkId && currentBookmarkId !== bookmarkId && audioPlayer && !audioPlayer.paused) {
      console.log('Force loading new audio - stopping current playback');
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
    }
    
    // Clean up previous audio
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      currentAudioUrl = null;
    }
    
    // Convert base64 to blob
    const audioBlob = new Blob([Uint8Array.from(atob(audioData), c => c.charCodeAt(0))], { type: mimeType });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    // Set audio source (but don't play)
    audioPlayer.src = audioUrl;
    currentAudioUrl = audioUrl;
    currentBookmarkId = bookmarkId;
    
    console.log('Audio loaded in offscreen for bookmark:', bookmarkId, 'Size:', audioBlob.size, 'bytes', forceLoad ? '(forced)' : '');
    
    // Wait for audio to be ready (but don't play)
    await new Promise((resolve, reject) => {
      if (audioPlayer.readyState >= 2) {
        // Already loaded
        resolve();
      } else {
        audioPlayer.addEventListener('loadeddata', resolve, { once: true });
        audioPlayer.addEventListener('error', reject, { once: true });
        // Timeout after 10 seconds
        setTimeout(() => reject(new Error('Audio load timeout')), 10000);
      }
    });
    
    console.log('Audio ready in offscreen, waiting for play command');
    
  } catch (error) {
    console.error('Error loading audio:', error);
    throw error;
  }
}

/**
 * Play audio (when user clicks play)
 */
async function playAudio(bookmarkId, audioData, mimeType, title) {
  try {
    // If same audio, just resume
    if (currentBookmarkId === bookmarkId && audioPlayer.src) {
      await audioPlayer.play();
      
      // Notify background
      chrome.runtime.sendMessage({
        type: 'AUDIO_PLAYING',
        bookmarkId: bookmarkId,
        title: title
      });
      return;
    }
    
    // If audio data provided, load it first
    if (audioData) {
      await loadAudio(bookmarkId, audioData, mimeType, title);
    }
    
    // Play
    await audioPlayer.play();
    
    // Notify background
    chrome.runtime.sendMessage({
      type: 'AUDIO_PLAYING',
      bookmarkId: bookmarkId,
      title: title
    });
    
  } catch (error) {
    console.error('Error playing audio:', error);
    throw error;
  }
}

/**
 * Pause audio
 */
function pauseAudio() {
  if (audioPlayer && !audioPlayer.paused) {
    audioPlayer.pause();
  }
}

/**
 * Resume audio
 */
async function resumeAudio(bookmarkId = null) {
  if (!audioPlayer) {
    throw new Error('Audio player not initialized');
  }
  
  // Check if audio is loaded
  if (!audioPlayer.src || !currentBookmarkId) {
    throw new Error('No audio loaded to resume');
  }
  
  // If bookmarkId is provided, verify it matches
  if (bookmarkId && currentBookmarkId !== bookmarkId) {
    throw new Error(`Audio loaded for different bookmark. Expected ${bookmarkId}, but have ${currentBookmarkId}`);
  }
  
  // If already playing, nothing to do
  if (!audioPlayer.paused) {
    console.log('Audio already playing in offscreen for bookmark:', currentBookmarkId);
    return;
  }
  
  // Play the audio
  try {
    console.log('Starting audio playback in offscreen for bookmark:', currentBookmarkId);
    await audioPlayer.play();
    console.log('Audio started successfully in offscreen');
    
    // Notify background that audio is playing
    chrome.runtime.sendMessage({
      type: 'AUDIO_PLAYING',
      bookmarkId: currentBookmarkId
    }).catch(() => {
      // Ignore if no listeners
    });
  } catch (err) {
    console.error('Error resuming audio:', err);
    throw err;
  }
}

/**
 * Stop audio
 */
function stopAudio() {
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
  }
  
  // Clean up
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
  currentBookmarkId = null;
}

/**
 * Set volume
 */
function setVolume(volume) {
  if (audioPlayer) {
    audioPlayer.volume = Math.max(0, Math.min(1, volume));
  }
}

/**
 * Set playback rate
 */
function setPlaybackRate(rate) {
  if (audioPlayer) {
    audioPlayer.playbackRate = Math.max(0.5, Math.min(2, rate));
  }
}

/**
 * Seek audio
 */
function seekAudio(time) {
  if (audioPlayer && audioPlayer.duration) {
    audioPlayer.currentTime = Math.max(0, Math.min(audioPlayer.duration, time));
  }
}

/**
 * Send state update to background
 */
function sendStateUpdate(state) {
  chrome.runtime.sendMessage({
    type: 'AUDIO_STATE_UPDATE',
    state: state,
    bookmarkId: currentBookmarkId,
    currentTime: audioPlayer.currentTime,
    duration: audioPlayer.duration
  }).catch(() => {
    // Ignore errors if no listeners
  });
}

/**
 * Send time update to background
 */
function sendTimeUpdate() {
  chrome.runtime.sendMessage({
    type: 'AUDIO_TIME_UPDATE',
    bookmarkId: currentBookmarkId,
    currentTime: audioPlayer.currentTime,
    duration: audioPlayer.duration
  }).catch(() => {
    // Ignore errors if no listeners
  });
}
