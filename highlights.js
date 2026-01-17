/**
 * Sonara - Highlights Manager
 * Handles text highlighting and comments in articles
 */

class HighlightsManager {
  constructor() {
    this.dbName = 'SonaraHighlightsDB';
    this.dbVersion = 1;
    this.storeName = 'highlights';
    this.db = null;
    this.currentSelection = null;
    this.currentBookmarkId = null;
  }

  /**
   * Initialize IndexedDB for highlights
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
          const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
          objectStore.createIndex('bookmarkId', 'bookmarkId', { unique: false });
          objectStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  /**
   * Save a highlight
   * @param {string} bookmarkId - The bookmark ID
   * @param {string} text - The highlighted text
   * @param {string} comment - Optional comment
   * @param {string} context - Context around the highlight
   * @returns {Promise<string>} - Highlight ID
   */
  async saveHighlight(bookmarkId, text, comment = '', context = '') {
    try {
      await this.init();
      
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const highlight = {
        bookmarkId: bookmarkId,
        text: text.trim(),
        comment: comment.trim(),
        context: context.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      return new Promise((resolve, reject) => {
        const request = store.add(highlight);
        request.onsuccess = () => {
          console.log(`Highlight saved: ${request.result}`);
          resolve(request.result);
        };
        request.onerror = () => {
          console.error('Error saving highlight:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to save highlight:', error);
      throw error;
    }
  }

  /**
   * Get all highlights for a bookmark
   * @param {string} bookmarkId - The bookmark ID
   * @returns {Promise<Array>}
   */
  async getHighlightsForBookmark(bookmarkId) {
    try {
      await this.init();
      
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('bookmarkId');
      
      return new Promise((resolve, reject) => {
        const request = index.getAll(bookmarkId);
        request.onsuccess = () => {
          // Sort by creation date (newest first)
          const highlights = request.result.sort((a, b) => b.createdAt - a.createdAt);
          resolve(highlights);
        };
        request.onerror = () => {
          console.error('Error getting highlights:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to get highlights:', error);
      throw error;
    }
  }

  /**
   * Get all highlights
   * @returns {Promise<Array>}
   */
  async getAllHighlights() {
    try {
      await this.init();
      
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          // Sort by creation date (newest first)
          const highlights = request.result.sort((a, b) => b.createdAt - a.createdAt);
          resolve(highlights);
        };
        request.onerror = () => {
          console.error('Error getting all highlights:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to get all highlights:', error);
      throw error;
    }
  }

  /**
   * Delete a highlight
   * @param {number} highlightId - The highlight ID
   */
  async deleteHighlight(highlightId) {
    try {
      await this.init();
      
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.delete(highlightId);
        request.onsuccess = () => {
          console.log(`Highlight deleted: ${highlightId}`);
          resolve();
        };
        request.onerror = () => {
          console.error('Error deleting highlight:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to delete highlight:', error);
      throw error;
    }
  }

  /**
   * Update a highlight comment
   * @param {number} highlightId - The highlight ID
   * @param {string} comment - New comment text
   */
  async updateHighlightComment(highlightId, comment) {
    try {
      await this.init();
      
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const getRequest = store.get(highlightId);
        getRequest.onsuccess = () => {
          const highlight = getRequest.result;
          if (highlight) {
            highlight.comment = comment.trim();
            highlight.updatedAt = Date.now();
            const putRequest = store.put(highlight);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          } else {
            reject(new Error('Highlight not found'));
          }
        };
        getRequest.onerror = () => reject(getRequest.error);
      });
    } catch (error) {
      console.error('Failed to update highlight:', error);
      throw error;
    }
  }
}

// Export singleton instance
const highlightsManager = new HighlightsManager();
