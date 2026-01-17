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

chrome.runtime.onInstalled.addListener(() => {
  // Extension installed
});

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

async function openaiTTSInBackground(text, apiKey, voice = 'coral') {
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

  console.log(`Generating audio for ${chunks.length} chunk(s), total length: ${text.length} characters`);

  const blobs = [];
  for (let i = 0; i < chunks.length; i++) {
    try {
      console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)...`);
      
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
      
      console.log(`Chunk ${i + 1}/${chunks.length} completed (${blob.size} bytes)`);
      blobs.push(blob);
      
      // Small delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (e) {
      console.error(`Error processing chunk ${i + 1}/${chunks.length}:`, e);
      throw new Error(`Failed to generate audio for chunk ${i + 1}/${chunks.length}: ${e.message}`);
    }
  }

  if (blobs.length === 0) {
    throw new Error('No audio blobs generated');
  }

  console.log(`All chunks processed. Combining ${blobs.length} audio blob(s)...`);
  const blob = blobs.length === 1 ? blobs[0] : new Blob(blobs, { type: 'audio/mpeg' });
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  console.log(`Audio generation complete. Total size: ${blob.size} bytes`);
  return btoa(binary);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'GENERATE_AUDIO' || !msg.bookmarkId) {
    sendResponse({ ok: false, error: 'Invalid message' });
    return false;
  }

  const bookmarkId = msg.bookmarkId;
  let responded = false;

  const respond = (result) => {
    if (!responded) {
      responded = true;
      sendResponse(result);
    }
  };

  (async () => {
    try {
      const data = await getData();
      const idx = (data.bookmarks || []).findIndex(b => b.id === bookmarkId);
      if (idx < 0) {
        respond({ ok: false, error: 'Bookmark not found' });
        return;
      }
      const b = data.bookmarks[idx];
      const text = (b.extractedContent || '').trim();
      const apiKey = (data.settings?.openaiApiKey || '').trim();
      const voice = data.settings?.openaiVoice || 'coral';

      if (!text || !apiKey) {
        delete b.audioStatus;
        data.bookmarks[idx] = b;
        await setData(data);
        respond({ ok: false, error: 'Missing content or API key' });
        return;
      }

      // Increased timeout for longer articles: 10 minutes (was 5 minutes)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Audio generation timeout (10 minutes). Article may be too long.')), 10 * 60 * 1000)
      );

      const base64 = await Promise.race([
        openaiTTSInBackground(text, apiKey, voice),
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

      console.log(`Audio generation successful for bookmark ${bookmarkId}`);
      try { 
        chrome.runtime.sendMessage({ type: 'AUDIO_READY', bookmarkId }).catch(() => {}); 
      } catch (_) {}
      
      respond({ ok: true });
    } catch (e) {
      const errorMessage = String(e.message || 'Unknown error');
      const isQuotaError = errorMessage.includes('quota') || errorMessage.includes('QUOTA') || 
                          errorMessage.includes('Resource::kQuotaBytes');
      
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
          await setData(data);
          console.log(`Error status saved for bookmark ${bookmarkId}: ${userFriendlyError}`);
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
