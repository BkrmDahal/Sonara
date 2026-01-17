/**
 * Sonara - OpenAI TTS Integration
 * Generates high-quality speech using OpenAI's GPT-4o mini TTS model
 */

const OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech';
const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
const MAX_CHARS_PER_REQUEST = 4096; // OpenAI limit

// OpenAI voices for gpt-4o-mini-tts
const OPENAI_VOICES = [
  'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable',
  'nova', 'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar'
];

/**
 * Generate speech from text using OpenAI TTS API
 * @param {string} text - Text to convert to speech
 * @param {string} apiKey - OpenAI API key
 * @param {object} options - { voice, speed, instructions }
 * @returns {Promise<Blob>} - Audio blob (MP3)
 */
async function openaiTextToSpeech(text, apiKey, options = {}) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('OpenAI API key is required');
  }

  const voice = options.voice || 'coral';
  const instructions = options.instructions || 'Read in a clear, natural tone.';

  // Split long text into chunks
  const chunks = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    let chunk = remaining.substring(0, MAX_CHARS_PER_REQUEST);
    
    // Try to break at sentence boundary
    if (chunk.length === MAX_CHARS_PER_REQUEST) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastQuestion = chunk.lastIndexOf('?');
      const lastExclaim = chunk.lastIndexOf('!');
      const lastBreak = Math.max(lastPeriod, lastQuestion, lastExclaim);
      if (lastBreak > MAX_CHARS_PER_REQUEST / 2) {
        chunk = chunk.substring(0, lastBreak + 1);
      }
    }
    
    chunks.push(chunk.trim());
    remaining = remaining.substring(chunk.length).trim();
  }

  const audioBlobs = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    const response = await fetch(OPENAI_SPEECH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_TTS_MODEL,
        input: chunk,
        voice: voice,
        instructions: i === 0 ? instructions : 'Continue reading in the same tone.',
        response_format: 'mp3'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || response.statusText;
      throw new Error(`OpenAI TTS error: ${response.status} - ${errorMsg}`);
    }

    const blob = await response.blob();
    audioBlobs.push(blob);

    // Small delay between chunks to avoid rate limiting
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Combine all blobs into one
  if (audioBlobs.length === 1) {
    return audioBlobs[0];
  }

  // Concatenate MP3 blobs (simple concatenation works for MP3)
  return new Blob(audioBlobs, { type: 'audio/mpeg' });
}

/**
 * Check if OpenAI TTS is available (API key configured)
 */
async function isOpenAITTSAvailable() {
  const settings = await storageManager.getSettings();
  return !!(settings.openaiApiKey && settings.openaiApiKey.trim());
}
