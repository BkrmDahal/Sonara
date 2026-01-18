/**
 * Sonara - Background Service Worker
 * Handles background audio generation and extension lifecycle
 */

// Import audio storage manager
importScripts('audio-storage.js');

const STORAGE_KEY = 'sonara_data';
const OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech';
const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
const MAX_CHARS_PER_REQUEST = 4096;

// Helper function to save job logs
async function saveJobLog(bookmarkId, bookmarkTitle, status, message, details = {}) {
  try {
    const data = await getData();
    if (!data.jobLogs) {
      data.jobLogs = [];
    }
    const log = {
      bookmarkId,
      bookmarkTitle: bookmarkTitle || 'Unknown',
      status, // 'started', 'progress', 'success', 'error', 'cancelled'
      message,
      details,
      timestamp: Date.now()
    };
    data.jobLogs.push(log);
    // Keep only last 1000 logs
    if (data.jobLogs.length > 1000) {
      data.jobLogs = data.jobLogs.slice(-1000);
    }
    await setData(data);
    return log;
  } catch (err) {
    console.error('Failed to save job log:', err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  // Extension installed
});

// Manage offscreen document for background audio playback
let offscreenDocumentId = null;

async function ensureOffscreenDocument() {
  // Check if offscreen document already exists
  const clients = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  
  if (clients.length > 0) {
    offscreenDocumentId = clients[0].contextId;
    return;
  }
  
  // Create offscreen document
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_SCRAPING'],
      justification: 'Background audio playback'
    });
    console.log('Offscreen document created for audio playback');
  } catch (error) {
    console.error('Failed to create offscreen document:', error);
  }
}

// Listen for audio control messages from popup (this runs first)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle audio control messages (forward to offscreen)
  if (message.type === 'LOAD_AUDIO' || message.type === 'PLAY_AUDIO' || message.type === 'AUDIO_PAUSE' || 
      message.type === 'AUDIO_STOP' || message.type === 'AUDIO_RESUME' ||
      message.type === 'AUDIO_SEEK' || message.type === 'AUDIO_SET_RATE' ||
      message.type === 'GET_AUDIO_STATE') {
    handleAudioControl(message, sendResponse);
    return true; // Keep channel open for async
  }
  
  // Forward state updates from offscreen to popup
  if (message.type === 'AUDIO_STATE_UPDATE' || message.type === 'AUDIO_TIME_UPDATE' || 
      message.type === 'AUDIO_PLAYING') {
    // Broadcast to all popup instances (they will listen for these)
    // Don't send response, just broadcast
    return false;
  }
  
  // Let other message types pass through to other listeners
  return false;
});

async function handleAudioControl(message, sendResponse) {
  try {
    await ensureOffscreenDocument();
    
    // Verify offscreen document exists
    const clients = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (clients.length === 0) {
      if (sendResponse) {
        sendResponse({ success: false, error: 'Offscreen document not available' });
      }
      return false;
    }
    
    // Send message to offscreen and wait for response
    // Use Promise-based approach for better error handling
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response || { success: false, error: 'No response from offscreen' });
          }
        });
      });
      
      // Forward response to popup
      if (sendResponse) {
        sendResponse(response);
      }
      return true;
    } catch (error) {
      console.error('Error communicating with offscreen:', error);
      if (sendResponse) {
        sendResponse({ success: false, error: error.message });
      }
      return false;
    }
  } catch (error) {
    console.error('Error handling audio control:', error);
    if (sendResponse) {
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }
}

// Initialize offscreen document on startup
ensureOffscreenDocument();

function getData() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (r) => {
      resolve(r[STORAGE_KEY] || { bookmarks: [], tags: [], settings: {} });
    });
  });
}

function setData(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: data }, resolve);
  });
}

/**
 * Retry a fetch request with exponential backoff
 */
