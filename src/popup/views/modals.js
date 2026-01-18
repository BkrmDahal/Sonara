/**
 * Sonara - Modal Handlers
 * Handles various modal dialogs (delete confirmation, edit tags, etc.)
 */

// State for modals
let pendingDeleteBookmarkId = null;

/**
 * Handle delete bookmark
 * @param {string} bookmarkId - The bookmark ID to delete
 */
async function handleDelete(bookmarkId) {
  pendingDeleteBookmarkId = bookmarkId;
  
  // Get bookmark info for confirmation
  const bookmarks = await storageManager.getBookmarks();
  const bookmark = bookmarks.find(b => b.id === bookmarkId);
  
  const confirmTitle = document.getElementById('deleteConfirmTitle');
  if (confirmTitle && bookmark) {
    confirmTitle.textContent = `Delete "${truncateText(bookmark.title, 50)}"?`;
  }
  
  const modal = document.getElementById('deleteConfirmModal');
  if (modal) {
    modal.classList.add('active');
  }
}

/**
 * Handle confirm delete
 */
async function handleConfirmDelete() {
  if (!pendingDeleteBookmarkId) return;
  
  try {
    // Delete associated audio from IndexedDB
    await audioStorageManager.deleteAudio(pendingDeleteBookmarkId);
    
    // Delete highlights for this bookmark
    await highlightsManager.deleteHighlightsForBookmark(pendingDeleteBookmarkId);
    
    // Delete bookmark
    await storageManager.deleteBookmark(pendingDeleteBookmarkId);
    
    closeDeleteConfirmModal();
    
    // Refresh bookmarks list
    await loadBookmarks();
    
    showToast('Bookmark deleted successfully');
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    alert('Failed to delete bookmark: ' + error.message);
  }
}

/**
 * Close delete confirmation modal
 */
function closeDeleteConfirmModal() {
  const modal = document.getElementById('deleteConfirmModal');
  if (modal) {
    modal.classList.remove('active');
  }
  pendingDeleteBookmarkId = null;
}

/**
 * Handle edit tags for bookmark
 * @param {string} bookmarkId - The bookmark ID
 */
async function handleEditTags(bookmarkId) {
  const bookmarks = await storageManager.getBookmarks();
  const bookmark = bookmarks.find(b => b.id === bookmarkId);
  
  if (!bookmark) return;
  
  // Store current bookmark for editing
  window.editingTagsBookmarkId = bookmarkId;
  
  // Populate current tags
  const tagContainer = document.getElementById('editTagsContainer');
  if (tagContainer) {
    tagContainer.innerHTML = '';
    (bookmark.tags || []).forEach(tag => {
      addTagChip(tagContainer, tag, true);
    });
  }
  
  // Load tag suggestions
  loadEditTagSuggestions();
  
  // Show modal
  const modal = document.getElementById('editTagsModal');
  if (modal) {
    modal.classList.add('active');
  }
}

/**
 * Add a tag chip to container
 * @param {HTMLElement} container - Container element
 * @param {string} tag - Tag name
 * @param {boolean} removable - Whether tag can be removed
 */
function addTagChip(container, tag, removable = false) {
  const chip = document.createElement('span');
  chip.className = 'tag-chip';
  chip.innerHTML = `
    ${escapeHtml(tag)}
    ${removable ? '<i class="fas fa-times remove-tag" data-tag="' + escapeHtml(tag) + '"></i>' : ''}
  `;
  
  if (removable) {
    const removeBtn = chip.querySelector('.remove-tag');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        chip.remove();
      });
    }
  }
  
  container.appendChild(chip);
}

/**
 * Load tag suggestions for edit modal
 */
