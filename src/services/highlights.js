/**
 * Sonara - Highlights Manager
 * Handles text highlighting and comments in articles
 */

class HighlightsManager {
  constructor() {
    this.dbName = 'SonaraHighlightsDB';
    this.dbVersion = 1;
    this.storeName = 'highlights';
    this.currentSelection = null;
    this.currentBookmarkId = null;
  }

  /**
   * Get a fresh database connection
   * Always returns a new connection to avoid stale connection issues
   */
  async getDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve(request.result);
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
   * Initialize IndexedDB for highlights (for backwards compatibility)
   */
  async init() {
    return this.getDB();
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
      const db = await this.getDB();
      
      const transaction = db.transaction([this.storeName], 'readwrite');
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
      const db = await this.getDB();
      
      const transaction = db.transaction([this.storeName], 'readonly');
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
      const db = await this.getDB();
      
      const transaction = db.transaction([this.storeName], 'readonly');
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
      const db = await this.getDB();
      
      // Ensure ID is a number (IndexedDB auto-increment IDs are numbers)
      const id = typeof highlightId === 'string' ? parseInt(highlightId, 10) : Number(highlightId);
      
      if (isNaN(id)) {
        throw new Error(`Invalid highlight ID: ${highlightId}`);
      }
      
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => {
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
   * Delete all highlights for a bookmark
   * @param {string} bookmarkId - The bookmark ID
   * @returns {Promise<number>} - Number of highlights deleted
   */
  async deleteHighlightsForBookmark(bookmarkId) {
    try {
      const db = await this.getDB();
      
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('bookmarkId');
      
      return new Promise((resolve, reject) => {
        const getRequest = index.getAll(bookmarkId);
        getRequest.onsuccess = () => {
          const highlights = getRequest.result;
          if (highlights.length === 0) {
            resolve(0);
            return;
          }
          
          let deletedCount = 0;
          let errorCount = 0;
          
          highlights.forEach(highlight => {
            const deleteRequest = store.delete(highlight.id);
            deleteRequest.onsuccess = () => {
              deletedCount++;
              if (deletedCount + errorCount === highlights.length) {
                console.log(`Deleted ${deletedCount} highlight(s) for bookmark ${bookmarkId}`);
                resolve(deletedCount);
              }
            };
            deleteRequest.onerror = () => {
              console.error(`Error deleting highlight ${highlight.id}:`, deleteRequest.error);
              errorCount++;
              if (deletedCount + errorCount === highlights.length) {
                resolve(deletedCount);
              }
            };
          });
        };
        getRequest.onerror = () => {
          console.error('Error getting highlights for deletion:', getRequest.error);
          reject(getRequest.error);
        };
      });
    } catch (error) {
      console.error('Failed to delete highlights for bookmark:', error);
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
      const db = await this.getDB();
      
      const transaction = db.transaction([this.storeName], 'readwrite');
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
