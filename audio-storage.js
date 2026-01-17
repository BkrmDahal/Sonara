/**
 * Sonara - Audio Storage Manager
 * Uses IndexedDB to store large audio files (bypassing Chrome storage quota limits)
 */

class AudioStorageManager {
  constructor() {
    this.dbName = 'SonaraAudioDB';
    this.dbVersion = 1;
    this.storeName = 'audioFiles';
    this.db = null;
  }

  /**
   * Initialize IndexedDB
   */
  async init() {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, { keyPath: 'bookmarkId' });
          objectStore.createIndex('bookmarkId', 'bookmarkId', { unique: true });
        }
      };
    });
  }

  /**
   * Save audio data to IndexedDB
   * @param {string} bookmarkId - The bookmark ID
   * @param {string} base64Audio - Base64 encoded audio data
   * @param {string} mimeType - Audio MIME type (e.g., 'audio/mpeg')
   */
  async saveAudio(bookmarkId, base64Audio, mimeType = 'audio/mpeg') {
    try {
      await this.init();
      
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const audioData = {
        bookmarkId: bookmarkId,
        base64Audio: base64Audio,
        mimeType: mimeType,
        savedAt: Date.now()
      };

      return new Promise((resolve, reject) => {
        const request = store.put(audioData);
        request.onsuccess = () => {
          console.log(`Audio saved to IndexedDB for bookmark ${bookmarkId}`);
          resolve();
        };
        request.onerror = () => {
          console.error('Error saving audio to IndexedDB:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to save audio to IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Get audio data from IndexedDB
   * @param {string} bookmarkId - The bookmark ID
   * @returns {Promise<{base64Audio: string, mimeType: string}>}
   */
  async getAudio(bookmarkId) {
    try {
      await this.init();
      
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.get(bookmarkId);
        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            resolve({
              base64Audio: result.base64Audio,
              mimeType: result.mimeType || 'audio/mpeg'
            });
          } else {
            resolve(null);
          }
        };
        request.onerror = () => {
          console.error('Error getting audio from IndexedDB:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to get audio from IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Delete audio data from IndexedDB
   * @param {string} bookmarkId - The bookmark ID
   */
  async deleteAudio(bookmarkId) {
    try {
      await this.init();
      
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.delete(bookmarkId);
        request.onsuccess = () => {
          console.log(`Audio deleted from IndexedDB for bookmark ${bookmarkId}`);
          resolve();
        };
        request.onerror = () => {
          console.error('Error deleting audio from IndexedDB:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to delete audio from IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Check if audio exists for a bookmark
   * @param {string} bookmarkId - The bookmark ID
   * @returns {Promise<boolean>}
   */
  async hasAudio(bookmarkId) {
    try {
      const audio = await this.getAudio(bookmarkId);
      return audio !== null;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
const audioStorageManager = new AudioStorageManager();
