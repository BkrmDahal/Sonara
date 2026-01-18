/**
 * Sonara - Audio Player Component
 * Handles the bottom audio player UI and audio playback controls
 */

/**
 * Check if audio is playing and show bottom player
 */
async function checkAndShowPlayingAudio() {
  try {
    const stateResponse = await chrome.runtime.sendMessage({
      type: 'GET_AUDIO_STATE'
    });
    
    if (stateResponse && stateResponse.success && stateResponse.state) {
      const state = stateResponse.state;
      
      if (state.bookmarkId) {
        window.currentPlayingBookmarkId = state.bookmarkId;
        
        const bookmarks = await storageManager.getBookmarks();
        const bookmark = bookmarks.find(b => b.id === state.bookmarkId);
        
        if (bookmark) {
          updateBottomAudioPlayerInfo(bookmark);
          
          const bottomPlayer = document.getElementById('bottomAudioPlayer');
          if (bottomPlayer) {
            bottomPlayer.style.display = 'flex';
            bottomPlayer.style.visibility = 'visible';
            bottomPlayer.style.opacity = '1';
          }
          
          updateBottomAudioPlayer();
          console.log('Found audio in offscreen (playing or paused):', state.bookmarkId);
        }
      }
    }
  } catch (error) {
    console.log('No audio in offscreen or offscreen not available');
  }
}

/**
 * Update bottom audio player with current state
 */
async function updateBottomAudioPlayer() {
  const bottomPlayer = document.getElementById('bottomAudioPlayer');
  const playPauseBtn = document.getElementById('bottomPlayPauseBtn');
  const progressBar = document.getElementById('bottomProgressBar');
  const currentTimeEl = document.getElementById('bottomCurrentTime');
  const durationEl = document.getElementById('bottomDuration');
  
  if (!bottomPlayer || !playPauseBtn) return;
  
  try {
    const stateResponse = await chrome.runtime.sendMessage({
      type: 'GET_AUDIO_STATE'
    });
    
    if (stateResponse && stateResponse.success && stateResponse.state) {
      const state = stateResponse.state;
      
      // Update play/pause button
      setPlayPauseButtonState(playPauseBtn, state.playing);
      
      // Update progress bar
      if (progressBar && state.duration > 0) {
        const progress = (state.currentTime / state.duration) * 100;
        progressBar.style.width = `${progress}%`;
      }
      
      // Update time display
      if (currentTimeEl) {
        currentTimeEl.textContent = formatTime(state.currentTime || 0);
      }
      if (durationEl) {
        durationEl.textContent = formatTime(state.duration || 0);
      }
    }
  } catch (error) {
    // Ignore if offscreen not available
  }
}

/**
 * Update bottom audio player info (title)
 * @param {Object} bookmark - The bookmark object
 */
function updateBottomAudioPlayerInfo(bookmark) {
  const titleEl = document.getElementById('bottomAudioTitle');
  if (titleEl && bookmark) {
    titleEl.textContent = bookmark.title || 'Untitled';
    titleEl.title = bookmark.title || 'Untitled';
  }
}

/**
 * Show the bottom audio player
 */
function showBottomAudioPlayer() {
  const bottomPlayer = document.getElementById('bottomAudioPlayer');
  if (bottomPlayer) {
    bottomPlayer.style.display = 'flex';
    bottomPlayer.style.visibility = 'visible';
    bottomPlayer.style.opacity = '1';
    
    // Add padding to content to prevent overlap
    const content = document.querySelector('.content');
    if (content) {
      content.style.paddingBottom = '80px';
    }
  }
}

/**
 * Hide the bottom audio player
 */
function hideBottomAudioPlayer() {
  const bottomPlayer = document.getElementById('bottomAudioPlayer');
  if (bottomPlayer) {
    bottomPlayer.style.display = 'none';
    
    // Remove padding from content
    const content = document.querySelector('.content');
    if (content) {
      content.style.paddingBottom = '';
    }
  }
}

/**
 * Set play/pause button visual state
 * @param {HTMLElement} btn - The button element
 * @param {boolean} isPlaying - Whether audio is playing
 */
function setPlayPauseButtonState(btn, isPlaying) {
  if (!btn) return;
  
  const icon = btn.querySelector('i') || btn;
  if (icon.classList) {
    icon.classList.remove('fa-play', 'fa-pause');
    icon.classList.add(isPlaying ? 'fa-pause' : 'fa-play');
  }
  
  btn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  btn.title = isPlaying ? 'Pause' : 'Play';
}

/**
 * Toggle play/pause from bottom player
 */