function loadEditTagSuggestions() {
  const suggestionsContainer = document.getElementById('editTagSuggestions');
  if (!suggestionsContainer) return;
  
  suggestionsContainer.innerHTML = '';
  
  // Get current tags in edit container
  const currentTags = Array.from(document.querySelectorAll('#editTagsContainer .tag-chip'))
    .map(chip => chip.textContent.trim());
  
  // Filter out already selected tags
  const availableTags = allTags.filter(tag => !currentTags.includes(tag));
  
  availableTags.slice(0, 10).forEach(tag => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tag-suggestion';
    btn.textContent = tag;
    btn.addEventListener('click', () => {
      addEditTagSuggestion(tag);
    });
    suggestionsContainer.appendChild(btn);
  });
}

/**
 * Add suggested tag to edit container
 * @param {string} tag - Tag name
 */
function addEditTagSuggestion(tag) {
  const container = document.getElementById('editTagsContainer');
  if (!container) return;
  
  // Check if tag already exists
  const existingTags = Array.from(container.querySelectorAll('.tag-chip'))
    .map(chip => chip.textContent.trim());
  
  if (!existingTags.includes(tag)) {
    addTagChip(container, tag, true);
    loadEditTagSuggestions(); // Refresh suggestions
  }
}

/**
 * Handle save tags
 */
async function handleSaveTags() {
  const bookmarkId = window.editingTagsBookmarkId;
  if (!bookmarkId) return;
  
  try {
    const tagContainer = document.getElementById('editTagsContainer');
    const tags = Array.from(tagContainer.querySelectorAll('.tag-chip'))
      .map(chip => chip.textContent.trim())
      .filter(tag => tag);
    
    // Get bookmark and update tags
    const data = await storageManager.getAllData();
    const idx = data.bookmarks.findIndex(b => b.id === bookmarkId);
    
    if (idx >= 0) {
      data.bookmarks[idx].tags = tags;
      
      // Update global tags list
      tags.forEach(tag => {
        if (!data.tags.includes(tag)) {
          data.tags.push(tag);
        }
      });
      
      await storageManager.saveAllData(data);
    }
    
    closeEditTagsModal();
    await loadBookmarks();
    await loadTags();
    
    showToast('Tags updated successfully');
  } catch (error) {
    console.error('Error saving tags:', error);
    alert('Failed to save tags: ' + error.message);
  }
}

/**
 * Close edit tags modal
 */
function closeEditTagsModal() {
  const modal = document.getElementById('editTagsModal');
  if (modal) {
    modal.classList.remove('active');
  }
  window.editingTagsBookmarkId = null;
}

/**
 * Handle remove tag from bookmark
 * @param {string} bookmarkId - The bookmark ID
 * @param {string} tagToRemove - Tag to remove
 */
async function handleRemoveTag(bookmarkId, tagToRemove) {
  try {
    const data = await storageManager.getAllData();
    const idx = data.bookmarks.findIndex(b => b.id === bookmarkId);
    
    if (idx >= 0 && data.bookmarks[idx].tags) {
      data.bookmarks[idx].tags = data.bookmarks[idx].tags.filter(t => t !== tagToRemove);
      await storageManager.saveAllData(data);
      await loadBookmarks();
    }
  } catch (error) {
    console.error('Error removing tag:', error);
  }
}

/**
 * Handle archive bookmark
 */
async function handleSendToArchive() {
  if (!currentBookmark) return;
  
  try {
    if (currentBookmark.archived) {
      await storageManager.unarchiveBookmark(currentBookmark.id);
      showToast('Removed from archive');
    } else {
      await storageManager.archiveBookmark(currentBookmark.id);
      showToast('Moved to archive');
    }
    
    // Close modal and refresh
    closeTTSModal();
    await loadBookmarks();
  } catch (error) {
    console.error('Error archiving bookmark:', error);
    alert('Failed to archive: ' + error.message);
  }
}

/**
 * Close TTS modal
 */
function closeTTSModal() {
  const modal = document.getElementById('ttsModal');
  if (modal) {
    modal.classList.remove('active');
  }
  currentBookmark = null;
}

/**
 * Close bookmark modal
 */
function closeBookmarkModal() {
  const modal = document.getElementById('bookmarkModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