async function fetchWithRetry(url, options, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      // Longer timeout for longer articles: 2 minutes per chunk (was 60s)
      const timeoutMs = 120000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const fetchOptions = {
        ...options,
        signal: controller.signal
      };
      
      const res = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errorMsg = err.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        
        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new Error(errorMsg);
        }
        
        // Retry on server errors (5xx) and rate limits (429)
        throw new Error(errorMsg);
      }
      
      return res;
    } catch (e) {
      lastError = e;
      
      if (e.name === 'AbortError') {
        throw new Error(`Request timeout (${timeoutMs / 1000}s per chunk). Article may be too long.`);
      }
      
      // Don't retry on the last attempt
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`API request failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`, e.message);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  throw lastError || new Error('Request failed after retries');
}

async function openaiTTSInBackground(text, apiKey, voice = 'coral', bookmarkId = null, progressCallback = null) {
  if (!text || !text.trim()) {
    throw new Error('Empty text provided');
  }
  if (!apiKey || !apiKey.trim()) {
    throw new Error('API key required');
  }

  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    let chunk = remaining.substring(0, MAX_CHARS_PER_REQUEST);
    if (chunk.length === MAX_CHARS_PER_REQUEST) {
      const last = Math.max(chunk.lastIndexOf('.'), chunk.lastIndexOf('?'), chunk.lastIndexOf('!'));
      if (last > MAX_CHARS_PER_REQUEST / 2) chunk = chunk.substring(0, last + 1);
    }
    chunks.push(chunk.trim());
    remaining = remaining.substring(chunk.length).trim();
  }

  const totalChunks = chunks.length;
  const totalChars = text.length;
  console.log(`Generating audio for ${totalChunks} chunk(s), total length: ${totalChars} characters`);

  // Call progress callback with initial info
  if (progressCallback) {
    await progressCallback({
      totalChunks,
      completedChunks: 0,
      currentChunk: 0,
      totalChars,
      progressPercent: 0,
      status: 'starting'
    });
  }

  const blobs = [];
  let totalBytesReceived = 0;
  
  for (let i = 0; i < chunks.length; i++) {
    const chunkStartTime = Date.now();
    const currentChunk = i + 1;
    
    // Check for cancellation if bookmarkId is provided
    if (bookmarkId && activeGenerations.get(bookmarkId)?.cancelled) {
      console.log(`Audio generation cancelled for bookmark ${bookmarkId} at chunk ${currentChunk}`);
      activeGenerations.delete(bookmarkId);
      if (progressCallback) {
        await progressCallback({
          totalChunks,
          completedChunks: i,
          currentChunk,
          totalChars,
          progressPercent: Math.round((i / totalChunks) * 100),
          status: 'cancelled',
          cancelledAt: currentChunk
        });
      }
      throw new Error('Audio generation cancelled by user');
    }
    
    try {
      const chunkChars = chunks[i].length;
      const progressPercent = Math.round((i / totalChunks) * 100);
      
      console.log(`Processing chunk ${currentChunk}/${totalChunks} (${chunkChars} chars, ${progressPercent}% complete)...`);
      
      // Log chunk start
      if (progressCallback) {
        await progressCallback({
          totalChunks,
          completedChunks: i,
          currentChunk,
          currentChunkChars: chunkChars,
          totalChars,
          progressPercent,
          status: 'processing',
          message: `Processing chunk ${currentChunk}/${totalChunks}...`
        });
      }
      
      const res = await fetchWithRetry(
        OPENAI_SPEECH_URL,
        {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${apiKey.trim()}`, 
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({
            model: OPENAI_TTS_MODEL,
            input: chunks[i],
            voice,
            instructions: i === 0 ? 'Read in a clear, natural tone.' : 'Continue reading in the same tone.',
            response_format: 'mp3'
          })
        },
        3, // maxRetries
        2000 // baseDelay (2 seconds)
      );
      
      const blob = await res.blob();
      if (!blob || blob.size === 0) {
        throw new Error('Empty audio blob received from API');
      }
      
      const chunkDuration = ((Date.now() - chunkStartTime) / 1000).toFixed(1);
      totalBytesReceived += blob.size;
      const completedChunks = i + 1;
      const newProgressPercent = Math.round((completedChunks / totalChunks) * 100);
      
      console.log(`Chunk ${currentChunk}/${totalChunks} completed (${blob.size} bytes, ${chunkDuration}s)`);
      blobs.push(blob);
      
      // Log chunk completion
      if (progressCallback) {
        await progressCallback({
          totalChunks,
          completedChunks,
          currentChunk,
          currentChunkChars: chunkChars,
          currentChunkSize: blob.size,
          currentChunkDuration: chunkDuration,
          totalChars,
          totalBytesReceived,
          progressPercent: newProgressPercent,
          status: 'completed',
          message: `Chunk ${currentChunk}/${totalChunks} completed (${blob.size} bytes, ${chunkDuration}s)`
        });
      }
      
      // Check for cancellation after chunk completion
      if (bookmarkId && activeGenerations.get(bookmarkId)?.cancelled) {
        console.log(`Audio generation cancelled for bookmark ${bookmarkId} after chunk ${currentChunk}`);
        activeGenerations.delete(bookmarkId);
        if (progressCallback) {
          await progressCallback({
            totalChunks,
            completedChunks,
            currentChunk,
            totalChars,
            progressPercent: newProgressPercent,
            status: 'cancelled',
            cancelledAt: currentChunk
          });
        }
        throw new Error('Audio generation cancelled by user');
      }
      
      // Small delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (e) {
      console.error(`Error processing chunk ${currentChunk}/${totalChunks}:`, e);
      if (progressCallback) {
        await progressCallback({
          totalChunks,
          completedChunks: i,
          currentChunk,
          totalChars,
          progressPercent: Math.round((i / totalChunks) * 100),
          status: 'error',
          error: e.message,
          failedAt: currentChunk
        });
      }
      throw new Error(`Failed to generate audio for chunk ${currentChunk}/${totalChunks}: ${e.message}`);
    }
  }

  if (blobs.length === 0) {
    throw new Error('No audio blobs generated');
  }

  console.log(`All chunks processed. Combining ${blobs.length} audio blob(s)...`);
  const combineStartTime = Date.now();
  const blob = blobs.length === 1 ? blobs[0] : new Blob(blobs, { type: 'audio/mpeg' });
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const combineDuration = ((Date.now() - combineStartTime) / 1000).toFixed(1);
  
  console.log(`Audio generation complete. Total size: ${blob.size} bytes, combined in ${combineDuration}s`);
  
  // Return base64 string (can't attach properties to string, metadata tracked via progress callback)
  return btoa(binary);
}

// Track active audio generation tasks for cancellation
const activeGenerations = new Map();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Handle cancel request
  if (msg.type === 'CANCEL_AUDIO_GENERATION' && msg.bookmarkId) {
    const bookmarkId = msg.bookmarkId;
    if (activeGenerations.has(bookmarkId)) {
      activeGenerations.set(bookmarkId, { cancelled: true });
      sendResponse({ ok: true, cancelled: true });
    } else {
      sendResponse({ ok: true, cancelled: false, message: 'No active generation found' });
    }
    return false;
  }
  
  if (msg.type !== 'GENERATE_AUDIO' || !msg.bookmarkId) {
    sendResponse({ ok: false, error: 'Invalid message' });
    return false;
  }

  const bookmarkId = msg.bookmarkId;
  let responded = false;
  
  // Mark generation as active
  activeGenerations.set(bookmarkId, { cancelled: false });

  const respond = (result) => {
    if (!responded) {
      responded = true;
      sendResponse(result);
    }
  };

  (async () => {
    const startTime = Date.now();
    let bookmarkTitle = 'Unknown';
    
    try {
      const data = await getData();
      const idx = (data.bookmarks || []).findIndex(b => b.id === bookmarkId);
      if (idx < 0) {
        await saveJobLog(bookmarkId, bookmarkTitle, 'error', 'Bookmark not found');
        respond({ ok: false, error: 'Bookmark not found' });
        return;
      }
      const b = data.bookmarks[idx];
      bookmarkTitle = b.title || 'Untitled';
      const text = (b.extractedContent || '').trim();
      const apiKey = (data.settings?.openaiApiKey || '').trim();
      const voice = data.settings?.openaiVoice || 'coral';

      // Log start
      await saveJobLog(bookmarkId, bookmarkTitle, 'started', 'Audio generation started', {
        textLength: text.length,
        voice: voice
      });

      if (!text || !apiKey) {
        delete b.audioStatus;
        data.bookmarks[idx] = b;
        await setData(data);
        await saveJobLog(bookmarkId, bookmarkTitle, 'error', 'Missing content or API key');
        respond({ ok: false, error: 'Missing content or API key' });
        return;
      }

      // Increased timeout for longer articles: 10 minutes (was 5 minutes)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Audio generation timeout (10 minutes). Article may be too long.')), 10 * 60 * 1000)
      );

      // Progress callback for detailed logging
      let lastLoggedProgress = 0;
      let chunkMetadata = { totalChunks: 0, completedChunks: 0 };
      
      const progressCallback = async (progress) => {
        const { totalChunks, completedChunks, currentChunk, progressPercent, status, message } = progress;
        chunkMetadata = { totalChunks, completedChunks };
        
        // Log every 10% progress or on status changes or every chunk for small jobs
        const shouldLog = progressPercent - lastLoggedProgress >= 10 || 
                         status !== 'completed' || 
                         currentChunk === totalChunks ||
                         totalChunks <= 5; // Log every chunk for small jobs (5 or fewer chunks)
        
        if (shouldLog) {
          const logMessage = message || 
            `Chunk ${currentChunk}/${totalChunks} - ${completedChunks} completed (${progressPercent}%)`;
          
          await saveJobLog(bookmarkId, bookmarkTitle, 'progress', logMessage, {
            totalChunks,
            completedChunks,
            currentChunk,
            progressPercent,
            status,
            currentChunkChars: progress.currentChunkChars,
            currentChunkSize: progress.currentChunkSize,
            currentChunkDuration: progress.currentChunkDuration,
            totalChars: progress.totalChars,
            totalBytesReceived: progress.totalBytesReceived
          });
          
          lastLoggedProgress = progressPercent;
        }
      };
      
      const base64 = await Promise.race([
        openaiTTSInBackground(text, apiKey, voice, bookmarkId, progressCallback).then(async (result) => {
          await saveJobLog(bookmarkId, bookmarkTitle, 'progress', 
            `All ${chunkMetadata.completedChunks}/${chunkMetadata.totalChunks} chunks generated, combining and saving...`, {
            totalChunks: chunkMetadata.totalChunks,
            completedChunks: chunkMetadata.completedChunks,
            chunksProcessed: chunkMetadata.completedChunks,
            chunksTotal: chunkMetadata.totalChunks
          });
          return result;
        }),
        timeoutPromise
      ]);

      // Save audio to IndexedDB instead of chrome.storage to avoid quota issues
      try {
        await audioStorageManager.saveAudio(bookmarkId, base64, 'audio/mpeg');
        // Store a flag indicating audio is in IndexedDB, not the actual data
        b.audioStored = true; // Flag to indicate audio is stored in IndexedDB
        b.audioMimeType = 'audio/mpeg';
        // Remove old audioData if it exists (migration)
        delete b.audioData;
      } catch (storageError) {
        console.error('Failed to save audio to IndexedDB:', storageError);
        // Fallback: try to save to chrome.storage if IndexedDB fails (for smaller files)
        // But warn about potential quota issues
        if (base64.length < 5 * 1024 * 1024) { // Only if less than 5MB
          b.audioData = base64;
          b.audioMimeType = 'audio/mpeg';
          console.warn('Falling back to chrome.storage for audio (may hit quota limits)');
        } else {
          throw new Error('Audio file too large for chrome.storage. IndexedDB storage failed: ' + storageError.message);
        }
      }

      delete b.audioStatus;
      delete b.audioError;
      data.bookmarks[idx] = b;
      await setData(data);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const audioSize = base64.length;
      
      await saveJobLog(bookmarkId, bookmarkTitle, 'success', 
        `Audio generation completed successfully in ${duration}s - ${chunkMetadata.completedChunks}/${chunkMetadata.totalChunks} chunks`, {
        duration: duration,
        totalChunks: chunkMetadata.totalChunks,
        completedChunks: chunkMetadata.completedChunks,
        audioSize: audioSize,
        audioSizeMB: (audioSize / (1024 * 1024)).toFixed(2),
        chunksProcessed: chunkMetadata.completedChunks,
        chunksTotal: chunkMetadata.totalChunks
      });

      console.log(`Audio generation successful for bookmark ${bookmarkId}`);
      activeGenerations.delete(bookmarkId);
      try { 
        chrome.runtime.sendMessage({ type: 'AUDIO_READY', bookmarkId }).catch(() => {}); 
      } catch (_) {}
      
      respond({ ok: true });
    } catch (e) {
      // Clean up on error or cancellation
      activeGenerations.delete(bookmarkId);
      const errorMessage = String(e.message || 'Unknown error');
      const isQuotaError = errorMessage.includes('quota') || errorMessage.includes('QUOTA') || 
                          errorMessage.includes('Resource::kQuotaBytes');
      const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('Timeout');
      const isCancelled = errorMessage.includes('cancelled') || errorMessage.includes('Cancelled');
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      // Try to get chunk progress from error details if available
      let errorDetails = {
        duration: duration,
        isQuotaError,
        isTimeout,
        isCancelled
      };
      
      // Extract chunk info from error message if available
      const chunkMatch = errorMessage.match(/chunk (\d+)\/(\d+)/i);
      if (chunkMatch) {
        errorDetails.failedAtChunk = parseInt(chunkMatch[1]);
        errorDetails.totalChunks = parseInt(chunkMatch[2]);
        errorDetails.completedChunks = parseInt(chunkMatch[1]) - 1;
      }
      
      // Log error with detailed info
      await saveJobLog(bookmarkId, bookmarkTitle, isCancelled ? 'cancelled' : 'error', 
        isCancelled ? 'Audio generation cancelled by user' : errorMessage, {
        ...errorDetails,
        stack: e.stack
      });
      
      console.error('Background audio generation failed:', {
        bookmarkId,
        error: errorMessage,
        isQuotaError,
        stack: e.stack,
        timestamp: new Date().toISOString()
      });
      
      // If it's a quota error, provide a more helpful message
      let userFriendlyError = errorMessage;
      if (isQuotaError) {
        userFriendlyError = 'Storage quota exceeded. Audio file is too large. Please try with a shorter article or free up storage space.';
      }
      
      try {
        const data = await getData();
        const idx = (data.bookmarks || []).findIndex(x => x.id === bookmarkId);
        if (idx >= 0) {
          // Store error status instead of just deleting audioStatus
          data.bookmarks[idx].audioStatus = 'error';
          data.bookmarks[idx].audioError = userFriendlyError;
          data.bookmarks[idx].audioErrorTime = Date.now(); // Track when error occurred for auto-reprocess
          await setData(data);
          console.log(`Error status saved for bookmark ${bookmarkId}: ${userFriendlyError}`);
          
          // Auto-reprocess after 10 minutes if it was a timeout error
          if (isTimeout && !isCancelled) {
            setTimeout(async () => {
              try {
                const checkData = await getData();
                const checkIdx = checkData.bookmarks.findIndex(x => x.id === bookmarkId);
                if (checkIdx >= 0 && checkData.bookmarks[checkIdx].audioStatus === 'error') {
                  const errorTime = checkData.bookmarks[checkIdx].audioErrorTime || 0;
                  // Only auto-reprocess if error is still present and it's been 10 minutes
                  if (Date.now() - errorTime >= 10 * 60 * 1000) {
                    await saveJobLog(bookmarkId, bookmarkTitle, 'progress', 'Auto-reprocessing after timeout...');
                    checkData.bookmarks[checkIdx].audioStatus = 'generating';
                    delete checkData.bookmarks[checkIdx].audioError;
                    delete checkData.bookmarks[checkIdx].audioErrorTime;
                    await setData(checkData);
                    // Trigger regeneration
                    chrome.runtime.sendMessage({ type: 'GENERATE_AUDIO', bookmarkId }).catch(() => {});
                  }
                }
              } catch (err) {
                console.error('Auto-reprocess failed:', err);
              }
            }, 10 * 60 * 1000); // 10 minutes
          }
        }
      } catch (err) {
        console.error('Failed to save error status:', err);
      }
      
      try { 
        chrome.runtime.sendMessage({ type: 'AUDIO_READY', bookmarkId }).catch(() => {}); 
      } catch (_) {}
      
      respond({ ok: false, error: errorMessage });
    }
  })();

  return true;
});