async function toggleBottomAudioPlayPause() {
  if (!window.currentPlayingBookmarkId) {
    console.log('No audio loaded to play/pause');
    return;
  }
  
  try {
    const stateResponse = await chrome.runtime.sendMessage({
      type: 'GET_AUDIO_STATE'
    });
    
    if (stateResponse && stateResponse.success && stateResponse.state) {
      const isPlaying = stateResponse.state.playing;
      
      if (isPlaying) {
        await chrome.runtime.sendMessage({
          type: 'AUDIO_PAUSE',
          bookmarkId: window.currentPlayingBookmarkId
        });
      } else {
        await chrome.runtime.sendMessage({
          type: 'AUDIO_RESUME',
          bookmarkId: window.currentPlayingBookmarkId
        });
      }
      
      // Update UI after a short delay
      setTimeout(() => {
        updateBottomAudioPlayer();
        updateModalAudioControls();
      }, 200);
    }
  } catch (error) {
    console.error('Error toggling play/pause:', error);
  }
}

/**
 * Stop audio from bottom player
 */
async function stopBottomAudio() {
  if (window.currentPlayingBookmarkId) {
    try {
      await chrome.runtime.sendMessage({
        type: 'AUDIO_STOP',
        bookmarkId: window.currentPlayingBookmarkId
      });
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
    window.currentPlayingBookmarkId = null;
  }
  
  // Also stop local player
  const audioPlayer = document.getElementById('audioPlayer');
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
  }
  
  hideBottomAudioPlayer();
  updateBottomAudioPlayer();
  updateModalAudioControls();
}

/**
 * Load audio in offscreen document
 * @param {string} bookmarkId - The bookmark ID
 * @param {string} audioData - Base64 audio data
 * @param {string} mimeType - Audio MIME type
 * @param {string} title - Audio title
 * @param {boolean} forceLoad - Force load even if different audio is playing
 */
async function loadAudioInOffscreen(bookmarkId, audioData, mimeType, title, forceLoad = false) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'LOAD_AUDIO',
      bookmarkId: bookmarkId,
      audioData: audioData,
      mimeType: mimeType || 'audio/mpeg',
      title: title,
      forceLoad: forceLoad
    });
    
    if (!response || !response.success) {
      console.error('Failed to load audio in offscreen:', response?.error);
      throw new Error(response?.error || 'Failed to load audio');
    }
    
    return response;
  } catch (error) {
    console.error('Error loading audio in offscreen:', error);
    throw error;
  }
}

/**
 * Play audio in offscreen document
 * @param {string} bookmarkId - The bookmark ID
 */
async function playAudioInOffscreen(bookmarkId) {
  try {
    // Get bookmark data
    const bookmarks = await storageManager.getBookmarks();
    const bookmark = bookmarks.find(b => b.id === bookmarkId);
    
    if (!bookmark) {
      throw new Error('Bookmark not found');
    }
    
    // Get audio data
    let audioData, mimeType;
    
    if (bookmark.audioStored) {
      // Audio is in IndexedDB
      const audioResult = await audioStorageManager.getAudio(bookmarkId);
      if (audioResult) {
        audioData = audioResult.base64Audio;
        mimeType = audioResult.mimeType;
      }
    } else if (bookmark.audioData) {
      // Audio is in chrome.storage (legacy)
      audioData = bookmark.audioData;
      mimeType = bookmark.audioMimeType;
    }
    
    if (!audioData) {
      throw new Error('No audio data available');
    }
    
    // Send play message with audio data
    const response = await chrome.runtime.sendMessage({
      type: 'PLAY_AUDIO',
      bookmarkId: bookmarkId,
      audioData: audioData,
      mimeType: mimeType || 'audio/mpeg',
      title: bookmark.title
    });
    
    if (response && response.success) {
      window.currentPlayingBookmarkId = bookmarkId;
      showBottomAudioPlayer();
      updateBottomAudioPlayerInfo(bookmark);
    }
    
    return response;
  } catch (error) {
    console.error('Error playing audio in offscreen:', error);
    throw error;
  }
}

/**
 * Update audio UI from offscreen document messages
 * @param {Object} msg - Message from offscreen
 */
function updateAudioUIFromOffscreen(msg) {
  const { bookmarkId, currentTime, duration, state } = msg;
  
  // Update bottom player
  const progressBar = document.getElementById('bottomProgressBar');
  const currentTimeEl = document.getElementById('bottomCurrentTime');
  const durationEl = document.getElementById('bottomDuration');
  const playPauseBtn = document.getElementById('bottomPlayPauseBtn');
  
  if (progressBar && duration > 0) {
    const progress = (currentTime / duration) * 100;
    progressBar.style.width = `${progress}%`;
  }
  
  if (currentTimeEl) {
    currentTimeEl.textContent = formatTime(currentTime || 0);
  }
  
  if (durationEl) {
    durationEl.textContent = formatTime(duration || 0);
  }
  
  if (playPauseBtn) {
    const isPlaying = state === 'playing';
    setPlayPauseButtonState(playPauseBtn, isPlaying);
  }
  
  // Update modal controls if open
  updateModalAudioControls();
}

