/**
 * Sonara - Browser TTS Engine
 * Text-to-speech using Web Speech API (browser's built-in TTS)
 * Falls back to system voices when OpenAI is not configured
 */

class TTSEngine {
  constructor() {
    if (!window.speechSynthesis) {
      console.warn('Speech Synthesis API not available');
    }
    this.synthesis = window.speechSynthesis;
    this.utterance = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.currentText = '';
    this.onProgressCallback = null;
    this.onCompleteCallback = null;
  }

  // Get available voices
  getVoices() {
    return new Promise((resolve) => {
      let voices = this.synthesis.getVoices();
      if (voices.length > 0) {
        resolve(voices);
      } else {
        // Wait for voices to load
        this.synthesis.onvoiceschanged = () => {
          voices = this.synthesis.getVoices();
          resolve(voices);
        };
      }
    });
  }

  // Speak text
  async speak(text, options = {}) {
    if (!this.synthesis) {
      throw new Error('Speech Synthesis API not available');
    }

    if (!text || typeof text !== 'string' || text.trim() === '') {
      throw new Error('Empty or invalid text provided');
    }

    if (this.isPlaying && !this.isPaused) {
      this.stop();
    }

    try {
      this.currentText = text;
      this.utterance = new SpeechSynthesisUtterance(text);
    } catch (e) {
      throw new Error('Failed to create speech utterance: ' + (e.message || 'Unknown error'));
    }

    // Set options
    this.utterance.rate = options.rate || 1.0;
    this.utterance.pitch = options.pitch || 1.0;
    this.utterance.volume = options.volume || 1.0;

    // Use browser default voice (don't set voice property)
    // The browser will automatically use its default/system voice
    // If a specific voice is requested, use it
    if (options.voice && options.voice !== 'default') {
      const voices = await this.getVoices();
      const voice = voices.find(v => v.name === options.voice || v.lang === options.voice);
      if (voice) {
        this.utterance.voice = voice;
      }
    }
    // Otherwise, let the browser use its default voice (don't set utterance.voice)

        // Set up event handlers
        this.utterance.onstart = () => {
          try {
            this.isPlaying = true;
            this.isPaused = false;
            if (this.onProgressCallback) {
              this.onProgressCallback();
            }
          } catch (e) {
            console.error('Error in TTS onstart handler:', e);
          }
        };

        this.utterance.onend = () => {
          try {
            this.isPlaying = false;
            this.isPaused = false;
            if (this.onCompleteCallback) {
              this.onCompleteCallback();
            }
          } catch (e) {
            console.error('Error in TTS onend handler:', e);
          }
        };

    this.utterance.onerror = (event) => {
      try {
        const errorMsg = event?.error || event?.message || 'Unknown TTS error';
        console.error('TTS Error:', errorMsg, event);
      } catch (e) {
        console.error('TTS Error occurred (unable to log details):', e);
      }
      
      this.isPlaying = false;
      this.isPaused = false;
      
      try {
        if (this.onCompleteCallback) {
          this.onCompleteCallback();
        }
      } catch (e) {
        console.error('Error in TTS completion callback:', e);
      }
    };
    
        this.utterance.onpause = () => {
          try {
            this.isPaused = true;
            if (this.onProgressCallback) {
              this.onProgressCallback();
            }
          } catch (e) {
            console.error('Error in TTS onpause handler:', e);
          }
        };

        this.utterance.onresume = () => {
          try {
            this.isPaused = false;
            if (this.onProgressCallback) {
              this.onProgressCallback();
            }
          } catch (e) {
            console.error('Error in TTS onresume handler:', e);
          }
        };

    // Start speaking
    try {
      this.synthesis.speak(this.utterance);
    } catch (e) {
      this.isPlaying = false;
      this.isPaused = false;
      throw new Error('Failed to start speech: ' + (e.message || 'Unknown error'));
    }
  }

  // Pause speech
  pause() {
    if (!this.synthesis) return;
    try {
      if (this.isPlaying && !this.isPaused) {
        this.synthesis.pause();
        this.isPaused = true;
      }
    } catch (e) {
      console.error('Error pausing speech:', e);
      this.isPlaying = false;
      this.isPaused = false;
    }
  }

  // Resume speech
  resume() {
    if (!this.synthesis) return;
    try {
      if (this.isPaused) {
        this.synthesis.resume();
        this.isPaused = false;
      }
    } catch (e) {
      console.error('Error resuming speech:', e);
      this.isPlaying = false;
      this.isPaused = false;
    }
  }

  // Stop speech
  stop() {
    if (!this.synthesis) return;
    try {
      if (this.isPlaying || this.isPaused) {
        this.synthesis.cancel();
        this.isPlaying = false;
        this.isPaused = false;
      }
    } catch (e) {
      console.error('Error stopping speech:', e);
      this.isPlaying = false;
      this.isPaused = false;
    }
  }

  // Set progress callback
  setProgressCallback(callback) {
    this.onProgressCallback = callback;
  }

  // Set complete callback
  setCompleteCallback(callback) {
    this.onCompleteCallback = callback;
  }

  // Get current status
  getStatus() {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentText: this.currentText
    };
  }
}

// Export singleton instance
const ttsEngine = new TTSEngine();
