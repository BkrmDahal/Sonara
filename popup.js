/**
 * Sonara - Popup UI Logic
 * Main interface for bookmark management, article listening, and settings
 */

let currentBookmarks = [];
let allTags = [];
let currentBookmark = null;
let pendingDeleteBookmarkId = null;
let originalMarkdown = null;
let isEditMode = false;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadBookmarks();
  await loadTags();
  await loadSettingsIntoUI();
  setupEventListeners();
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'AUDIO_READY') {
      loadBookmarks();
      refreshListenModalIfOpen(msg.bookmarkId);
    }
    // Listen for audio state updates from offscreen document
    if (msg.type === 'AUDIO_STATE_UPDATE' || msg.type === 'AUDIO_TIME_UPDATE') {
      updateAudioUIFromOffscreen(msg);
    }
    if (msg.type === 'AUDIO_PLAYING') {
      showBottomAudioPlayer();
      updateBottomAudioPlayer();
    }
  });
  
  // Store current playing bookmark for UI updates
  window.currentPlayingBookmarkId = null;
  
  // Check if audio is already playing on initialization
  checkAndShowPlayingAudio();
  
  // Periodically update UI from offscreen audio (every second when playing)
  setInterval(async () => {
    // Always check for playing audio, even if we don't have currentPlayingBookmarkId
    try {
      const stateResponse = await chrome.runtime.sendMessage({
        type: 'GET_AUDIO_STATE'
      });
      if (stateResponse && stateResponse.success && stateResponse.state) {
        const state = stateResponse.state;
        if (state.bookmarkId) {
          // Update current playing bookmark ID if we don't have it
          if (!window.currentPlayingBookmarkId || window.currentPlayingBookmarkId !== state.bookmarkId) {
            window.currentPlayingBookmarkId = state.bookmarkId;
            // Update bottom player info
            storageManager.getBookmarks().then(bookmarks => {
              const bookmark = bookmarks.find(b => b.id === state.bookmarkId);
              if (bookmark) {
                updateBottomAudioPlayerInfo(bookmark);
              }
            });
          }
          
          // Always show bottom player if audio is loaded/playing
          showBottomAudioPlayer();
          
          // Update UI with current time and duration
          updateBottomAudioPlayer();
          updateModalAudioControls();
          
          // Also send update message for consistency
          updateAudioUIFromOffscreen({
            bookmarkId: state.bookmarkId,
            currentTime: state.currentTime,
            duration: state.duration,
            state: state.playing ? 'playing' : 'paused'
          });
        }
      }
    } catch (error) {
      // Ignore errors if offscreen is not available
    }
  }, 500); // Update more frequently for smoother time display
});

// Check if audio is playing and show bottom player
async function checkAndShowPlayingAudio() {
  try {
    // Try to get audio state from offscreen
    const stateResponse = await chrome.runtime.sendMessage({
      type: 'GET_AUDIO_STATE'
    });
    
    if (stateResponse && stateResponse.success && stateResponse.state) {
      const state = stateResponse.state;
      
      // Show player if audio is loaded (playing or paused)
      if (state.bookmarkId) {
        window.currentPlayingBookmarkId = state.bookmarkId;
        
        // Find the bookmark to show title
        const bookmarks = await storageManager.getBookmarks();
        const bookmark = bookmarks.find(b => b.id === state.bookmarkId);
        
        if (bookmark) {
          updateBottomAudioPlayerInfo(bookmark);
          
          // Force show the player
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
    // Ignore if offscreen not available or no audio playing
    console.log('No audio in offscreen or offscreen not available');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Save button
  document.getElementById('saveBtn').addEventListener('click', handleSaveCurrentPage);
  
  // Create Audio
  document.getElementById('createAudioBtn').addEventListener('click', openCreateAudioModal);
  document.getElementById('closeCreateAudioModal').addEventListener('click', closeCreateAudioModal);
  document.getElementById('cancelCreateAudioBtn').addEventListener('click', closeCreateAudioModal);
  document.getElementById('generateAudioBtn').addEventListener('click', handleGenerateAudio);
  
  // Close create audio modal on outside click
  document.getElementById('createAudioModal').addEventListener('click', (e) => {
    if (e.target.id === 'createAudioModal') closeCreateAudioModal();
  });
  
  // Search
  document.getElementById('searchInput').addEventListener('input', handleSearch);
  
  // Tag filter
  document.getElementById('tagFilter').addEventListener('change', handleTagFilter);
  
  // Archive filter
  document.getElementById('archiveFilter').addEventListener('change', handleArchiveFilter);
  
  // Settings
  document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
  document.getElementById('closeSettingsModal').addEventListener('click', closeSettingsModal);
  document.getElementById('saveSettingsBtn').addEventListener('click', handleSaveSettings);
  document.getElementById('cancelSettingsBtn').addEventListener('click', closeSettingsModal);
  
  // Export/Import (now in settings)
  document.getElementById('exportDataBtn').addEventListener('click', handleExportData);
  document.getElementById('importDataBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput').addEventListener('change', handleImportFileSelect);
  document.getElementById('confirmImportBtn').addEventListener('click', handleConfirmImport);
  document.getElementById('cancelImportBtn').addEventListener('click', closeImportConfirmModal);
  document.getElementById('closeImportConfirmModal').addEventListener('click', closeImportConfirmModal);
  
  // Settings tab switching
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      switchSettingsTab(tabName);
    });
  });
  
  // Close import confirm modal on outside click
  document.getElementById('importConfirmModal').addEventListener('click', (e) => {
    if (e.target.id === 'importConfirmModal') closeImportConfirmModal();
  });
  
  // Modal close buttons
  document.getElementById('closeModal').addEventListener('click', closeBookmarkModal);
  document.getElementById('closeTTSModal').addEventListener('click', closeTTSModal);
  document.getElementById('closeEditTagsModal').addEventListener('click', closeEditTagsModal);
  document.getElementById('fullscreenArticleBtn').addEventListener('click', openFullscreenArticle);
  document.getElementById('closeFullscreenModal').addEventListener('click', closeFullscreenArticle);
  document.getElementById('fullscreenSaveHighlightBtn').addEventListener('click', saveHighlightDirectFullscreen);
  document.getElementById('fullscreenCancelHighlightBtn').addEventListener('click', cancelHighlightFullscreen);
  
  // Article editing
  document.getElementById('editArticleBtn').addEventListener('click', handleEditArticle);
  document.getElementById('saveAndRegenerateBtn').addEventListener('click', handleSaveAndRegenerate);
  document.getElementById('cancelEditBtn').addEventListener('click', handleCancelEdit);
  
  // Article search
  document.getElementById('articleSearchInput').addEventListener('input', handleArticleSearch);
  document.getElementById('articleSearchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handleArticleSearchNavigate('prev');
      } else {
        handleArticleSearchNavigate('next');
      }
    } else if (e.key === 'Escape') {
      clearArticleSearch();
    }
  });
  document.getElementById('articleSearchPrevBtn').addEventListener('click', () => handleArticleSearchNavigate('prev'));
  document.getElementById('articleSearchNextBtn').addEventListener('click', () => handleArticleSearchNavigate('next'));
  document.getElementById('articleSearchCloseBtn').addEventListener('click', clearArticleSearch);
  
  // Delete confirmation modal
  document.getElementById('closeDeleteConfirmModal').addEventListener('click', closeDeleteConfirmModal);
  document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteConfirmModal);
  document.getElementById('confirmDeleteBtn').addEventListener('click', handleConfirmDelete);
  
  // Close delete modal on outside click
  document.getElementById('deleteConfirmModal').addEventListener('click', (e) => {
    if (e.target.id === 'deleteConfirmModal') closeDeleteConfirmModal();
  });
  
  // Close fullscreen modal on outside click
  document.getElementById('fullscreenArticleModal').addEventListener('click', (e) => {
    if (e.target.id === 'fullscreenArticleModal') closeFullscreenArticle();
  });
  
  document.getElementById('settingsModal').addEventListener('click', (e) => {
    if (e.target.id === 'settingsModal') closeSettingsModal();
  });
  
  // Bookmark modal buttons
  document.getElementById('saveBookmarkBtn').addEventListener('click', handleSaveBookmark);
  document.getElementById('cancelBookmarkBtn').addEventListener('click', closeBookmarkModal);
  
  // Edit tags modal buttons
  document.getElementById('saveTagsBtn').addEventListener('click', handleSaveTags);
  document.getElementById('cancelTagsBtn').addEventListener('click', closeEditTagsModal);
  
  // Edit tags input - allow Enter key
  document.getElementById('editTagsInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSaveTags();
    }
  });
  
  // Tag suggestions for edit modal
  document.getElementById('editTagsInput').addEventListener('input', () => {
    loadEditTagSuggestions();
  });
  
  document.getElementById('downloadAudioBtn').addEventListener('click', handleDownloadAudio);
  document.getElementById('reprocessAudioBtn').addEventListener('click', handleReprocessAudio);
  document.getElementById('sendToArchiveBtn').addEventListener('click', handleSendToArchive);
  document.getElementById('retryAudioBtn').addEventListener('click', handleRetryAudio);
  document.getElementById('cancelAudioGenerationBtn').addEventListener('click', handleCancelAudioGeneration);
  document.getElementById('viewJobLogsBtn').addEventListener('click', openJobLogsModal);
  document.getElementById('closeJobLogsModal').addEventListener('click', closeJobLogsModal);
  document.getElementById('jobLogsFilter').addEventListener('change', handleJobLogsFilter);
  
  // Close job logs modal on outside click
  document.getElementById('jobLogsModal').addEventListener('click', (e) => {
    if (e.target.id === 'jobLogsModal') closeJobLogsModal();
  });
  
  // Highlights
  document.getElementById('highlightsBtn').addEventListener('click', openHighlightsModal);
  document.getElementById('closeHighlightsModal').addEventListener('click', closeHighlightsModal);
  document.getElementById('saveHighlightDirectBtn').addEventListener('click', saveHighlightDirect);
  document.getElementById('cancelHighlightBtn').addEventListener('click', cancelHighlight);
  
  // Close modals on outside click and handle button clicks
  document.getElementById('highlightsModal').addEventListener('click', (e) => {
    if (e.target.id === 'highlightsModal') {
      closeHighlightsModal();
      return;
    }
    
    // Handle button clicks (View in Sonara and Delete)
    let target = e.target;
    if (target.tagName !== 'BUTTON') {
      target = target.closest('button');
    }
    
    if (target) {
      // Handle "View in Sonara" button
      if (target.getAttribute('data-action') === 'view-in-sonara') {
        e.preventDefault();
        e.stopPropagation();
        const bookmarkId = target.getAttribute('data-bookmark-id');
        if (bookmarkId) {
          openArticleFromHighlight(bookmarkId);
        }
        return;
      }
      
      // Handle Delete button
      if (target.classList.contains('btn-delete') && target.hasAttribute('data-highlight-id')) {
        e.preventDefault();
        e.stopPropagation();
        const highlightId = target.getAttribute('data-highlight-id');
        if (highlightId) {
          deleteHighlight(highlightId);
        }
        return;
      }
    }
  });
  
  // Audio player
  const audioPlayer = document.getElementById('audioPlayer');
  
  // Update bottom player from offscreen audio (not local player)
  // Local player is just for UI, offscreen handles actual playback
  audioPlayer.addEventListener('timeupdate', () => {
    // Only update if not using offscreen (fallback mode)
    if (!window.currentPlayingBookmarkId) {
      updateBottomAudioPlayer();
    }
  });
  
  audioPlayer.addEventListener('loadedmetadata', () => {
    // Only update if not using offscreen (fallback mode)
    if (!window.currentPlayingBookmarkId) {
      updateBottomAudioPlayer();
    }
  });
  
  // Prevent any local playback when using offscreen
  // The audio element is only for duration calculation, not playback
  audioPlayer.addEventListener('play', async (e) => {
    // If audio is loaded in offscreen, prevent local playback
    if (window.currentPlayingBookmarkId) {
      e.preventDefault();
      e.stopImmediatePropagation();
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
      
      // Play in offscreen instead
      try {
        await playAudioInOffscreen(window.currentPlayingBookmarkId);
        showBottomAudioPlayer();
        updateBottomAudioPlayer();
      } catch (error) {
        console.error('Error playing audio in offscreen:', error);
        // Don't fallback to local - offscreen should work
      }
    } else {
      // No offscreen audio, allow local playback
      showBottomAudioPlayer();
      updateBottomAudioPlayer();
    }
  });
  
  // Also prevent any attempts to play locally when offscreen is active
  audioPlayer.addEventListener('click', (e) => {
    if (window.currentPlayingBookmarkId) {
      // If user clicks on audio element, use bottom player instead
      e.preventDefault();
      e.stopPropagation();
      toggleBottomAudioPlayPause();
    }
  }, true); // Use capture phase to intercept early
  
  audioPlayer.addEventListener('pause', () => {
    // Don't pause offscreen audio when local player pauses
    // Offscreen audio should continue playing independently
    // Only update UI
    updateBottomAudioPlayer();
  });
  
  audioPlayer.addEventListener('ended', () => {
    // Don't hide bottom player when audio ends - keep it visible
    // User can see what finished and can restart if needed
    updateBottomAudioPlayer();
  });
  
  // Bottom audio player controls
  document.getElementById('bottomPlayPauseBtn').addEventListener('click', toggleBottomAudioPlayPause);
  document.getElementById('bottomStopBtn').addEventListener('click', stopBottomAudio);
  
  // Modal audio player controls
  const modalPlayPauseBtn = document.getElementById('modalPlayPauseBtn');
  const modalStopBtn = document.getElementById('modalStopBtn');
  if (modalPlayPauseBtn) {
    modalPlayPauseBtn.addEventListener('click', async () => {
      try {
        if (window.currentTTSBookmark) {
          // Check if the currently loaded audio is for the same article we're viewing
          if (window.currentPlayingBookmarkId && window.currentPlayingBookmarkId === window.currentTTSBookmark.id) {
            // Same article - toggle play/pause
            await toggleBottomAudioPlayPause();
            updateModalAudioControls();
          } else {
            // Different article or no audio loaded - load and play this article's audio
            await playAudioInOffscreen(window.currentTTSBookmark.id);
            window.currentPlayingBookmarkId = window.currentTTSBookmark.id;
            // Update bottom player with the new article info
            updateBottomAudioPlayerInfo(window.currentTTSBookmark);
            showBottomAudioPlayer();
            
            // Retry loop to ensure audio actually starts playing
            // Sometimes the audio element needs more time to be ready
            let maxRetries = 5;
            let retryDelay = 150;
            
            for (let attempt = 0; attempt < maxRetries; attempt++) {
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              
              const stateResponse = await chrome.runtime.sendMessage({
                type: 'GET_AUDIO_STATE',
                bookmarkId: window.currentTTSBookmark.id
              });
              
              if (stateResponse && stateResponse.success && stateResponse.state) {
                if (stateResponse.state.playing) {
                  // Audio is playing, we're done
                  break;
                } else if (stateResponse.state.bookmarkId === window.currentTTSBookmark.id) {
                  // Audio loaded for correct bookmark but not playing - try to start it
                  await chrome.runtime.sendMessage({
                    type: 'AUDIO_RESUME',
                    bookmarkId: window.currentTTSBookmark.id
                  });
                }
              }
              
              // Increase delay for next retry
              retryDelay = Math.min(retryDelay * 1.5, 500);
            }
            
            updateBottomAudioPlayer();
            updateModalAudioControls();
          }
        }
      } catch (error) {
        console.error('Error in play button handler:', error);
      }
    });
  }
  if (modalStopBtn) {
    modalStopBtn.addEventListener('click', async () => {
      await stopBottomAudio();
      updateModalAudioControls();
      // Also update bottom player
      updateBottomAudioPlayer();
    });
  }
  
  // TTS controls
  document.getElementById('playBtn').addEventListener('click', handlePlayTTS);
  document.getElementById('pauseBtn').addEventListener('click', handlePauseTTS);
  document.getElementById('stopBtn').addEventListener('click', handleStopTTS);
  document.getElementById('speedSlider').addEventListener('input', handleSpeedChange);
  
  // Event delegation for bookmark actions (Listen, Delete, Edit Tags, Remove Tag)
  document.getElementById('bookmarksList').addEventListener('click', (e) => {
    // Handle tag removal
    if (e.target?.classList?.contains('tag-remove')) {
      e.preventDefault();
      e.stopPropagation();
      const tag = e.target.getAttribute('data-tag');
      const bookmarkId = e.target.getAttribute('data-bookmark-id');
      handleRemoveTag(bookmarkId, tag);
      return;
    }
    
    // Handle clicks on buttons or their child elements
    let target = e.target;
    
    // If clicked on text node or emoji, find the button parent
    if (target && target.tagName !== 'BUTTON') {
      target = target.closest('button');
    }
    
    if (target) {
      const action = target.getAttribute('data-action');
      const bookmarkId = target.getAttribute('data-bookmark-id');
      
      if (action === 'listen' && bookmarkId) {
        e.preventDefault();
        e.stopPropagation();
        handleListen(bookmarkId);
        return;
      }
      if (action === 'delete' && bookmarkId) {
        e.preventDefault();
        e.stopPropagation();
        handleDelete(bookmarkId);
        return;
      }
      if (action === 'edit-tags' && bookmarkId) {
        e.preventDefault();
        e.stopPropagation();
        handleEditTags(bookmarkId);
        return;
      }
      return;
    }
    
    // Click on card body (not a button, not tag-remove) → open Listen
    const item = e.target.closest('.bookmark-item');
    if (item && item.dataset.id) {
      e.preventDefault();
      e.stopPropagation();
      handleListen(item.dataset.id);
    }
  });
  
  // Close modal on outside click
  document.getElementById('bookmarkModal').addEventListener('click', (e) => {
    if (e.target.id === 'bookmarkModal') {
      closeBookmarkModal();
    }
  });
  
  document.getElementById('ttsModal').addEventListener('click', (e) => {
    if (e.target.id === 'ttsModal') {
      closeTTSModal();
    }
  });
  
  document.getElementById('editTagsModal').addEventListener('click', (e) => {
    if (e.target.id === 'editTagsModal') {
      closeEditTagsModal();
    }
  });
}

// Get bookmarks with archive, search, and tag filters applied
async function getFilteredBookmarks() {
  let list = await storageManager.getBookmarks();
  const arc = document.getElementById('archiveFilter')?.value || 'new';
  if (arc === 'new') list = list.filter(b => !b.archived);
  else if (arc === 'archived') list = list.filter(b => b.archived);
  const q = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
  if (q) list = list.filter(b =>
    (b.title || '').toLowerCase().includes(q) ||
    (b.url || '').toLowerCase().includes(q) ||
    (b.tags || []).some(t => t.toLowerCase().includes(q))
  );
  const tag = document.getElementById('tagFilter')?.value || '';
  if (tag) list = list.filter(b => (b.tags || []).includes(tag));
  
  // Sort by savedAt (newest first)
  list.sort((a, b) => {
    const timeA = a.savedAt || 0;
    const timeB = b.savedAt || 0;
    return timeB - timeA; // Descending order (newest first)
  });
  
  return list;
}

// Load bookmarks
async function loadBookmarks() {
  currentBookmarks = await getFilteredBookmarks();
  renderBookmarks(currentBookmarks);
}

// Load tags
async function loadTags() {
  allTags = await storageManager.getTags();
  renderTagFilter();
}

// Format duration in seconds to MM:SS
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Render bookmarks
function renderBookmarks(bookmarks) {
  const list = document.getElementById('bookmarksList');
  
  if (bookmarks.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No articles match. Try changing filters or save a page.</p></div>';
    return;
  }
  
  list.innerHTML = bookmarks.map(bookmark => `
    <div class="bookmark-item" data-id="${bookmark.id}">
      <div class="bookmark-title-row">
        <span class="bookmark-title">${escapeHtml(bookmark.title || 'Untitled')}</span>
        ${bookmark.audioStatus === 'generating' ? '<span class="audio-generating" title="Audio generating…"><span class="audio-generating-spinner"></span></span>' : ''}
        ${bookmark.audioStatus === 'error' ? `<span class="audio-error" title="${escapeHtml(bookmark.audioError || 'Audio generation failed')}">⚠️ Error</span>` : ''}
        ${bookmark.archived ? '<span class="badge-archived">Archived</span>' : ''}
        ${bookmark.audioDuration ? `<span class="audio-duration" title="Audio duration">🎧 ${formatDuration(bookmark.audioDuration)}</span>` : ''}
      </div>
      <div class="bookmark-url">${bookmark.isCustomAudio ? 'Custom Audio' : escapeHtml(bookmark.url)}</div>
      <div class="bookmark-tags-container">
        ${bookmark.tags && bookmark.tags.length > 0 ? `
          <div class="bookmark-tags" data-bookmark-id="${bookmark.id}">
            ${bookmark.tags.map(tag => `
              <span class="tag" data-tag="${escapeHtml(tag)}" data-bookmark-id="${bookmark.id}">
                ${escapeHtml(tag)}
                <span class="tag-remove" data-tag="${escapeHtml(tag)}" data-bookmark-id="${bookmark.id}">×</span>
              </span>
            `).join('')}
          </div>
        ` : `
          <div class="bookmark-tags" data-bookmark-id="${bookmark.id}"></div>
        `}
        <button class="btn btn-edit-tags" data-action="edit-tags" data-bookmark-id="${bookmark.id}">+ Edit Tags</button>
      </div>
      <div class="bookmark-actions">
        <button class="btn btn-listen" data-action="listen" data-bookmark-id="${bookmark.id}">🎧 Listen</button>
        <button class="btn btn-delete" data-action="delete" data-bookmark-id="${bookmark.id}">Delete</button>
      </div>
    </div>
  `).join('');
}

// Render tag filter
function renderTagFilter() {
  const select = document.getElementById('tagFilter');
  select.innerHTML = '<option value="">All Tags</option>' + 
    allTags.map(tag => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('');
}

// Handle save current page
async function handleSaveCurrentPage() {
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url) {
      alert('Unable to get current page URL');
      return;
    }
    
    // Extract article from current page
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractArticleFromPage
    });
    
    const article = results[0]?.result;
    
    if (!article) {
      alert('Unable to extract article content');
      return;
    }
    
    // Show modal to add tags
    currentBookmark = {
      url: tab.url,
      title: article.title || tab.title,
      extractedContent: article.text,
      html: article.html,
      author: article.author,
      publishedDate: article.publishedDate,
      tags: []
    };
    
    document.getElementById('bookmarkTitle').value = currentBookmark.title;
    document.getElementById('bookmarkTags').value = '';
    document.getElementById('bookmarkModal').classList.add('active');
    
    // Load tag suggestions
    loadTagSuggestions();
    
  } catch (error) {
    console.error('Error saving page:', error);
    alert('Error saving page: ' + error.message);
  }
}

// Extract article from page (injected function)
function extractArticleFromPage() {
  class ArticleExtractor {
    constructor() {
      this.articleSelectors = [
        'article', '[role="article"]', '.article', '.post', '.entry',
        '.content', '.main-content', '#content', '#main-content',
        '.story-body', '.article-body', '.post-content'
      ];
      this.removeSelectors = [
        'script', 'style', 'nav', 'header', 'footer',
        '.ad', '.advertisement', '.ads', '.sidebar', '.social-share',
        '.comments', '.comment-section', '.related-posts', '.newsletter',
        '[class*="ad"]', '[id*="ad"]'
      ];
    }
    
    extractArticle() {
      const doc = document.cloneNode(true);
      this.removeUnwantedElements(doc);
      let articleElement = this.findArticleElement(doc);
      if (!articleElement) articleElement = doc.body;
      
      return {
        text: this.extractText(articleElement).trim(),
        html: this.extractHTML(articleElement).trim(),
        title: this.extractTitle(doc),
        author: this.extractAuthor(doc),
        publishedDate: this.extractPublishedDate(doc)
      };
    }
    
    findArticleElement(doc) {
      for (const selector of this.articleSelectors) {
        const element = doc.querySelector(selector);
        if (element && this.isValidContent(element)) return element;
      }
      return null;
    }
    
    isValidContent(element) {
      const text = element.textContent || '';
      return text.trim().split(/\s+/).length > 50;
    }
    
    removeUnwantedElements(doc) {
      this.removeSelectors.forEach(selector => {
        try {
          doc.querySelectorAll(selector).forEach(el => el.remove());
        } catch (e) {}
      });
    }
    
    extractText(element) {
      if (!element) return '';
      const clone = element.cloneNode(true);
      clone.querySelectorAll('script, style').forEach(el => el.remove());
      let text = clone.textContent || '';
      text = text.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n\n');
      return text;
    }
    
    extractHTML(element) {
      return element ? element.innerHTML : '';
    }
    
    extractTitle(doc) {
      const selectors = ['h1', '.article-title', '.post-title', '.entry-title',
        '[property="og:title"]', 'meta[name="twitter:title"]'];
      for (const selector of selectors) {
        const el = doc.querySelector(selector);
        if (el) {
          const title = el.textContent || el.content || el.getAttribute('content');
          if (title && title.trim()) return title.trim();
        }
      }
      return doc.title || '';
    }
    
    extractAuthor(doc) {
      const selectors = ['[rel="author"]', '.author', '.byline',
        '[property="article:author"]', 'meta[name="author"]'];
      for (const selector of selectors) {
        const el = doc.querySelector(selector);
        if (el) {
          const author = el.textContent || el.content || el.getAttribute('content');
          if (author && author.trim()) return author.trim();
        }
      }
      return '';
    }
    
    extractPublishedDate(doc) {
      const selectors = ['time[datetime]', '[property="article:published_time"]',
        'meta[name="publish-date"]', '.published-date', '.post-date'];
      for (const selector of selectors) {
        const el = doc.querySelector(selector);
        if (el) {
          const date = el.getAttribute('datetime') || el.content || 
            el.getAttribute('content') || el.textContent;
          if (date && date.trim()) return date.trim();
        }
      }
      return '';
    }
  }
  
  const extractor = new ArticleExtractor();
  return extractor.extractArticle();
}

// Load tag suggestions
function loadTagSuggestions() {
  const suggestions = document.getElementById('tagSuggestions');
  if (allTags.length === 0) {
    suggestions.innerHTML = '';
    return;
  }
  
  suggestions.innerHTML = allTags.map(tag => 
    `<span class="tag-suggestion" onclick="addTagSuggestion('${escapeHtml(tag)}')">${escapeHtml(tag)}</span>`
  ).join('');
}

// Add tag suggestion
function addTagSuggestion(tag) {
  const input = document.getElementById('bookmarkTags');
  const currentTags = input.value.split(',').map(t => t.trim()).filter(t => t);
  if (!currentTags.includes(tag)) {
    currentTags.push(tag);
    input.value = currentTags.join(', ');
  }
}

// Handle save bookmark (audio is generated in the background)
async function handleSaveBookmark() {
  if (!currentBookmark) return;
  
  const title = document.getElementById('bookmarkTitle').value.trim();
  const tagsInput = document.getElementById('bookmarkTags').value.trim();
  
  currentBookmark.title = title || currentBookmark.title;
  currentBookmark.tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
  
  const settings = await storageManager.getSettings();
  const canGenerate = !!(settings.openaiApiKey && settings.openaiApiKey.trim() &&
      currentBookmark.extractedContent && currentBookmark.extractedContent.trim());
  
  if (canGenerate) {
    currentBookmark.audioStatus = 'generating';
  }
  
  const savedBookmark = await storageManager.saveBookmark(currentBookmark);
  const bookmarkId = savedBookmark.id;
  
  await loadBookmarks();
  await loadTags();
  closeBookmarkModal();
  
  if (canGenerate && bookmarkId) {
    chrome.runtime.sendMessage({ type: 'GENERATE_AUDIO', bookmarkId }).catch((err) => {
      console.error('Failed to send audio generation message:', err);
    });
  }
}

// Close bookmark modal
function closeBookmarkModal() {
  document.getElementById('bookmarkModal').classList.remove('active');
  currentBookmark = null;
}

// Handle search
async function handleSearch() {
  currentBookmarks = await getFilteredBookmarks();
  renderBookmarks(currentBookmarks);
}

// Handle tag filter
async function handleTagFilter() {
  currentBookmarks = await getFilteredBookmarks();
  renderBookmarks(currentBookmarks);
}

// Handle archive filter
async function handleArchiveFilter() {
  currentBookmarks = await getFilteredBookmarks();
  renderBookmarks(currentBookmarks);
}

// Handle listen
async function handleListen(bookmarkId) {
  try {
    const allBookmarks = await storageManager.getBookmarks();
    // Handle both string and number IDs
    let bookmark = allBookmarks.find(b => b.id === bookmarkId || String(b.id) === String(bookmarkId));
    
    if (!bookmark) {
      alert('Bookmark not found');
      return;
    }
    
    // For custom audio, extractedContent should always be available
    // For regular bookmarks, check if content exists
    if (!bookmark.isCustomAudio && (!bookmark.extractedContent || bookmark.extractedContent.trim() === '')) {
      alert('No article content available for this bookmark. Please use "Save Current Page" while on the article page.');
      return;
    }
    
    // Ensure we have content (for custom audio, extractedContent is the text)
    if (!bookmark.extractedContent || bookmark.extractedContent.trim() === '') {
      alert('No content available for this entry.');
      return;
    }
    
    // Show TTS modal
    // Convert HTML to markdown, then render as HTML for better readability
    const articleContentEl = document.getElementById('articleContent');
    let markdown = '';
    
    if (bookmark.isCustomAudio) {
      // For custom audio, use the text directly as markdown
      markdown = bookmark.extractedContent;
      const renderedHtml = renderMarkdown(markdown);
      articleContentEl.innerHTML = renderedHtml || markdown;
    } else if (bookmark.html && bookmark.html.trim()) {
      markdown = htmlToMarkdown(bookmark.html);
      const renderedHtml = renderMarkdown(markdown);
      articleContentEl.innerHTML = renderedHtml || bookmark.extractedContent;
    } else {
      // If no HTML, use extractedContent as markdown
      markdown = bookmark.extractedContent || '';
      const renderedHtml = renderMarkdown(markdown);
      articleContentEl.innerHTML = renderedHtml || markdown;
    }
    
    // Store original markdown for editing
    originalMarkdown = markdown;
    isEditMode = false;
    articleContentEl.contentEditable = 'false';
    document.getElementById('editArticleToolbar').style.display = 'none';
    
    // Clear search when opening new article
    clearArticleSearch();
    
    // Load and display highlights for this article
    await loadHighlightsForArticle(bookmarkId, articleContentEl);
    
    // Setup text selection for highlighting
    setupTextSelection(bookmarkId, articleContentEl);
    
    // Set modal title to article title
    const modalTitle = document.getElementById('ttsModalTitle');
    if (modalTitle) {
      modalTitle.textContent = bookmark.title || 'Untitled';
    }
    
    document.getElementById('ttsModal').classList.add('active');
    
    // Set original article link (hide for custom audio)
    const originalLink = document.getElementById('originalArticleLink');
    if (originalLink) {
      if (bookmark.isCustomAudio || !bookmark.url || bookmark.url.startsWith('custom://')) {
        originalLink.style.display = 'none';
      } else {
        originalLink.href = bookmark.url;
        originalLink.style.display = 'inline-flex';
      }
    }
    
    // Store current bookmark for TTS
    window.currentTTSBookmark = bookmark;
    
    // Audio ready, generating, or browser TTS fallback
    const playerEl = document.getElementById('audioPlayerContainer');
    const generatingEl = document.getElementById('audioGeneratingMsg');
    const errorEl = document.getElementById('audioErrorMsg');
    const errorTextEl = document.getElementById('audioErrorText');
    const ttsEl = document.getElementById('ttsControls');
    
    // Check for audio in IndexedDB first, then fallback to chrome.storage
    let audioData = null;
    let mimeType = bookmark.audioMimeType || 'audio/mpeg';
    
    if (bookmark.audioStored) {
      // Audio is stored in IndexedDB
      try {
        const audio = await audioStorageManager.getAudio(bookmarkId);
        if (audio) {
          audioData = audio.base64Audio;
          mimeType = audio.mimeType || 'audio/mpeg';
        }
      } catch (error) {
        console.error('Error retrieving audio from IndexedDB:', error);
        // Fallback to chrome.storage if IndexedDB fails
        if (bookmark.audioData) {
          audioData = bookmark.audioData;
        }
      }
    } else if (bookmark.audioData) {
      // Legacy: audio stored in chrome.storage
      // Migrate to IndexedDB if the audio is large (to prevent quota issues)
      audioData = bookmark.audioData;
      if (audioData.length > 2 * 1024 * 1024) { // If larger than 2MB, migrate to IndexedDB
        try {
          await audioStorageManager.saveAudio(bookmarkId, audioData, mimeType);
          bookmark.audioStored = true;
          delete bookmark.audioData;
          await storageManager.saveBookmark(bookmark);
          console.log(`Migrated audio to IndexedDB for bookmark ${bookmarkId}`);
        } catch (migrationError) {
          console.warn('Failed to migrate audio to IndexedDB:', migrationError);
          // Keep using chrome.storage if migration fails
        }
      }
    }

    if (audioData) {
      // Load audio in offscreen document (but don't play - user must click play)
      try {
        // Check if audio is currently loaded (playing or paused) BEFORE loading new audio
        let isAudioLoadedForOther = false;
        let currentlyLoadedBookmarkId = null;
        
        if (window.currentPlayingBookmarkId) {
          try {
            const currentState = await chrome.runtime.sendMessage({
              type: 'GET_AUDIO_STATE'
            });
            if (currentState && currentState.success && currentState.state) {
              // Check if audio is loaded (has bookmarkId), not just if it's playing
              if (currentState.state.bookmarkId) {
                currentlyLoadedBookmarkId = currentState.state.bookmarkId;
                // Only consider it "loaded for other" if it's a DIFFERENT article
                if (currentlyLoadedBookmarkId !== bookmarkId) {
                  isAudioLoadedForOther = true;
                }
              }
            }
          } catch (error) {
            // Ignore errors
          }
        }
        
        // Only load new audio if:
        // 1. No audio is currently loaded for a different article, OR
        // 2. This is the same article that's already loaded
        if (!isAudioLoadedForOther) {
          // Safe to load - no audio loaded or same article
          await loadAudioInOffscreen(bookmarkId, audioData, mimeType, bookmark.title);
          updateBottomAudioPlayerInfo(bookmark);
          window.currentPlayingBookmarkId = bookmarkId;
        } else {
          // Different article has audio loaded - DON'T load new audio yet
          // This prevents stopping current playback
          // Audio will be loaded when user clicks play
          console.log('Audio is loaded for different article (', currentlyLoadedBookmarkId, '), not loading new audio for:', bookmarkId);
          console.log('New audio will be loaded when user clicks play');
          // Don't change currentPlayingBookmarkId - keep the loaded one
          // But still set up local player for UI
        }
        
        // Also set up local player for UI (hidden, just for duration calculation)
        const audioBlob = new Blob([Uint8Array.from(atob(audioData), c => c.charCodeAt(0))], { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audioPlayer = document.getElementById('audioPlayer');
        audioPlayer.src = audioUrl;
        
        // Disable native controls when using offscreen - use bottom player instead
        // This prevents local playback and ensures offscreen handles it
        audioPlayer.controls = false;
        audioPlayer.removeAttribute('controls');
        
        // Calculate and save duration if not already set
        if (!bookmark.audioDuration) {
          audioPlayer.addEventListener('loadedmetadata', async () => {
            const duration = audioPlayer.duration;
            if (duration && !isNaN(duration) && duration > 0) {
              bookmark.audioDuration = duration;
              await storageManager.saveBookmark(bookmark);
              await loadBookmarks(); // Refresh to show duration
              updateBottomAudioPlayer();
            }
          }, { once: true });
        }
        
        playerEl.style.display = 'block';
        generatingEl.style.display = 'none';
        errorEl.style.display = 'none';
        ttsEl.style.display = 'none';
        bookmark.audioUrl = audioUrl;
        
        // Only update bottom player if we loaded audio for this article
        // Don't change bottom player when another article's audio is loaded
        if (!isAudioLoadedForOther) {
          console.log('Audio loaded, showing bottom player for bookmark:', bookmarkId);
          
          // Force show the player immediately
          const bottomPlayer = document.getElementById('bottomAudioPlayer');
          if (bottomPlayer) {
            bottomPlayer.style.display = 'flex';
            bottomPlayer.style.visibility = 'visible';
            bottomPlayer.style.opacity = '1';
          }
          
          showBottomAudioPlayer();
          updateBottomAudioPlayer();
          updateModalAudioControls();
          
          // Force show the player after a short delay to ensure it's visible
          setTimeout(() => {
            if (bottomPlayer) {
              bottomPlayer.style.display = 'flex';
              bottomPlayer.style.visibility = 'visible';
              bottomPlayer.style.opacity = '1';
              console.log('Bottom player forced visible');
            }
            updateBottomAudioPlayer();
            updateModalAudioControls();
          }, 200);
        } else {
          // Another article's audio is loaded - just update modal controls for this article
          updateModalAudioControls();
        }
      } catch (error) {
        console.error('Error loading audio in offscreen:', error);
        // Fallback to local player
        const audioBlob = new Blob([Uint8Array.from(atob(audioData), c => c.charCodeAt(0))], { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audioPlayer = document.getElementById('audioPlayer');
        audioPlayer.src = audioUrl;
        bookmark.audioUrl = audioUrl;
        playerEl.style.display = 'block';
        generatingEl.style.display = 'none';
        errorEl.style.display = 'none';
        ttsEl.style.display = 'none';
        
        // Don't auto-play - user must click play
        showBottomAudioPlayer();
        updateBottomAudioPlayer();
      }
    } else if (bookmark.audioStatus === 'generating') {
      playerEl.style.display = 'none';
      generatingEl.style.display = 'flex';
      errorEl.style.display = 'none';
      ttsEl.style.display = 'none';
    } else if (bookmark.audioStatus === 'error') {
      playerEl.style.display = 'none';
      generatingEl.style.display = 'none';
      errorEl.style.display = 'flex';
      ttsEl.style.display = 'flex';
      document.getElementById('ttsVoiceGroup').style.display = 'none';
      // Show error message to user
      const errorMsg = bookmark.audioError || 'Audio generation failed';
      errorTextEl.textContent = errorMsg;
      console.error('Audio generation error for bookmark:', bookmark.id, errorMsg);
    } else {
      playerEl.style.display = 'none';
      generatingEl.style.display = 'none';
      errorEl.style.display = 'none';
      ttsEl.style.display = 'flex';
      document.getElementById('ttsVoiceGroup').style.display = 'none';
    }
    
    ttsEngine.stop();
    
    // Set up callbacks
    ttsEngine.setProgressCallback(() => {
      updateTTSControls();
    });
    
    ttsEngine.setCompleteCallback(() => {
      updateTTSControls();
    });
    
    // Archive button state
    const archiveBtn = document.getElementById('sendToArchiveBtn');
    if (bookmark.archived) {
      archiveBtn.disabled = true;
      archiveBtn.classList.add('archived');
      archiveBtn.title = 'Archived';
    } else {
      archiveBtn.disabled = false;
      archiveBtn.classList.remove('archived');
      archiveBtn.title = 'Archive';
    }
    
    // Update controls after modal is shown
    setTimeout(() => {
      updateTTSControls();
    }, 100);
  } catch (error) {
    console.error('Error in handleListen:', error);
    alert('Error opening article: ' + error.message);
  }
}

// Handle play TTS (only used when no pre-saved audio; uses browser TTS)
async function handlePlayTTS() {
  if (!window.currentTTSBookmark) return;
  
  const text = window.currentTTSBookmark.extractedContent;
  if (!text || !text.trim()) {
    alert('No content to play');
    return;
  }
  
  try {
    const speed = parseFloat(document.getElementById('speedSlider').value);
    const status = ttsEngine.getStatus();
    
    if (status.isPaused) {
      ttsEngine.resume();
    } else {
      await ttsEngine.speak(text, { rate: speed });
    }
    
    ttsEngine.setProgressCallback(() => updateTTSControls());
    ttsEngine.setCompleteCallback(() => updateTTSControls());
    setTimeout(() => updateTTSControls(), 200);
  } catch (error) {
    console.error('Error playing TTS:', error);
    alert('Error playing speech: ' + error.message);
  }
}

// Handle pause TTS
function handlePauseTTS() {
  try {
    ttsEngine.pause();
    // Update controls after a brief delay to ensure state is updated
    setTimeout(() => {
      updateTTSControls();
    }, 100);
  } catch (error) {
    console.error('Error pausing TTS:', error);
    alert('Error pausing speech: ' + error.message);
  }
}

// Handle stop TTS
function handleStopTTS() {
  try {
    ttsEngine.stop();
    // Update controls after a brief delay to ensure state is updated
    setTimeout(() => {
      updateTTSControls();
    }, 100);
  } catch (error) {
    console.error('Error stopping TTS:', error);
    alert('Error stopping speech: ' + error.message);
  }
}

// Handle speed change
function handleSpeedChange(e) {
  document.getElementById('speedValue').textContent = parseFloat(e.target.value).toFixed(1) + 'x';
  if (ttsEngine.getStatus().isPlaying) {
    handleStopTTS();
    handlePlayTTS();
  }
}

// Update TTS controls
function updateTTSControls() {
  const status = ttsEngine.getStatus();
  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  playBtn.disabled = status.isPlaying && !status.isPaused;
  pauseBtn.disabled = !status.isPlaying || status.isPaused;
  stopBtn.disabled = !status.isPlaying && !status.isPaused;
  
  if (status.isPaused) {
    playBtn.textContent = '▶ Resume';
  } else {
    playBtn.textContent = '▶ Play';
  }
}

// Handle edit tags
async function handleEditTags(bookmarkId) {
  const allBookmarks = await storageManager.getBookmarks();
  const bookmark = allBookmarks.find(b => b.id === bookmarkId);
  
  if (!bookmark) {
    alert('Bookmark not found');
    return;
  }
  
  // Store current bookmark for editing
  window.currentEditBookmark = bookmark;
  
  // Populate input with current tags
  document.getElementById('editTagsInput').value = bookmark.tags ? bookmark.tags.join(', ') : '';
  
  // Show modal
  document.getElementById('editTagsModal').classList.add('active');
  
  // Load tag suggestions
  loadEditTagSuggestions();
}

// --- Settings ---
async function loadSettingsIntoUI() {
  const settings = await storageManager.getSettings();
  const keyInput = document.getElementById('openaiApiKey');
  const voiceSelect = document.getElementById('openaiVoiceSelect');
  if (keyInput) keyInput.value = settings.openaiApiKey || '';
  if (voiceSelect) voiceSelect.value = settings.openaiVoice || 'coral';
  
  const ttsVoiceSelect = document.getElementById('ttsVoiceSelect');
  const voices = ['alloy','ash','ballad','coral','echo','fable','nova','onyx','sage','shimmer','verse','marin','cedar'];
  if (ttsVoiceSelect) {
    ttsVoiceSelect.innerHTML = voices.map(v => 
      `<option value="${v}">${v.charAt(0).toUpperCase() + v.slice(1)}</option>`
    ).join('');
  }
}

function openSettingsModal() {
  loadSettingsIntoUI();
  // Switch to General tab by default
  switchSettingsTab('general');
  document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('active');
}

async function handleSaveSettings() {
  const apiKey = document.getElementById('openaiApiKey').value.trim();
  const voice = document.getElementById('openaiVoiceSelect').value;
  await storageManager.saveSettings({ openaiApiKey: apiKey, openaiVoice: voice });
  closeSettingsModal();
}

// ==================== Export/Import Functions ====================

/**
 * Switch between settings tabs
 */
function switchSettingsTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.settings-tab').forEach(tab => {
    if (tab.getAttribute('data-tab') === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Update tab content
  document.querySelectorAll('.settings-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  if (tabName === 'general') {
    document.getElementById('generalSettingsTab').classList.add('active');
  } else if (tabName === 'export-import') {
    document.getElementById('exportImportSettingsTab').classList.add('active');
  }
}

/**
 * Get all audio files from IndexedDB
 */
async function getAllAudioFiles() {
  try {
    const db = audioStorageManager.db || await audioStorageManager.init();
    if (!db) return [];
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([audioStorageManager.storeName], 'readonly');
      const store = transaction.objectStore(audioStorageManager.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => {
        console.error('Error getting all audio files:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Failed to get all audio files:', error);
    return [];
  }
}

/**
 * Export all data to JSON file
 */
async function handleExportData() {
  try {
    const includeAudio = document.getElementById('exportIncludeAudio').checked;
    const includeApiKey = document.getElementById('exportIncludeApiKey').checked;
    
    // Show loading state
    const exportBtn = document.getElementById('exportDataBtn');
    const originalText = exportBtn.textContent;
    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';
    
    // Get all data
    const data = await storageManager.getAllData();
    const bookmarks = data.bookmarks || [];
    const tags = data.tags || [];
    let settings = { ...data.settings } || {};
    
    // Remove API key if not included
    if (!includeApiKey && settings.openaiApiKey) {
      settings.openaiApiKey = '';
    }
    
    // Get highlights
    const highlights = await highlightsManager.getAllHighlights();
    
    // Get audio files if requested
    let audioFiles = [];
    if (includeAudio) {
      try {
        audioFiles = await getAllAudioFiles();
      } catch (error) {
        console.error('Error getting audio files:', error);
        // Continue without audio files
      }
    }
    
    // Build export object
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      data: {
        bookmarks: bookmarks,
        tags: tags,
        settings: settings,
        highlights: highlights,
        audioFiles: audioFiles
      },
      metadata: {
        bookmarkCount: bookmarks.length,
        highlightCount: highlights.length,
        audioFileCount: audioFiles.length,
        includesAudio: includeAudio,
        includesApiKey: includeApiKey
      }
    };
    
    // Convert to JSON
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = `sonara-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Reset button
    exportBtn.disabled = false;
    exportBtn.textContent = originalText;
    
    // Show success message
    const fileSize = (blob.size / 1024 / 1024).toFixed(2);
    alert(`Export successful!\n\nFile size: ${fileSize} MB\nBookmarks: ${bookmarks.length}\nHighlights: ${highlights.length}\nAudio files: ${audioFiles.length}`);
    
  } catch (error) {
    console.error('Export failed:', error);
    alert('Export failed: ' + error.message);
    const exportBtn = document.getElementById('exportDataBtn');
    exportBtn.disabled = false;
    exportBtn.textContent = '📥 Export Data';
  }
}

/**
 * Handle file selection for import
 */
async function handleImportFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Reset file input
  event.target.value = '';
  
  try {
    const text = await file.text();
    const importData = JSON.parse(text);
    
    // Validate import data
    if (!importData.version || !importData.data) {
      throw new Error('Invalid export file format');
    }
    
    // Show preview and confirmation modal
    showImportPreview(importData);
    document.getElementById('importConfirmModal').classList.add('active');
    
    // Store import data temporarily
    window.pendingImportData = importData;
    
  } catch (error) {
    console.error('Import file read failed:', error);
    alert('Failed to read import file: ' + error.message);
  }
}

/**
 * Show import preview
 */
function showImportPreview(importData) {
  const preview = document.getElementById('importPreview');
  const data = importData.data || {};
  const metadata = importData.metadata || {};
  
  const bookmarkCount = data.bookmarks?.length || 0;
  const highlightCount = data.highlights?.length || 0;
  const audioFileCount = data.audioFiles?.length || 0;
  const tagCount = data.tags?.length || 0;
  
  preview.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 10px;">Import Preview:</div>
    <div style="line-height: 1.8;">
      <div>📚 <strong>Bookmarks:</strong> ${bookmarkCount}</div>
      <div>🏷️ <strong>Tags:</strong> ${tagCount}</div>
      <div>📑 <strong>Highlights:</strong> ${highlightCount}</div>
      <div>🎵 <strong>Audio files:</strong> ${audioFileCount}</div>
      ${importData.exportDate ? `<div style="margin-top: 8px; font-size: 12px; color: #6b7280;">Exported: ${new Date(importData.exportDate).toLocaleString()}</div>` : ''}
    </div>
  `;
  
  // Update warning based on mode
  const importMode = document.getElementById('importMode');
  updateImportWarning(importMode.value);
  
  // Update warning when mode changes
  importMode.addEventListener('change', () => {
    updateImportWarning(importMode.value);
  });
}

/**
 * Update import warning message
 */
function updateImportWarning(mode) {
  const warning = document.getElementById('importWarning');
  if (mode === 'replace') {
    warning.textContent = '⚠️ Warning: This will delete all your existing data and replace it with the imported data.';
  } else {
    warning.textContent = 'ℹ️ This will merge imported data with your existing data. Duplicates will be handled automatically.';
    warning.style.color = '#1976d2';
  }
}

/**
 * Close import confirmation modal
 */
function closeImportConfirmModal() {
  document.getElementById('importConfirmModal').classList.remove('active');
  window.pendingImportData = null;
}

/**
 * Handle confirmed import
 */
async function handleConfirmImport() {
  if (!window.pendingImportData) {
    alert('No import data available');
    return;
  }
  
  const importMode = document.getElementById('importMode').value;
  const importData = window.pendingImportData;
  const data = importData.data || {};
  
  try {
    // Show loading
    const confirmBtn = document.getElementById('confirmImportBtn');
    const originalText = confirmBtn.textContent;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Importing...';
    
    if (importMode === 'replace') {
      // Replace mode: Clear existing data and import new
      await replaceData(data);
    } else {
      // Merge mode: Merge with existing data
      await mergeData(data);
    }
    
    // Reset button
    confirmBtn.disabled = false;
    confirmBtn.textContent = originalText;
    
    // Close modals
    closeImportConfirmModal();
    closeSettingsModal();
    
    // Reload UI
    await loadBookmarks();
    await loadTags();
    
    // Show success
    alert('Import successful! Your data has been imported.');
    
  } catch (error) {
    console.error('Import failed:', error);
    alert('Import failed: ' + error.message);
    const confirmBtn = document.getElementById('confirmImportBtn');
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Import';
  }
}

/**
 * Replace all existing data with imported data
 */
async function replaceData(importData) {
  // Get existing data structure
  const existingData = await storageManager.getAllData();
  
  // Replace bookmarks, tags, and settings
  const newData = {
    bookmarks: importData.bookmarks || [],
    tags: importData.tags || [],
    settings: { ...existingData.settings, ...(importData.settings || {}) }, // Merge settings to keep any new defaults
    jobLogs: existingData.jobLogs || [] // Keep job logs
  };
  
  // If imported settings has API key, use it (unless it was empty in export)
  if (importData.settings?.openaiApiKey) {
    newData.settings.openaiApiKey = importData.settings.openaiApiKey;
  }
  
  // Save to Chrome Storage
  await storageManager.saveAllData(newData);
  
  // Replace highlights
  if (importData.highlights && Array.isArray(importData.highlights)) {
    // Clear existing highlights
    const allHighlights = await highlightsManager.getAllHighlights();
    for (const highlight of allHighlights) {
      await highlightsManager.deleteHighlight(highlight.id);
    }
    
    // Add imported highlights (IDs will be regenerated)
    for (const highlight of importData.highlights) {
      await highlightsManager.saveHighlight(
        highlight.bookmarkId,
        highlight.text,
        highlight.comment || '',
        highlight.context || ''
      );
    }
  }
  
  // Replace audio files
  if (importData.audioFiles && Array.isArray(importData.audioFiles)) {
    // Clear existing audio files
    const db = audioStorageManager.db || await audioStorageManager.init();
    const transaction = db.transaction([audioStorageManager.storeName], 'readwrite');
    const store = transaction.objectStore(audioStorageManager.storeName);
    const clearRequest = store.clear();
    
    await new Promise((resolve, reject) => {
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });
    
    // Add imported audio files
    for (const audioFile of importData.audioFiles) {
      await audioStorageManager.saveAudio(
        audioFile.bookmarkId,
        audioFile.base64Audio,
        audioFile.mimeType || 'audio/mpeg'
      );
    }
  }
}

/**
 * Merge imported data with existing data
 */
async function mergeData(importData) {
  const existingData = await storageManager.getAllData();
  const existingBookmarks = existingData.bookmarks || [];
  const existingTags = existingData.tags || [];
  const importedBookmarks = importData.bookmarks || [];
  const importedTags = importData.tags || [];
  
  // Merge bookmarks (match by URL, update if exists, add if new)
  const bookmarkMap = new Map();
  existingBookmarks.forEach(b => bookmarkMap.set(b.url, b));
  
  importedBookmarks.forEach(b => {
    if (bookmarkMap.has(b.url)) {
      // Update existing bookmark with imported data (but keep existing ID)
      const existing = bookmarkMap.get(b.url);
      Object.assign(existing, b);
      existing.id = bookmarkMap.get(b.url).id; // Keep original ID
    } else {
      // Add new bookmark
      bookmarkMap.set(b.url, b);
    }
  });
  
  const mergedBookmarks = Array.from(bookmarkMap.values());
  
  // Merge tags (deduplicate)
  const tagSet = new Set([...existingTags, ...importedTags]);
  const mergedTags = Array.from(tagSet);
  
  // Merge settings (keep existing API key if import doesn't have one)
  const mergedSettings = {
    ...existingData.settings,
    ...(importData.settings || {})
  };
  
  // Only use imported API key if it exists and is not empty
  if (importData.settings?.openaiApiKey) {
    mergedSettings.openaiApiKey = importData.settings.openaiApiKey;
  }
  
  // Save merged data
  await storageManager.saveAllData({
    bookmarks: mergedBookmarks,
    tags: mergedTags,
    settings: mergedSettings,
    jobLogs: existingData.jobLogs || []
  });
  
  // Merge highlights (add all, IDs will be regenerated)
  if (importData.highlights && Array.isArray(importData.highlights)) {
    for (const highlight of importData.highlights) {
      // Check if highlight already exists (by bookmarkId and text)
      const existingHighlights = await highlightsManager.getHighlightsForBookmark(highlight.bookmarkId);
      const exists = existingHighlights.some(h => h.text === highlight.text);
      
      if (!exists) {
        await highlightsManager.saveHighlight(
          highlight.bookmarkId,
          highlight.text,
          highlight.comment || '',
          highlight.context || ''
        );
      }
    }
  }
  
  // Merge audio files (replace if bookmarkId exists, add if new)
  if (importData.audioFiles && Array.isArray(importData.audioFiles)) {
    for (const audioFile of importData.audioFiles) {
      await audioStorageManager.saveAudio(
        audioFile.bookmarkId,
        audioFile.base64Audio,
        audioFile.mimeType || 'audio/mpeg'
      );
    }
  }
}

// Handle save tags
async function handleSaveTags() {
  if (!window.currentEditBookmark) return;
  
  const tagsInput = document.getElementById('editTagsInput').value.trim();
  const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
  
  window.currentEditBookmark.tags = tags;
  
  await storageManager.saveBookmark(window.currentEditBookmark);
  await loadBookmarks();
  await loadTags();
  closeEditTagsModal();
}

// Close edit tags modal
function closeEditTagsModal() {
  document.getElementById('editTagsModal').classList.remove('active');
  window.currentEditBookmark = null;
}

// Load tag suggestions for edit modal
function loadEditTagSuggestions() {
  const suggestions = document.getElementById('editTagSuggestions');
  if (allTags.length === 0) {
    suggestions.innerHTML = '';
    return;
  }
  
  const currentTags = document.getElementById('editTagsInput').value.split(',').map(t => t.trim()).filter(t => t);
  const availableTags = allTags.filter(tag => !currentTags.includes(tag));
  
  if (availableTags.length === 0) {
    suggestions.innerHTML = '';
    return;
  }
  
  suggestions.innerHTML = availableTags.map(tag => 
    `<span class="tag-suggestion" onclick="addEditTagSuggestion('${escapeHtml(tag)}')">${escapeHtml(tag)}</span>`
  ).join('');
}

// Add tag suggestion to edit input
function addEditTagSuggestion(tag) {
  const input = document.getElementById('editTagsInput');
  const currentTags = input.value.split(',').map(t => t.trim()).filter(t => t);
  if (!currentTags.includes(tag)) {
    currentTags.push(tag);
    input.value = currentTags.join(', ');
    loadEditTagSuggestions();
  }
}

// Handle remove tag
async function handleRemoveTag(bookmarkId, tagToRemove) {
  const allBookmarks = await storageManager.getBookmarks();
  const bookmark = allBookmarks.find(b => b.id === bookmarkId);
  
  if (!bookmark) return;
  
  // Remove the tag
  bookmark.tags = bookmark.tags.filter(tag => tag !== tagToRemove);
  
  await storageManager.saveBookmark(bookmark);
  await loadBookmarks();
  await loadTags();
}

// Handle delete - shows confirmation modal
async function handleDelete(bookmarkId) {
  if (!bookmarkId) {
    alert('Error: No bookmark ID provided');
    return;
  }
  
  // Get bookmark details for confirmation message
  let bookmarkTitle = 'this article';
  try {
    const allBookmarks = await storageManager.getBookmarks();
    const bookmark = allBookmarks.find(b => b.id === bookmarkId || String(b.id) === String(bookmarkId));
    if (bookmark) {
      bookmarkTitle = bookmark.title || 'this article';
    }
  } catch (err) {
    // Continue with generic title if fetch fails
  }
  
  // Store the bookmark ID for deletion
  pendingDeleteBookmarkId = bookmarkId;
  
  // Show confirmation modal
  const messageEl = document.getElementById('deleteConfirmMessage');
  messageEl.textContent = `Are you sure you want to delete "${bookmarkTitle}"?`;
  document.getElementById('deleteConfirmModal').classList.add('active');
}

// Handle confirmed delete
async function handleConfirmDelete() {
  const bookmarkId = pendingDeleteBookmarkId;
  
  if (!bookmarkId) {
    closeDeleteConfirmModal();
    return;
  }
  
  closeDeleteConfirmModal();
  
  try {
    // Delete associated highlights first
    try {
      await highlightsManager.deleteHighlightsForBookmark(bookmarkId);
    } catch (highlightsError) {
      // Continue with bookmark deletion even if highlights deletion fails
    }
    
    // Delete audio from IndexedDB if it exists
    try {
      await audioStorageManager.deleteAudio(bookmarkId);
    } catch (audioError) {
      // Continue with bookmark deletion even if audio deletion fails
    }
    
    // Delete the bookmark
    await storageManager.deleteBookmark(bookmarkId);
    
    // Reload bookmarks and tags
    await loadBookmarks();
    await loadTags();
    
    // If the deleted bookmark was currently being viewed, close the modal
    if (window.currentTTSBookmark && (window.currentTTSBookmark.id === bookmarkId || String(window.currentTTSBookmark.id) === String(bookmarkId))) {
      closeTTSModal();
      window.currentTTSBookmark = null;
    }
    
    // Clear pending delete
    pendingDeleteBookmarkId = null;
    
  } catch (error) {
    alert('Error deleting bookmark: ' + error.message);
    pendingDeleteBookmarkId = null;
  }
}

// Close delete confirmation modal
function closeDeleteConfirmModal() {
  document.getElementById('deleteConfirmModal').classList.remove('active');
  pendingDeleteBookmarkId = null;
}

// Send to archive (from Listen modal)
async function handleSendToArchive() {
  if (!window.currentTTSBookmark) return;
  const id = window.currentTTSBookmark.id;
  try {
    await storageManager.archiveBookmark(id);
    window.currentTTSBookmark.archived = true;
    const btn = document.getElementById('sendToArchiveBtn');
    btn.disabled = true;
    btn.classList.add('archived');
    btn.title = 'Archived';
    await loadBookmarks();
  } catch (e) {
    console.error('Archive failed:', e);
    alert('Failed to archive: ' + e.message);
  }
}

// Handle reprocess audio (regenerate existing audio)
async function handleReprocessAudio() {
  if (!window.currentTTSBookmark) return;
  
  const bookmarkId = window.currentTTSBookmark.id;
  const allBookmarks = await storageManager.getBookmarks();
  const bookmark = allBookmarks.find(b => b.id === bookmarkId);
  
  if (!bookmark) {
    alert('Bookmark not found');
    return;
  }
  
  if (!bookmark.extractedContent || bookmark.extractedContent.trim() === '') {
    alert('No article content available for audio generation.');
    return;
  }
  
  const settings = await storageManager.getSettings();
  if (!settings.openaiApiKey || !settings.openaiApiKey.trim()) {
    alert('OpenAI API key is required. Please configure it in Settings.');
    return;
  }
  
  // Delete existing audio from IndexedDB
  try {
    await audioStorageManager.deleteAudio(bookmarkId);
  } catch (err) {
    // Continue even if deletion fails
  }
  
  // Update status to generating and clear audio data
  bookmark.audioStatus = 'generating';
  delete bookmark.audioError;
  delete bookmark.audioStored;
  delete bookmark.audioData;
  delete bookmark.audioMimeType;
  delete bookmark.audioDuration;
  delete bookmark.audioUrl;
  
  // Save the updated bookmark
  const savedBookmark = await storageManager.saveBookmark(bookmark);
  
  // Update current bookmark reference
  window.currentTTSBookmark = savedBookmark;
  
  // Update UI to show generating state
  const playerEl = document.getElementById('audioPlayerContainer');
  const generatingEl = document.getElementById('audioGeneratingMsg');
  const errorEl = document.getElementById('audioErrorMsg');
  const ttsEl = document.getElementById('ttsControls');
  
  playerEl.style.display = 'none';
  generatingEl.style.display = 'flex';
  errorEl.style.display = 'none';
  ttsEl.style.display = 'none';
  
  // Clear audio player source
  const audioPlayer = document.getElementById('audioPlayer');
  if (audioPlayer && audioPlayer.src) {
    URL.revokeObjectURL(audioPlayer.src);
    audioPlayer.src = '';
  }
  
  // Reload bookmarks to update the list
  await loadBookmarks();
  
  // Trigger audio generation - send message to background script
  try {
    chrome.runtime.sendMessage({ type: 'GENERATE_AUDIO', bookmarkId }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending message:', chrome.runtime.lastError);
        // Handle error
        handleReprocessError(bookmarkId, chrome.runtime.lastError.message);
      } else if (response && !response.ok) {
        console.error('Generation failed:', response.error);
        handleReprocessError(bookmarkId, response.error || 'Failed to start audio generation');
      }
    });
  } catch (err) {
    console.error('Failed to send audio generation message:', err);
    handleReprocessError(bookmarkId, err.message);
  }
}

// Helper function to handle reprocess errors
async function handleReprocessError(bookmarkId, errorMessage) {
  const updatedBookmarks = await storageManager.getBookmarks();
  const updatedBookmark = updatedBookmarks.find(b => b.id === bookmarkId);
  if (updatedBookmark) {
    updatedBookmark.audioStatus = 'error';
    updatedBookmark.audioError = 'Failed to start generation: ' + errorMessage;
    await storageManager.saveBookmark(updatedBookmark);
    await loadBookmarks();
    
    // Update UI to show error
    const playerEl = document.getElementById('audioPlayerContainer');
    const generatingEl = document.getElementById('audioGeneratingMsg');
    const errorEl = document.getElementById('audioErrorMsg');
    const ttsEl = document.getElementById('ttsControls');
    
    playerEl.style.display = 'none';
    generatingEl.style.display = 'none';
    errorEl.style.display = 'flex';
    ttsEl.style.display = 'flex';
    document.getElementById('audioErrorText').textContent = updatedBookmark.audioError;
    window.currentTTSBookmark = updatedBookmark;
  }
}

// Handle cancel audio generation
async function handleCancelAudioGeneration() {
  if (!window.currentTTSBookmark) return;
  
  const bookmarkId = window.currentTTSBookmark.id;
  
  // Send cancel message to background
  try {
    await chrome.runtime.sendMessage({ type: 'CANCEL_AUDIO_GENERATION', bookmarkId });
  } catch (err) {
    console.error('Failed to send cancel message:', err);
  }
  
  // Update bookmark status
  const allBookmarks = await storageManager.getBookmarks();
  const bookmark = allBookmarks.find(b => b.id === bookmarkId);
  if (bookmark) {
    delete bookmark.audioStatus;
    delete bookmark.audioError;
    await storageManager.saveBookmark(bookmark);
    await loadBookmarks();
  }
  
  // Update UI - show TTS controls instead of generating message
  const playerEl = document.getElementById('audioPlayerContainer');
  const generatingEl = document.getElementById('audioGeneratingMsg');
  const errorEl = document.getElementById('audioErrorMsg');
  const ttsEl = document.getElementById('ttsControls');
  
  playerEl.style.display = 'none';
  generatingEl.style.display = 'none';
  errorEl.style.display = 'none';
  ttsEl.style.display = 'flex';
  
  // Update current bookmark reference
  if (bookmark) {
    window.currentTTSBookmark = bookmark;
  }
}

// Handle retry audio generation
async function handleRetryAudio() {
  if (!window.currentTTSBookmark) return;
  
  const bookmarkId = window.currentTTSBookmark.id;
  const allBookmarks = await storageManager.getBookmarks();
  const bookmark = allBookmarks.find(b => b.id === bookmarkId);
  
  if (!bookmark) {
    alert('Bookmark not found');
    return;
  }
  
  if (!bookmark.extractedContent || bookmark.extractedContent.trim() === '') {
    alert('No article content available for audio generation.');
    return;
  }
  
  const settings = await storageManager.getSettings();
  if (!settings.openaiApiKey || !settings.openaiApiKey.trim()) {
    alert('OpenAI API key is required. Please configure it in Settings.');
    return;
  }
  
  // Update status to generating
  bookmark.audioStatus = 'generating';
  delete bookmark.audioError;
  await storageManager.saveBookmark(bookmark);
  await loadBookmarks();
  
  // Update UI
  const playerEl = document.getElementById('audioPlayerContainer');
  const generatingEl = document.getElementById('audioGeneratingMsg');
  const errorEl = document.getElementById('audioErrorMsg');
  const ttsEl = document.getElementById('ttsControls');
  
  playerEl.style.display = 'none';
  generatingEl.style.display = 'flex';
  errorEl.style.display = 'none';
  ttsEl.style.display = 'none';
  
  // Update current bookmark reference
  window.currentTTSBookmark = bookmark;
  
  // Trigger audio generation
  try {
    await chrome.runtime.sendMessage({ type: 'GENERATE_AUDIO', bookmarkId });
    console.log('Retry audio generation initiated for bookmark:', bookmarkId);
  } catch (err) {
    console.error('Failed to send retry audio generation message:', err);
    alert('Failed to start audio generation. Please try again.');
    // Reset status on failure
    bookmark.audioStatus = 'error';
    bookmark.audioError = 'Failed to start generation: ' + err.message;
    await storageManager.saveBookmark(bookmark);
    await loadBookmarks();
  }
}

// When background finishes generating, switch from "Generating…" to the audio player if this modal is open
async function refreshListenModalIfOpen(bookmarkId) {
  if (!window.currentTTSBookmark || window.currentTTSBookmark.id !== bookmarkId) return;
  if (!document.getElementById('ttsModal').classList.contains('active')) return;
  const all = await storageManager.getBookmarks();
  const b = all.find(x => x.id === bookmarkId);
  if (!b) return;
  
  const playerEl = document.getElementById('audioPlayerContainer');
  const generatingEl = document.getElementById('audioGeneratingMsg');
  const errorEl = document.getElementById('audioErrorMsg');
  const ttsEl = document.getElementById('ttsControls');
  
  // Check for audio in IndexedDB first, then fallback to chrome.storage
  let audioData = null;
  let mimeType = b.audioMimeType || 'audio/mpeg';
  
  if (b.audioStored) {
    try {
      const audio = await audioStorageManager.getAudio(bookmarkId);
      if (audio) {
        audioData = audio.base64Audio;
        mimeType = audio.mimeType || 'audio/mpeg';
      }
    } catch (error) {
      console.error('Error retrieving audio from IndexedDB:', error);
      if (b.audioData) {
        audioData = b.audioData;
      }
    }
  } else if (b.audioData) {
    audioData = b.audioData;
  }

  if (audioData) {
    const audioBlob = new Blob([Uint8Array.from(atob(audioData), c => c.charCodeAt(0))], { type: mimeType });
    const audioUrl = URL.createObjectURL(audioBlob);
    window.currentTTSBookmark.audioStored = b.audioStored;
    window.currentTTSBookmark.audioData = audioData;
    window.currentTTSBookmark.audioMimeType = mimeType;
    window.currentTTSBookmark.audioUrl = audioUrl;
    const audioPlayer = document.getElementById('audioPlayer');
    audioPlayer.src = audioUrl;
    
    // Disable native controls when using offscreen
    if (window.currentPlayingBookmarkId) {
      audioPlayer.controls = false;
      audioPlayer.removeAttribute('controls');
    }
    
    playerEl.style.display = 'block';
    generatingEl.style.display = 'none';
    errorEl.style.display = 'none';
    ttsEl.style.display = 'none';
    
    // Update bottom player with new audio info
    if (b) {
      updateBottomAudioPlayerInfo(b);
    }
    
    // Don't auto-play - user must click play
    // Show bottom player so user can control playback
    showBottomAudioPlayer();
    
    // Show bottom audio player when audio starts playing (if user clicks play)
    audioPlayer.addEventListener('play', () => {
      showBottomAudioPlayer();
      updateBottomAudioPlayer();
    }, { once: true });
  } else if (b.audioStatus === 'error') {
    // Refresh error display
    const errorTextEl = document.getElementById('audioErrorText');
    errorTextEl.textContent = b.audioError || 'Audio generation failed';
    playerEl.style.display = 'none';
    generatingEl.style.display = 'none';
    errorEl.style.display = 'flex';
    ttsEl.style.display = 'flex';
    window.currentTTSBookmark = b;
  }
}

// Close TTS modal
function closeTTSModal() {
  ttsEngine.stop();
  
  // Exit edit mode if active
  if (isEditMode) {
    handleCancelEdit();
  }
  
  // Clear search
  clearArticleSearch();
  
  document.getElementById('ttsModal').classList.remove('active');
  // Don't clear currentTTSBookmark if audio is still playing - keep bottom player visible
  // Always keep bottom player visible if audio is loaded/playing
  // Don't hide it when closing modal - audio continues in background
  if (window.currentPlayingBookmarkId) {
    showBottomAudioPlayer();
  }
  updateTTSControls();
  originalMarkdown = null;
  isEditMode = false;
}

// Handle download audio
async function handleDownloadAudio() {
  if (!window.currentTTSBookmark) {
    alert('No audio file available');
    return;
  }
  
  try {
    const bookmark = window.currentTTSBookmark;
    
    // Get audio data from IndexedDB or chrome.storage
    let audioData = null;
    let mimeType = bookmark.audioMimeType || 'audio/mpeg';
    
    if (bookmark.audioStored) {
      try {
        const audio = await audioStorageManager.getAudio(bookmark.id);
        if (audio) {
          audioData = audio.base64Audio;
          mimeType = audio.mimeType || 'audio/mpeg';
        }
      } catch (error) {
        console.error('Error retrieving audio from IndexedDB for download:', error);
        if (bookmark.audioData) {
          audioData = bookmark.audioData;
        }
      }
    } else if (bookmark.audioData) {
      audioData = bookmark.audioData;
    }
    
    if (!audioData) {
      alert('No audio file available');
      return;
    }
    
    const extension = mimeType.includes('webm') ? 'webm' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3' : 'wav';
    const filename = `${bookmark.title.replace(/[^a-z0-9]/gi, '_')}.${extension}`;
    
    // Recreate blob from base64
    const audioBlob = new Blob([Uint8Array.from(atob(audioData), c => c.charCodeAt(0))], { type: mimeType });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    // Download using Chrome API
    chrome.downloads.download({
      url: audioUrl,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Download error:', chrome.runtime.lastError);
        // Fallback
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    });
  } catch (error) {
    console.error('Error downloading audio:', error);
    alert('Error downloading audio: ' + error.message);
  }
}

// Update audio time display (removed - using HTML5 audio controls and bottom player only)
// Removed duplicate time display to avoid confusion

// Update bottom audio player
async function updateBottomAudioPlayer() {
  const bottomTime = document.getElementById('bottomAudioTime');
  const bottomPlayPauseBtn = document.getElementById('bottomPlayPauseBtn');
  
  if (!bottomTime || !bottomPlayPauseBtn) {
    return;
  }
  
  // Try to get state from offscreen first
  if (window.currentPlayingBookmarkId) {
    try {
      const state = await chrome.runtime.sendMessage({
        type: 'GET_AUDIO_STATE',
        bookmarkId: window.currentPlayingBookmarkId
      });
      
      if (state && state.success && state.state) {
        const currentTime = state.state.currentTime !== undefined && !isNaN(state.state.currentTime) ? state.state.currentTime : 0;
        const duration = state.state.duration !== undefined && !isNaN(state.state.duration) && state.state.duration > 0 ? state.state.duration : 0;
        
        // Always show time, even if duration is 0 (will show as 0:00 / --:--)
        if (duration > 0) {
          bottomTime.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
        } else {
          // Try to get duration from local player as fallback
          const audioPlayer = document.getElementById('audioPlayer');
          if (audioPlayer && audioPlayer.duration && !isNaN(audioPlayer.duration) && audioPlayer.duration > 0) {
            bottomTime.textContent = `${formatTime(currentTime)} / ${formatTime(audioPlayer.duration)}`;
          } else {
            bottomTime.textContent = `${formatTime(currentTime)} / --:--`;
          }
        }
        
        // Update play/pause button
        if (state.state.playing) {
          bottomPlayPauseBtn.textContent = '⏸';
          bottomPlayPauseBtn.title = 'Pause';
        } else {
          bottomPlayPauseBtn.textContent = '▶';
          bottomPlayPauseBtn.title = 'Play';
        }
        return;
      }
    } catch (error) {
      console.error('Error getting audio state:', error);
      // Fall through to local player
    }
  }
  
  // Fallback to local player
  const audioPlayer = document.getElementById('audioPlayer');
  if (!audioPlayer.src || audioPlayer.src === '') {
    bottomTime.textContent = '0:00 / 0:00';
    return;
  }
  
  if (audioPlayer.duration && !isNaN(audioPlayer.duration) && audioPlayer.duration > 0) {
    const current = formatTime(audioPlayer.currentTime);
    const total = formatTime(audioPlayer.duration);
    bottomTime.textContent = `${current} / ${total}`;
  } else {
    bottomTime.textContent = `${formatTime(audioPlayer.currentTime)} / --:--`;
  }
  
  // Update play/pause button
  if (audioPlayer.paused) {
    bottomPlayPauseBtn.textContent = '▶';
    bottomPlayPauseBtn.title = 'Play';
  } else {
    bottomPlayPauseBtn.textContent = '⏸';
    bottomPlayPauseBtn.title = 'Pause';
  }
}

// Helper function to update play/pause button state with icon and text
function setPlayPauseButtonState(btn, isPlaying) {
  if (!btn) return;
  
  const playIcon = btn.querySelector('.play-icon');
  const pauseIcon = btn.querySelector('.pause-icon');
  const textSpan = btn.querySelector('.btn-text');
  
  if (isPlaying) {
    if (playIcon) playIcon.style.display = 'none';
    if (pauseIcon) pauseIcon.style.display = 'block';
    if (textSpan) textSpan.textContent = 'Pause';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
  } else {
    if (playIcon) playIcon.style.display = 'block';
    if (pauseIcon) pauseIcon.style.display = 'none';
    if (textSpan) textSpan.textContent = 'Play';
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-primary');
  }
}

// Update modal audio controls
async function updateModalAudioControls() {
  const modalPlayPauseBtn = document.getElementById('modalPlayPauseBtn');
  const modalStopBtn = document.getElementById('modalStopBtn');
  const modalAudioTime = document.getElementById('modalAudioTime');
  
  if (!modalPlayPauseBtn) return;
  
  if (window.currentPlayingBookmarkId) {
    try {
      const stateResponse = await chrome.runtime.sendMessage({
        type: 'GET_AUDIO_STATE',
        bookmarkId: window.currentPlayingBookmarkId
      });
      
      if (stateResponse && stateResponse.success && stateResponse.state) {
        const state = stateResponse.state;
        const isPlaying = state.playing;
        
        // Update play/pause button
        setPlayPauseButtonState(modalPlayPauseBtn, isPlaying);
        
        // Update stop button state
        if (modalStopBtn) {
          if (isPlaying || state.currentTime > 0) {
            modalStopBtn.disabled = false;
            modalStopBtn.style.opacity = '1';
          } else {
            modalStopBtn.disabled = false;
            modalStopBtn.style.opacity = '1';
          }
        }
        
        // Update time display - always show current time and duration
        if (modalAudioTime) {
          const currentTime = state.currentTime !== undefined && !isNaN(state.currentTime) ? state.currentTime : 0;
          const duration = state.duration !== undefined && !isNaN(state.duration) && state.duration > 0 ? state.duration : 0;
          
          if (duration > 0) {
            modalAudioTime.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
          } else {
            // Try to get duration from local player as fallback
            const audioPlayer = document.getElementById('audioPlayer');
            if (audioPlayer && audioPlayer.duration && !isNaN(audioPlayer.duration) && audioPlayer.duration > 0) {
              modalAudioTime.textContent = `${formatTime(currentTime)} / ${formatTime(audioPlayer.duration)}`;
            } else {
              modalAudioTime.textContent = `${formatTime(currentTime)} / --:--`;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error updating modal audio controls:', error);
      // Fallback to local player
      const audioPlayer = document.getElementById('audioPlayer');
      if (audioPlayer && audioPlayer.src) {
        if (modalAudioTime && audioPlayer.duration && !isNaN(audioPlayer.duration)) {
          modalAudioTime.textContent = `${formatTime(audioPlayer.currentTime)} / ${formatTime(audioPlayer.duration)}`;
        }
        if (modalPlayPauseBtn) {
          setPlayPauseButtonState(modalPlayPauseBtn, !audioPlayer.paused);
        }
      }
    }
  } else {
    // No audio loaded
    setPlayPauseButtonState(modalPlayPauseBtn, false);
    if (modalStopBtn) {
      modalStopBtn.disabled = false;
      modalStopBtn.style.opacity = '1';
    }
    if (modalAudioTime) {
      modalAudioTime.textContent = '0:00 / 0:00';
    }
  }
}

// Update UI from offscreen audio state
function updateAudioUIFromOffscreen(msg) {
  if (msg.bookmarkId === window.currentPlayingBookmarkId) {
    // Always show bottom player when audio is loaded (playing or paused)
    showBottomAudioPlayer();
    
    // Update bottom player
    updateBottomAudioPlayer();
    
    // Update modal controls (including time)
    updateModalAudioControls();
    
    // Update main player if modal is open
    if (window.currentTTSBookmark && window.currentTTSBookmark.id === msg.bookmarkId) {
      const audioPlayer = document.getElementById('audioPlayer');
      if (audioPlayer && msg.currentTime !== undefined) {
        // Sync local player time for UI (but don't play it)
        if (Math.abs(audioPlayer.currentTime - msg.currentTime) > 1) {
          audioPlayer.currentTime = msg.currentTime;
        }
      }
    }
  } else if (msg.bookmarkId) {
    // Audio is playing for a different bookmark - update our tracking
    window.currentPlayingBookmarkId = msg.bookmarkId;
    storageManager.getBookmarks().then(bookmarks => {
      const bookmark = bookmarks.find(b => b.id === msg.bookmarkId);
      if (bookmark) {
        updateBottomAudioPlayerInfo(bookmark);
      }
    });
    showBottomAudioPlayer();
    updateBottomAudioPlayer();
    updateModalAudioControls();
  }
}

// Load audio in offscreen document (without playing)
async function loadAudioInOffscreen(bookmarkId, audioData, mimeType, title, forceLoad = false) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'LOAD_AUDIO',
      bookmarkId: bookmarkId,
      audioData: audioData,
      mimeType: mimeType,
      title: title,
      forceLoad: forceLoad
    });
    
    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to load audio in offscreen');
    }
  } catch (error) {
    console.error('Error loading audio in offscreen:', error);
    throw error;
  }
}

// Play audio in offscreen document (when user clicks play)
async function playAudioInOffscreen(bookmarkId) {
  try {
    console.log('Attempting to play audio in offscreen for bookmark:', bookmarkId);
    
    // STEP 1: Stop current audio if different article is playing
    if (window.currentPlayingBookmarkId && window.currentPlayingBookmarkId !== bookmarkId) {
      try {
        const stopResponse = await chrome.runtime.sendMessage({
          type: 'AUDIO_STOP',
          bookmarkId: window.currentPlayingBookmarkId
        });
        console.log('Stopped previous audio:', window.currentPlayingBookmarkId, stopResponse);
        // Wait a bit for stop to complete and cleanup
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        console.error('Error stopping previous audio:', error);
      }
    }
    
    // STEP 2: Check if audio is already loaded for this bookmark
    let currentState = null;
    try {
      currentState = await chrome.runtime.sendMessage({
        type: 'GET_AUDIO_STATE'
      });
    } catch (error) {
      console.error('Error getting audio state:', error);
    }
    
    // STEP 3: If audio is not loaded for this bookmark, load it first
    // This can happen if user opened article while different audio was playing
    const needsLoad = !currentState || !currentState.success || !currentState.state || 
        currentState.state.bookmarkId !== bookmarkId;
    
    if (needsLoad) {
      console.log('Audio not loaded for bookmark, loading now:', bookmarkId);
      // Need to load audio first - get it from storage
      const bookmarks = await storageManager.getBookmarks();
      const bookmark = bookmarks.find(b => b.id === bookmarkId);
      if (bookmark) {
        let audioData = null;
        let mimeType = bookmark.audioMimeType || 'audio/mpeg';
        
        if (bookmark.audioStored) {
          try {
            const audio = await audioStorageManager.getAudio(bookmarkId);
            if (audio) {
              audioData = audio.base64Audio;
              mimeType = audio.mimeType || 'audio/mpeg';
            }
          } catch (error) {
            if (bookmark.audioData) {
              audioData = bookmark.audioData;
            }
          }
        } else if (bookmark.audioData) {
          audioData = bookmark.audioData;
        }
        
        if (audioData) {
          // Load audio with forceLoad=true (now that previous is stopped, this will work)
          console.log('Loading audio for bookmark:', bookmarkId);
          await loadAudioInOffscreen(bookmarkId, audioData, mimeType, bookmark.title, true);
          // Wait a bit for audio to be ready
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Verify it's loaded
          const verifyState = await chrome.runtime.sendMessage({
            type: 'GET_AUDIO_STATE'
          });
          if (verifyState && verifyState.success && verifyState.state && 
              verifyState.state.bookmarkId === bookmarkId) {
            console.log('Audio successfully loaded for bookmark:', bookmarkId);
          } else {
            console.warn('Audio may not be loaded correctly');
          }
        } else {
          throw new Error('No audio data found for bookmark');
        }
      } else {
        throw new Error('Bookmark not found');
      }
    } else {
      console.log('Audio already loaded for bookmark:', bookmarkId);
    }
    
    // STEP 4: Now play the audio
    console.log('Resuming/playing audio for bookmark:', bookmarkId);
    const response = await chrome.runtime.sendMessage({
      type: 'AUDIO_RESUME',
      bookmarkId: bookmarkId
    });
    
    if (!response || !response.success) {
      const errorMsg = response?.error || 'Failed to play audio in offscreen';
      console.error('Offscreen play failed:', errorMsg);
      throw new Error(errorMsg);
    }
    
    // Update current playing bookmark ID
    window.currentPlayingBookmarkId = bookmarkId;
    
    // Update bottom player info
    storageManager.getBookmarks().then(bookmarks => {
      const bookmark = bookmarks.find(b => b.id === bookmarkId);
      if (bookmark) {
        updateBottomAudioPlayerInfo(bookmark);
      }
    });
    
    // Ensure bottom player is visible
    showBottomAudioPlayer();
    
    console.log('Audio play command sent successfully to offscreen');
    
    // Verify it's actually playing after a short delay
    setTimeout(async () => {
      try {
        const stateResponse = await chrome.runtime.sendMessage({
          type: 'GET_AUDIO_STATE',
          bookmarkId: bookmarkId
        });
        if (stateResponse && stateResponse.success && stateResponse.state) {
          if (stateResponse.state.playing) {
            console.log('Verified: Audio is playing in offscreen');
          } else {
            console.warn('Warning: Audio play command sent but audio is not playing');
          }
        }
      } catch (err) {
        console.error('Error verifying audio state:', err);
      }
    }, 500);
    
  } catch (error) {
    console.error('Error playing audio in offscreen:', error);
    throw error;
  }
}

// Update bottom audio player info
function updateBottomAudioPlayerInfo(bookmark) {
  if (!bookmark) {
    return;
  }
  
  const bottomTitle = document.getElementById('bottomAudioTitle');
  if (bottomTitle) {
    bottomTitle.textContent = bookmark.title || 'Playing audio...';
  }
}

// Show bottom audio player - always show if there's any audio loaded/playing
function showBottomAudioPlayer() {
  const bottomPlayer = document.getElementById('bottomAudioPlayer');
  
  if (!bottomPlayer) {
    console.error('Bottom audio player element not found');
    return;
  }
  
  // Always check offscreen state first
  const hasOffscreenAudio = window.currentPlayingBookmarkId !== null;
  
  // Show if we have a playing bookmark ID (from offscreen)
  if (hasOffscreenAudio) {
    // Update info from bookmark ID
    storageManager.getBookmarks().then(bookmarks => {
      const bookmark = bookmarks.find(b => b.id === window.currentPlayingBookmarkId);
      if (bookmark) {
        updateBottomAudioPlayerInfo(bookmark);
      }
    });
    
    bottomPlayer.style.display = 'flex';
    bottomPlayer.style.visibility = 'visible';
    bottomPlayer.style.opacity = '1';
    updateBottomAudioPlayer();
    console.log('Bottom audio player shown for bookmark:', window.currentPlayingBookmarkId);
  } else {
    // Check if there's any audio playing in offscreen (even if we don't have the ID)
    chrome.runtime.sendMessage({ type: 'GET_AUDIO_STATE' }).then(stateResponse => {
      if (stateResponse && stateResponse.success && stateResponse.state && stateResponse.state.bookmarkId) {
        window.currentPlayingBookmarkId = stateResponse.state.bookmarkId;
        storageManager.getBookmarks().then(bookmarks => {
          const bookmark = bookmarks.find(b => b.id === window.currentPlayingBookmarkId);
          if (bookmark) {
            updateBottomAudioPlayerInfo(bookmark);
          }
        });
        bottomPlayer.style.display = 'flex';
        bottomPlayer.style.visibility = 'visible';
        bottomPlayer.style.opacity = '1';
        updateBottomAudioPlayer();
        console.log('Bottom audio player shown from offscreen state');
      }
    }).catch(() => {
      // No audio playing
    });
  }
}

// Hide bottom audio player
function hideBottomAudioPlayer() {
  const bottomPlayer = document.getElementById('bottomAudioPlayer');
  bottomPlayer.style.display = 'none';
}

// Toggle play/pause from bottom player
async function toggleBottomAudioPlayPause() {
  if (!window.currentPlayingBookmarkId) {
    // If no audio playing, try to open the last bookmark
    if (window.currentTTSBookmark) {
      handleListen(window.currentTTSBookmark.id);
    }
    return;
  }
  
  try {
    // Get current state from offscreen
    const stateResponse = await chrome.runtime.sendMessage({
      type: 'GET_AUDIO_STATE',
      bookmarkId: window.currentPlayingBookmarkId
    });
    
    if (stateResponse && stateResponse.success && stateResponse.state) {
      const isPlaying = stateResponse.state.playing;
      
      if (isPlaying) {
        // Currently playing - pause it
        const pauseResponse = await chrome.runtime.sendMessage({
          type: 'AUDIO_PAUSE',
          bookmarkId: window.currentPlayingBookmarkId
        });
        if (pauseResponse && !pauseResponse.success) {
          console.error('Failed to pause audio:', pauseResponse.error);
        } else {
          console.log('Audio paused successfully');
        }
      } else {
        // Not playing - resume/play it
        const resumeResponse = await chrome.runtime.sendMessage({
          type: 'AUDIO_RESUME',
          bookmarkId: window.currentPlayingBookmarkId
        });
        if (resumeResponse && !resumeResponse.success) {
          console.error('Failed to resume audio:', resumeResponse.error);
        } else {
          console.log('Audio resumed/started successfully');
        }
      }
    } else {
      // No valid state returned, try to resume anyway (audio might be loaded but not playing)
      console.log('No state returned, attempting to resume audio');
      const resumeResponse = await chrome.runtime.sendMessage({
        type: 'AUDIO_RESUME',
        bookmarkId: window.currentPlayingBookmarkId
      });
      if (resumeResponse && !resumeResponse.success) {
        console.error('Failed to resume audio:', resumeResponse.error);
      } else {
        console.log('Audio started successfully (no previous state)');
      }
    }
  } catch (error) {
    console.error('Error toggling audio:', error);
    // Fallback to local player if offscreen fails
    const audioPlayer = document.getElementById('audioPlayer');
    if (audioPlayer && audioPlayer.src) {
      // Re-enable controls for fallback
      audioPlayer.controls = true;
      if (audioPlayer.paused) {
        audioPlayer.play().catch(err => console.error('Error playing audio:', err));
      } else {
        audioPlayer.pause();
      }
    }
  }
  
  // Update UI after a short delay to allow state to update
  setTimeout(() => {
    updateBottomAudioPlayer();
    updateModalAudioControls();
  }, 200);
}

// Stop audio from bottom player
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
  
  // Hide bottom player only when explicitly stopped by user
  hideBottomAudioPlayer();
  updateBottomAudioPlayer();
  updateModalAudioControls();
}

// Format time (seconds to MM:SS)
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render Markdown to HTML
 * Converts markdown syntax to styled HTML
 */
function renderMarkdown(markdown) {
  if (!markdown || !markdown.trim()) {
    return '';
  }

  let html = markdown;
  
  // Process code blocks first (before other processing)
  const codeBlocks = [];
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    const id = `CODE_BLOCK_${codeBlocks.length}`;
    codeBlocks.push({ id, code: code.trim() });
    return id;
  });

  // Process inline code
  const inlineCodes = [];
  html = html.replace(/`([^`\n]+)`/g, (match, code) => {
    const id = `INLINE_CODE_${inlineCodes.length}`;
    inlineCodes.push({ id, code });
    return id;
  });

  // Escape HTML (but preserve placeholders)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Restore inline code
  inlineCodes.forEach(({ id, code }) => {
    html = html.replace(id, `<code>${code}</code>`);
  });

  // Restore code blocks
  codeBlocks.forEach(({ id, code }) => {
    html = html.replace(id, `<pre><code>${code}</code></pre>`);
  });

  // Headers (process from h6 to h1 to avoid conflicts)
  html = html.replace(/^###### (.+)$/gim, '<h6>$1</h6>');
  html = html.replace(/^##### (.+)$/gim, '<h5>$1</h5>');
  html = html.replace(/^#### (.+)$/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gim, '<h1>$1</h1>');

  // Horizontal rules
  html = html.replace(/^---$/gim, '<hr />');
  html = html.replace(/^\*\*\*$/gim, '<hr />');

  // Blockquotes
  html = html.replace(/^> (.+)$/gim, '<blockquote>$1</blockquote>');

  // Process lists - unordered
  html = html.replace(/^[-*] (.+)$/gim, '<li>$1</li>');
  
  // Process lists - ordered
  html = html.replace(/^\d+\. (.+)$/gim, '<li>$1</li>');

  // Wrap consecutive list items
  html = html.replace(/(<li>.*<\/li>(?:\n|$))+/g, (match) => {
    // Check if it's from an ordered list pattern (has numbers)
    const hasNumbers = /\d+\./.test(match);
    return hasNumbers ? `<ol>${match}</ol>` : `<ul>${match}</ul>`;
  });

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Images ![alt](src)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Bold (must come after code processing)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Italic (after bold to avoid conflicts)
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Split into paragraphs
  const lines = html.split('\n');
  const paragraphs = [];
  let currentPara = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) {
      if (currentPara.length > 0) {
        paragraphs.push(currentPara.join(' '));
        currentPara = [];
      }
      continue;
    }

    // Don't wrap block elements
    if (/^<(h[1-6]|ul|ol|pre|blockquote|hr|li)/.test(line)) {
      if (currentPara.length > 0) {
        paragraphs.push(currentPara.join(' '));
        currentPara = [];
      }
      paragraphs.push(line);
    } else {
      currentPara.push(line);
    }
  }

  if (currentPara.length > 0) {
    paragraphs.push(currentPara.join(' '));
  }

  // Wrap non-block elements in paragraphs
  html = paragraphs.map(para => {
    if (/^<(h[1-6]|ul|ol|pre|blockquote|hr)/.test(para)) {
      return para;
    }
    if (para.trim()) {
      return `<p>${para}</p>`;
    }
    return '';
  }).join('\n');

  // Clean up
  html = html.replace(/\n{3,}/g, '\n\n');
  html = html.trim();

  return html;
}

/**
 * Convert HTML to Markdown for better readability
 * Handles common article HTML elements
 */
function htmlToMarkdown(html) {
  if (!html || !html.trim()) {
    return '';
  }

  // Create a temporary DOM element to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Remove script and style tags
  tempDiv.querySelectorAll('script, style, noscript').forEach(el => el.remove());

  function processNode(node, depth = 0) {
    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.textContent || '';
      // Preserve single line breaks in text
      return text;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const tagName = node.tagName?.toLowerCase();
    const children = Array.from(node.childNodes);
    const content = children.map(child => processNode(child, depth + 1)).join('').trim();

    // Skip empty elements (except for line breaks)
    if (!content && tagName !== 'br' && tagName !== 'hr' && tagName !== 'img') {
      return '';
    }

    switch (tagName) {
      case 'h1':
        return `\n# ${content}\n\n`;
      case 'h2':
        return `\n## ${content}\n\n`;
      case 'h3':
        return `\n### ${content}\n\n`;
      case 'h4':
        return `\n#### ${content}\n\n`;
      case 'h5':
        return `\n##### ${content}\n\n`;
      case 'h6':
        return `\n###### ${content}\n\n`;
      case 'p':
        return `${content}\n\n`;
      case 'br':
        return '\n';
      case 'strong':
      case 'b':
        return `**${content}**`;
      case 'em':
      case 'i':
        return `*${content}*`;
      case 'code':
        // Preserve code formatting
        const codeContent = content.replace(/\n/g, ' ').trim();
        return `\`${codeContent}\``;
      case 'pre':
        return `\n\`\`\`\n${content}\n\`\`\`\n\n`;
      case 'blockquote':
        const quoted = content.split('\n').map(line => line.trim() ? `> ${line}` : '>').join('\n');
        return `\n${quoted}\n\n`;
      case 'ul':
        return `\n${content}\n`;
      case 'ol':
        return `\n${content}\n`;
      case 'li':
        // Determine if parent is ordered list
        const parent = node.parentElement;
        const isOrdered = parent?.tagName?.toLowerCase() === 'ol';
        const prefix = isOrdered ? '1. ' : '- ';
        // Clean up content and add proper indentation for nested items
        const cleanContent = content.replace(/\n{2,}/g, '\n').trim();
        return `${prefix}${cleanContent}\n`;
      case 'a':
        const href = node.getAttribute('href') || '';
        const linkText = content || node.textContent?.trim() || '';
        if (href && linkText && href !== linkText) {
          // Only show link format if URL is different from text
          return `[${linkText}](${href})`;
        }
        return linkText;
      case 'img':
        const src = node.getAttribute('src') || '';
        const alt = node.getAttribute('alt') || 'image';
        if (src) {
          return `\n![${alt}](${src})\n\n`;
        }
        return '';
      case 'hr':
        return '\n---\n\n';
      case 'div':
      case 'section':
      case 'article':
      case 'main':
        return `${content}\n`;
      case 'span':
        // Just return content, don't add formatting
        return content;
      default:
        // For unknown tags, just return the content
        return content;
    }
  }

  let markdown = processNode(tempDiv).trim();
  
  // Clean up excessive newlines (more than 2 consecutive)
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  
  // Clean up spaces around newlines
  markdown = markdown.replace(/ +\n/g, '\n');
  markdown = markdown.replace(/\n +/g, '\n');
  
  // Remove leading/trailing newlines
  markdown = markdown.replace(/^\n+|\n+$/g, '');
  
  return markdown;
}

// Make functions global for onclick handlers
window.addTagSuggestion = addTagSuggestion;
window.addEditTagSuggestion = addEditTagSuggestion;

// ========== HIGHLIGHTS FUNCTIONALITY ==========

let currentHighlightSelection = null;
let currentHighlightBookmarkId = null;

/**
 * Setup text selection for highlighting
 */
function setupTextSelection(bookmarkId, articleElement) {
  currentHighlightBookmarkId = bookmarkId;
  
  // Remove existing listeners
  articleElement.removeEventListener('mouseup', handleTextSelection);
  articleElement.addEventListener('mouseup', handleTextSelection);
  
  // Prevent default text selection behavior when clicking on highlights
  articleElement.addEventListener('click', (e) => {
    if (e.target.classList.contains('highlight')) {
      e.preventDefault();
    }
  });
  
  // Hide toolbar when clicking elsewhere
  document.addEventListener('click', (e) => {
    const toolbar = document.getElementById('highlightToolbar');
    const articleContent = document.getElementById('articleContent');
    if (toolbar && articleContent && 
        !toolbar.contains(e.target) && 
        !articleContent.contains(e.target)) {
      hideHighlightToolbar();
    }
  });
}

/**
 * Handle text selection
 */
function handleTextSelection(e) {
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText.length === 0 || selectedText.length < 3) {
      hideHighlightToolbar();
      return;
    }
    
    // Don't show toolbar if clicking on existing highlight
    const anchorParent = selection.anchorNode?.parentElement;
    const focusParent = selection.focusNode?.parentElement;
    if (anchorParent?.classList.contains('highlight') || focusParent?.classList.contains('highlight')) {
      hideHighlightToolbar();
      return;
    }
    
    if (selection.rangeCount === 0) {
      hideHighlightToolbar();
      return;
    }
    
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const articleElement = document.getElementById('articleContent');
    const articleRect = articleElement.getBoundingClientRect();
    const modalBody = articleElement.closest('.modal-body-tts');
    const modalBodyRect = modalBody ? modalBody.getBoundingClientRect() : articleRect;
    
    // Store selection info
    currentHighlightSelection = {
      text: selectedText,
      range: range.cloneRange(),
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      startContainer: range.startContainer,
      endContainer: range.endContainer
    };
    
    // Show toolbar near selection - position it ABOVE the highlight
    const toolbar = document.getElementById('highlightToolbar');
    toolbar.style.display = 'flex';
    toolbar.style.position = 'absolute';
    
    // Position toolbar ABOVE the selection
    const spaceAbove = rect.top - modalBodyRect.top;
    const spaceBelow = modalBodyRect.bottom - rect.bottom;
    
    // Always try to show above first, fall back to below if not enough space
    if (spaceAbove > 50) {
      toolbar.style.top = `${rect.top - modalBodyRect.top - 45}px`;
    } else if (spaceBelow > 50) {
      toolbar.style.top = `${rect.bottom - modalBodyRect.top + 10}px`;
    } else {
      // Center it if neither has enough space
      toolbar.style.top = `${rect.top - modalBodyRect.top - 25}px`;
    }
    
    // Center horizontally on selection, but keep within bounds
    const toolbarWidth = 280; // Approximate width
    const leftPos = rect.left - modalBodyRect.left + (rect.width / 2) - (toolbarWidth / 2);
    toolbar.style.left = `${Math.max(10, Math.min(leftPos, modalBodyRect.width - toolbarWidth - 10))}px`;
    toolbar.style.zIndex = '1000';
  }, 10);
}

/**
 * Hide highlight toolbar
 */
function hideHighlightToolbar() {
  document.getElementById('highlightToolbar').style.display = 'none';
  currentHighlightSelection = null;
}

/**
 * Cancel highlight
 */
function cancelHighlight() {
  hideHighlightToolbar();
  window.getSelection().removeAllRanges();
  currentHighlightSelection = null;
  currentHighlightBookmarkId = null;
}


/**
 * Save highlight directly (without comment)
 */
async function saveHighlightDirect() {
  if (!currentHighlightSelection || !currentHighlightBookmarkId) {
    console.error('No selection or bookmark ID');
    return;
  }
  
  const selectedText = currentHighlightSelection.text;
  
  if (!selectedText || selectedText.trim().length === 0) {
    console.error('No text selected');
    return;
  }
  
  try {
    // Get context around the selection (50 chars before and after)
    const articleElement = document.getElementById('articleContent');
    const fullText = articleElement.textContent || articleElement.innerText;
    const textIndex = fullText.indexOf(selectedText);
    const contextStart = Math.max(0, textIndex - 50);
    const contextEnd = Math.min(fullText.length, textIndex + selectedText.length + 50);
    const context = fullText.substring(contextStart, contextEnd);
    
    const highlightId = await highlightsManager.saveHighlight(
      currentHighlightBookmarkId,
      selectedText,
      '', // No comment for direct save
      context
    );
    
    console.log('Highlight saved with ID:', highlightId);
    
    // Apply highlight to the selected text in the article
    try {
      applyHighlightToText(currentHighlightSelection, currentHighlightBookmarkId);
    } catch (applyError) {
      console.error('Error applying highlight to text:', applyError);
      // Continue even if applying fails - the highlight is still saved
    }
    
    hideHighlightToolbar();
    window.getSelection().removeAllRanges();
    
    // Clear selection after successful save
    currentHighlightSelection = null;
    currentHighlightBookmarkId = null;
    
    // Show success message
    showHighlightSuccess();
    
  } catch (error) {
    console.error('Error saving highlight:', error);
    alert('Failed to save highlight: ' + (error.message || 'Unknown error'));
  }
}


/**
 * Show success message for highlight save
 */
function showHighlightSuccess() {
  const toolbar = document.getElementById('highlightToolbar');
  const articleElement = document.getElementById('articleContent');
  const articleRect = articleElement.getBoundingClientRect();
  const toolbarRect = toolbar.getBoundingClientRect();
  
  const successMsg = document.createElement('div');
  successMsg.className = 'highlight-success';
  successMsg.textContent = '✓ Highlight saved!';
  successMsg.style.cssText = `
    position: absolute;
    background: #10b981;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    z-index: 1001;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  `;
  successMsg.style.top = `${toolbarRect.bottom - articleRect.top + 10}px`;
  successMsg.style.left = `${toolbarRect.left - articleRect.left}px`;
  
  articleElement.parentElement.appendChild(successMsg);
  
  setTimeout(() => {
    successMsg.style.opacity = '0';
    successMsg.style.transition = 'opacity 0.3s';
    setTimeout(() => {
      successMsg.remove();
    }, 300);
  }, 2000);
}

/**
 * Apply highlight to text in article
 */
function applyHighlightToText(selection, bookmarkId) {
  try {
    if (!selection || !selection.text) {
      console.error('Invalid selection object');
      return;
    }
    
    const selectedText = selection.text;
    const isFullscreen = document.getElementById('fullscreenArticleModal').classList.contains('active');
    const articleElement = isFullscreen 
      ? document.getElementById('fullscreenArticleContent')
      : document.getElementById('articleContent');
    
    if (!articleElement) {
      console.error('Article element not found');
      return;
    }
    
    // Try to use the stored range first
    let range = null;
    if (selection.range) {
      try {
        // Check if range is still valid
        const testRange = selection.range.cloneRange();
        if (!testRange.collapsed) {
          range = selection.range;
        }
      } catch (e) {
        console.warn('Stored range is invalid, will search for text');
      }
    }
    
    // If range is not valid, try to find the text in the DOM
    if (!range) {
      const fullText = articleElement.textContent || articleElement.innerText;
      const textIndex = fullText.indexOf(selectedText);
      
      if (textIndex === -1) {
        console.warn('Selected text not found in article, cannot apply highlight');
        return;
      }
      
      // Find the text node containing this text
      const walker = document.createTreeWalker(
        articleElement,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let currentIndex = 0;
      let node = walker.nextNode();
      
      while (node) {
        const nodeLength = node.textContent.length;
        const nodeStart = currentIndex;
        const nodeEnd = currentIndex + nodeLength;
        
        if (textIndex >= nodeStart && textIndex < nodeEnd) {
          const offset = textIndex - nodeStart;
          const endOffset = Math.min(offset + selectedText.length, nodeLength);
          
          try {
            range = document.createRange();
            range.setStart(node, offset);
            range.setEnd(node, endOffset);
            break;
          } catch (e) {
            console.warn('Could not create range for node');
          }
        }
        
        currentIndex = nodeEnd;
        node = walker.nextNode();
      }
    }
    
    if (!range || range.collapsed) {
      console.error('Could not create valid range for highlight');
      return;
    }
    
    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'highlight';
    highlightSpan.setAttribute('data-bookmark-id', bookmarkId);
    highlightSpan.setAttribute('title', 'Highlighted text');
    
    try {
      // Try to surround contents first
      range.surroundContents(highlightSpan);
    } catch (e) {
      // If surroundContents fails, extract and replace
      try {
        const contents = range.extractContents();
        highlightSpan.appendChild(contents);
        range.insertNode(highlightSpan);
      } catch (e2) {
        console.error('Error applying highlight with extractContents:', e2);
        // Final fallback: find text and replace manually
        const textNode = range.startContainer;
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          const parent = textNode.parentNode;
          const text = textNode.textContent;
          const start = range.startOffset;
          const end = range.endOffset;
          
          const beforeText = text.substring(0, start);
          const highlightText = text.substring(start, end);
          const afterText = text.substring(end);
          
          const beforeNode = document.createTextNode(beforeText);
          highlightSpan.textContent = highlightText;
          const afterNode = document.createTextNode(afterText);
          
          parent.replaceChild(beforeNode, textNode);
          parent.insertBefore(highlightSpan, beforeNode.nextSibling);
          if (afterText) {
            parent.insertBefore(afterNode, highlightSpan.nextSibling);
          }
        }
      }
    }
    
    // Clear selection
    window.getSelection().removeAllRanges();
    
    console.log('Highlight applied successfully');
  } catch (error) {
    console.error('Error applying highlight:', error);
  }
}

/**
 * Load highlights for article and display them
 */
async function loadHighlightsForArticle(bookmarkId, articleElement) {
  try {
    const highlights = await highlightsManager.getHighlightsForBookmark(bookmarkId);
    
    if (highlights.length === 0) {
      return;
    }
    
    // Sort highlights by position in text (process from end to start to avoid offset issues)
    const articleText = articleElement.textContent || articleElement.innerText;
    const highlightsWithPos = highlights.map(h => ({
      ...h,
      position: articleText.indexOf(h.text)
    })).filter(h => h.position !== -1).sort((a, b) => b.position - a.position);
    
    highlightsWithPos.forEach(highlight => {
      const text = highlight.text;
      const position = highlight.position;
      
      // Create a walker to find text nodes
      const walker = document.createTreeWalker(
        articleElement,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let currentIndex = 0;
      let node = walker.nextNode();
      let found = false;
      
      while (node && !found) {
        const nodeLength = node.textContent.length;
        const nodeStart = currentIndex;
        const nodeEnd = currentIndex + nodeLength;
        
        if (position >= nodeStart && position < nodeEnd) {
          // Found the node containing the text
          const offset = position - nodeStart;
          const endOffset = Math.min(offset + text.length, nodeLength);
          
          // Check if this text node actually contains the full text
          const nodeText = node.textContent;
          const nodeSubstring = nodeText.substring(offset, endOffset);
          
          if (nodeSubstring === text || nodeText.includes(text)) {
            const range = document.createRange();
            
            // Try to find the exact match
            let startOffset = offset;
            let endOffsetFinal = endOffset;
            
            // If text spans multiple nodes, we need to handle that
            if (nodeText.substring(offset).startsWith(text.substring(0, Math.min(text.length, nodeLength - offset)))) {
              // Text starts in this node
              startOffset = offset;
              endOffsetFinal = Math.min(offset + text.length, nodeLength);
            } else {
              // Try to find the text in this node
              const localIndex = nodeText.indexOf(text);
              if (localIndex !== -1) {
                startOffset = localIndex;
                endOffsetFinal = localIndex + text.length;
              }
            }
            
            range.setStart(node, startOffset);
            range.setEnd(node, endOffsetFinal);
            
            const highlightSpan = document.createElement('span');
            highlightSpan.className = 'highlight';
            highlightSpan.setAttribute('data-bookmark-id', bookmarkId);
            highlightSpan.setAttribute('data-highlight-id', highlight.id);
            highlightSpan.setAttribute('title', 'Highlighted text');
            
            try {
              range.surroundContents(highlightSpan);
            } catch (e) {
              // If surroundContents fails, extract and replace
              try {
                const contents = range.extractContents();
                highlightSpan.appendChild(contents);
                range.insertNode(highlightSpan);
              } catch (e2) {
                console.warn('Could not apply highlight:', e2);
              }
            }
            
            found = true;
          }
        }
        
        currentIndex = nodeEnd;
        node = walker.nextNode();
      }
    });
  } catch (error) {
    console.error('Error loading highlights:', error);
  }
}

/**
 * Open highlights modal
 */
async function openHighlightsModal() {
  try {
    const allHighlights = await highlightsManager.getAllHighlights();
    const allBookmarks = await storageManager.getBookmarks();
    
    const highlightsList = document.getElementById('highlightsList');
    
    if (allHighlights.length === 0) {
      highlightsList.innerHTML = '<div class="empty-state"><p>No highlights yet. Select text in an article to create highlights!</p></div>';
      document.getElementById('highlightsModal').classList.add('active');
      return;
    }
    
    // Group highlights by bookmark
    const highlightsByBookmark = {};
    allHighlights.forEach(highlight => {
      if (!highlightsByBookmark[highlight.bookmarkId]) {
        highlightsByBookmark[highlight.bookmarkId] = [];
      }
      highlightsByBookmark[highlight.bookmarkId].push(highlight);
    });
    
    // Render highlights
    highlightsList.innerHTML = Object.entries(highlightsByBookmark).map(([bookmarkId, highlights]) => {
      const bookmark = allBookmarks.find(b => b.id === bookmarkId);
      if (!bookmark) return '';
      
      return `
        <div class="highlight-group">
          <div class="highlight-group-header">
            <h3>${escapeHtml(bookmark.title || 'Untitled')}</h3>
            <div class="highlight-group-actions">
              <a href="${escapeHtml(bookmark.url)}" target="_blank" class="highlight-article-link" rel="noopener noreferrer">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                Open Article
              </a>
              <button class="btn btn-small highlight-view-sonara-btn" data-action="view-in-sonara" data-bookmark-id="${bookmarkId}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
                </svg>
                View in Sonara
              </button>
            </div>
          </div>
          <div class="highlight-items">
            ${highlights.map(h => `
              <div class="highlight-item">
                <div class="highlight-text">
                  <mark>${escapeHtml(h.text)}</mark>
                </div>
                <div class="highlight-meta">
                  <span class="highlight-date">${new Date(h.createdAt).toLocaleString()}</span>
                  <button class="btn btn-small btn-delete" data-highlight-id="${h.id}">Delete</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
    
    document.getElementById('highlightsModal').classList.add('active');
  } catch (error) {
    console.error('Error opening highlights modal:', error);
    alert('Failed to load highlights: ' + error.message);
  }
}

/**
 * Close highlights modal
 */
function closeHighlightsModal() {
  document.getElementById('highlightsModal').classList.remove('active');
}

/**
 * Open article from highlight
 */
async function openArticleFromHighlight(bookmarkId) {
  if (!bookmarkId) {
    return;
  }
  
  closeHighlightsModal();
  await handleListen(bookmarkId);
}

/**
 * Delete highlight
 */
async function deleteHighlight(highlightId) {
  if (!highlightId) {
    return;
  }
  
  try {
    // Convert to number if it's a string (IndexedDB uses numeric IDs)
    const id = typeof highlightId === 'string' ? parseInt(highlightId, 10) : highlightId;
    
    if (isNaN(id)) {
      alert('Invalid highlight ID');
      return;
    }
    
    await highlightsManager.deleteHighlight(id);
    // Reload highlights view
    await openHighlightsModal();
  } catch (error) {
    console.error('Error deleting highlight:', error);
    alert('Failed to delete highlight: ' + error.message);
  }
}

// ========== FULLSCREEN ARTICLE FUNCTIONALITY ==========

let fullscreenHighlightSelection = null;
let fullscreenHighlightBookmarkId = null;

/**
 * Open article in fullscreen
 */
async function openFullscreenArticle() {
  if (!window.currentTTSBookmark) {
    return;
  }
  
  const bookmark = window.currentTTSBookmark;
  const articleContentEl = document.getElementById('fullscreenArticleContent');
  const titleEl = document.getElementById('fullscreenArticleTitle');
  const originalLink = document.getElementById('fullscreenOriginalLink');
  
  // Get the article content (same as in TTS modal)
  if (bookmark.html && bookmark.html.trim()) {
    const markdown = htmlToMarkdown(bookmark.html);
    const renderedHtml = renderMarkdown(markdown);
    articleContentEl.innerHTML = renderedHtml || bookmark.extractedContent;
  } else {
    const renderedHtml = renderMarkdown(bookmark.extractedContent);
    articleContentEl.innerHTML = renderedHtml || bookmark.extractedContent;
  }
  
  titleEl.textContent = bookmark.title || 'Article';
  if (originalLink && bookmark.url) {
    originalLink.href = bookmark.url;
  }
  
  // Load and display highlights
  await loadHighlightsForArticle(bookmark.id, articleContentEl);
  
  // Setup text selection for highlighting
  setupTextSelectionFullscreen(bookmark.id, articleContentEl);
  
  document.getElementById('fullscreenArticleModal').classList.add('active');
}

/**
 * Close fullscreen article
 */
function closeFullscreenArticle() {
  document.getElementById('fullscreenArticleModal').classList.remove('active');
  fullscreenHighlightSelection = null;
  fullscreenHighlightBookmarkId = null;
  window.getSelection().removeAllRanges();
}

/**
 * Setup text selection for highlighting in fullscreen
 */
function setupTextSelectionFullscreen(bookmarkId, articleElement) {
  fullscreenHighlightBookmarkId = bookmarkId;
  
  articleElement.removeEventListener('mouseup', handleTextSelectionFullscreen);
  articleElement.addEventListener('mouseup', handleTextSelectionFullscreen);
  
  articleElement.addEventListener('click', (e) => {
    if (e.target.classList.contains('highlight')) {
      e.preventDefault();
    }
  });
  
  document.addEventListener('click', (e) => {
    const toolbar = document.getElementById('fullscreenHighlightToolbar');
    const articleContent = document.getElementById('fullscreenArticleContent');
    if (toolbar && articleContent && 
        !toolbar.contains(e.target) && 
        !articleContent.contains(e.target)) {
      hideHighlightToolbarFullscreen();
    }
  });
}

/**
 * Handle text selection in fullscreen
 */
function handleTextSelectionFullscreen(e) {
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText.length === 0 || selectedText.length < 3) {
      hideHighlightToolbarFullscreen();
      return;
    }
    
    const anchorParent = selection.anchorNode?.parentElement;
    const focusParent = selection.focusNode?.parentElement;
    if (anchorParent?.classList.contains('highlight') || focusParent?.classList.contains('highlight')) {
      hideHighlightToolbarFullscreen();
      return;
    }
    
    if (selection.rangeCount === 0) {
      hideHighlightToolbarFullscreen();
      return;
    }
    
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const articleElement = document.getElementById('fullscreenArticleContent');
    const modalBody = articleElement.closest('.modal-body-fullscreen');
    const modalBodyRect = modalBody ? modalBody.getBoundingClientRect() : articleElement.getBoundingClientRect();
    
    fullscreenHighlightSelection = {
      text: selectedText,
      range: range.cloneRange(),
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      startContainer: range.startContainer,
      endContainer: range.endContainer
    };
    
    const toolbar = document.getElementById('fullscreenHighlightToolbar');
    toolbar.style.display = 'flex';
    toolbar.style.position = 'absolute';
    
    const spaceAbove = rect.top - modalBodyRect.top;
    const spaceBelow = modalBodyRect.bottom - rect.bottom;
    
    if (spaceAbove > 50) {
      toolbar.style.top = `${rect.top - modalBodyRect.top - 45}px`;
    } else if (spaceBelow > 50) {
      toolbar.style.top = `${rect.bottom - modalBodyRect.top + 10}px`;
    } else {
      toolbar.style.top = `${rect.top - modalBodyRect.top - 25}px`;
    }
    
    const toolbarWidth = 280;
    const leftPos = rect.left - modalBodyRect.left + (rect.width / 2) - (toolbarWidth / 2);
    toolbar.style.left = `${Math.max(10, Math.min(leftPos, modalBodyRect.width - toolbarWidth - 10))}px`;
    toolbar.style.zIndex = '1000';
  }, 10);
}

/**
 * Hide highlight toolbar in fullscreen
 */
function hideHighlightToolbarFullscreen() {
  document.getElementById('fullscreenHighlightToolbar').style.display = 'none';
  fullscreenHighlightSelection = null;
}

/**
 * Cancel highlight in fullscreen
 */
function cancelHighlightFullscreen() {
  hideHighlightToolbarFullscreen();
  window.getSelection().removeAllRanges();
}

/**
 * Save highlight directly in fullscreen
 */
async function saveHighlightDirectFullscreen() {
  if (!fullscreenHighlightSelection || !fullscreenHighlightBookmarkId) {
    return;
  }
  
  const selectedText = fullscreenHighlightSelection.text;
  
  try {
    const articleElement = document.getElementById('fullscreenArticleContent');
    const fullText = articleElement.textContent || articleElement.innerText;
    const textIndex = fullText.indexOf(selectedText);
    const contextStart = Math.max(0, textIndex - 50);
    const contextEnd = Math.min(fullText.length, textIndex + selectedText.length + 50);
    const context = fullText.substring(contextStart, contextEnd);
    
    await highlightsManager.saveHighlight(
      fullscreenHighlightBookmarkId,
      selectedText,
      '',
      context
    );
    
    applyHighlightToText(fullscreenHighlightSelection, fullscreenHighlightBookmarkId);
    hideHighlightToolbarFullscreen();
    window.getSelection().removeAllRanges();
    showHighlightSuccessFullscreen();
    
  } catch (error) {
    console.error('Error saving highlight:', error);
    alert('Failed to save highlight: ' + error.message);
  }
}


/**
 * Show success message in fullscreen
 */
function showHighlightSuccessFullscreen() {
  const toolbar = document.getElementById('fullscreenHighlightToolbar');
  const articleElement = document.getElementById('fullscreenArticleContent');
  const articleRect = articleElement.getBoundingClientRect();
  const toolbarRect = toolbar.getBoundingClientRect();
  
  const successMsg = document.createElement('div');
  successMsg.className = 'highlight-success';
  successMsg.textContent = '✓ Highlight saved!';
  successMsg.style.cssText = `
    position: absolute;
    background: #10b981;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    z-index: 1001;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  `;
  successMsg.style.top = `${toolbarRect.bottom - articleRect.top + 10}px`;
  successMsg.style.left = `${toolbarRect.left - articleRect.left}px`;
  
  articleElement.parentElement.appendChild(successMsg);
  
  setTimeout(() => {
    successMsg.style.opacity = '0';
    successMsg.style.transition = 'opacity 0.3s';
    setTimeout(() => {
      successMsg.remove();
    }, 300);
  }, 2000);
}

// ========== CREATE AUDIO FROM TEXT ==========

/**
 * Open create audio modal
 */
function openCreateAudioModal() {
  document.getElementById('audioTitle').value = '';
  document.getElementById('audioText').value = '';
  document.getElementById('createAudioModal').classList.add('active');
  // Focus on title input
  setTimeout(() => {
    document.getElementById('audioTitle').focus();
  }, 100);
}

/**
 * Close create audio modal
 */
function closeCreateAudioModal() {
  document.getElementById('createAudioModal').classList.remove('active');
}

/**
 * Handle generate audio from custom text
 */
async function handleGenerateAudio() {
  const title = document.getElementById('audioTitle').value.trim();
  const text = document.getElementById('audioText').value.trim();
  
  if (!title) {
    alert('Please enter a title for your audio.');
    document.getElementById('audioTitle').focus();
    return;
  }
  
  if (!text) {
    alert('Please enter text to convert to audio.');
    document.getElementById('audioText').focus();
    return;
  }
  
  if (text.length < 10) {
    alert('Text is too short. Please enter at least 10 characters.');
    document.getElementById('audioText').focus();
    return;
  }
  
  // Check if OpenAI API key is configured
  const settings = await storageManager.getSettings();
  if (!settings.openaiApiKey || !settings.openaiApiKey.trim()) {
    alert('OpenAI API key is required to generate audio. Please configure it in Settings.');
    closeCreateAudioModal();
    openSettingsModal();
    return;
  }
  
  try {
    // Create a bookmark-like object for this custom audio
    const customBookmark = {
      url: 'custom://audio/' + Date.now(), // Custom URL scheme
      title: title,
      extractedContent: text,
      html: `<p>${escapeHtml(text)}</p>`, // Simple HTML representation
      tags: ['custom-audio'],
      audioStatus: 'generating',
      savedAt: Date.now(),
      isCustomAudio: true // Flag to identify custom audio entries
    };
    
    // Save the bookmark
    const savedBookmark = await storageManager.saveBookmark(customBookmark);
    const bookmarkId = savedBookmark.id;
    
    // Close modal
    closeCreateAudioModal();
    
    // Refresh bookmarks list
    await loadBookmarks();
    
    // Show success message
    const successMsg = document.createElement('div');
    successMsg.textContent = '✓ Audio generation started!';
    successMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 6px rgba(0,0,0,0.1);';
    document.body.appendChild(successMsg);
    
    setTimeout(() => {
      successMsg.style.opacity = '0';
      successMsg.style.transition = 'opacity 0.3s';
      setTimeout(() => successMsg.remove(), 300);
    }, 3000);
    
    // Trigger audio generation in background
    try {
      await chrome.runtime.sendMessage({ type: 'GENERATE_AUDIO', bookmarkId });
      console.log('Audio generation initiated for custom text:', bookmarkId);
    } catch (err) {
      console.error('Failed to send audio generation message:', err);
      alert('Failed to start audio generation. Please try again.');
    }
    
  } catch (error) {
    console.error('Error creating custom audio:', error);
    alert('Failed to create audio: ' + error.message);
  }
}

// Make functions global for onclick handlers
window.openArticleFromHighlight = openArticleFromHighlight;
window.deleteHighlight = deleteHighlight;

// ========== ARTICLE SEARCH FUNCTIONALITY ==========

let articleSearchResults = [];
let articleSearchCurrentIndex = -1;
let articleSearchOriginalContent = null;

/**
 * Handle article search input
 */
function handleArticleSearch() {
  const searchInput = document.getElementById('articleSearchInput');
  const searchTerm = searchInput.value.trim();
  const articleContentEl = document.getElementById('articleContent');
  
  if (!searchTerm) {
    clearArticleSearch();
    return;
  }
  
  // Don't search in edit mode
  if (isEditMode) {
    return;
  }
  
  // Store original content if not already stored
  if (!articleSearchOriginalContent) {
    articleSearchOriginalContent = articleContentEl.innerHTML;
  }
  
  // Find all matches (case-insensitive) in the original text content
  // We need to get text content from the original HTML, not the current (which might have highlights)
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = articleSearchOriginalContent;
  const textContent = tempDiv.textContent || tempDiv.innerText;
  
  const regex = new RegExp(escapeRegex(searchTerm), 'gi');
  const matches = [];
  let match;
  
  while ((match = regex.exec(textContent)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length
    });
  }
  
  if (matches.length === 0) {
    // No matches found
    articleSearchResults = [];
    articleSearchCurrentIndex = -1;
    updateSearchUI(0, -1);
    // Restore original content
    articleContentEl.innerHTML = articleSearchOriginalContent;
    return;
  }
  
  articleSearchResults = matches;
  articleSearchCurrentIndex = 0;
  
  // Highlight all matches
  highlightSearchResults(articleContentEl, searchTerm, matches);
  
  // Scroll to first match
  scrollToSearchResult(0);
  
  updateSearchUI(matches.length, 0);
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlight search results in article content
 */
function highlightSearchResults(element, searchTerm, matches) {
  // Restore original content first
  element.innerHTML = articleSearchOriginalContent;
  
  // Use a simpler approach: find and wrap text nodes
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  const textNodes = [];
  let node = walker.nextNode();
  let currentTextIndex = 0;
  
  // Collect all text nodes with their positions
  while (node) {
    const text = node.textContent;
    if (text.trim()) {
      textNodes.push({
        node: node,
        startIndex: currentTextIndex,
        endIndex: currentTextIndex + text.length,
        text: text
      });
      currentTextIndex += text.length;
    }
    node = walker.nextNode();
  }
  
  // Process matches from end to start to avoid offset issues
  const regex = new RegExp(escapeRegex(searchTerm), 'gi');
  let matchIndex = 0;
  
  matches.reverse().forEach((match) => {
    const matchStart = match.index;
    const matchEnd = matchStart + match.length;
    
    // Find the text node containing this match
    for (const textNodeInfo of textNodes) {
      if (matchStart >= textNodeInfo.startIndex && matchStart < textNodeInfo.endIndex) {
        const node = textNodeInfo.node;
        const nodeText = node.textContent;
        const offsetInNode = matchStart - textNodeInfo.startIndex;
        const endOffsetInNode = Math.min(offsetInNode + match.length, nodeText.length);
        
        // Only process if this node hasn't been modified
        if (node.parentNode && !node.parentNode.classList.contains('search-highlight')) {
          // Split the text node
          const beforeText = nodeText.substring(0, offsetInNode);
          const matchText = nodeText.substring(offsetInNode, endOffsetInNode);
          const afterText = nodeText.substring(endOffsetInNode);
          
          // Create new nodes
          if (beforeText) {
            const beforeNode = document.createTextNode(beforeText);
            node.parentNode.insertBefore(beforeNode, node);
          }
          
          const highlightSpan = document.createElement('mark');
          const index = matches.length - 1 - matchIndex;
          const isActive = index === articleSearchCurrentIndex;
          highlightSpan.className = isActive ? 'search-highlight search-highlight-active' : 'search-highlight';
          highlightSpan.setAttribute('data-search-index', index);
          highlightSpan.textContent = matchText;
          node.parentNode.insertBefore(highlightSpan, node);
          
          if (afterText) {
            const afterNode = document.createTextNode(afterText);
            node.parentNode.insertBefore(afterNode, node);
          }
          
          node.remove();
          matchIndex++;
          break;
        }
      }
    }
  });
}

/**
 * Navigate to next/previous search result
 */
function handleArticleSearchNavigate(direction) {
  if (articleSearchResults.length === 0) {
    return;
  }
  
  if (direction === 'next') {
    articleSearchCurrentIndex = (articleSearchCurrentIndex + 1) % articleSearchResults.length;
  } else {
    articleSearchCurrentIndex = articleSearchCurrentIndex <= 0 
      ? articleSearchResults.length - 1 
      : articleSearchCurrentIndex - 1;
  }
  
  // Update highlight classes before scrolling
  const highlights = document.querySelectorAll('.search-highlight');
  highlights.forEach((highlight, index) => {
    if (index === articleSearchCurrentIndex) {
      highlight.classList.add('search-highlight-active');
    } else {
      highlight.classList.remove('search-highlight-active');
    }
  });
  
  scrollToSearchResult(articleSearchCurrentIndex);
  updateSearchUI(articleSearchResults.length, articleSearchCurrentIndex);
}

/**
 * Scroll to search result
 */
function scrollToSearchResult(index) {
  const articleContentEl = document.getElementById('articleContent');
  const highlights = articleContentEl.querySelectorAll('.search-highlight');
  if (highlights[index]) {
    highlights[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Update search UI (count, buttons visibility)
 */
function updateSearchUI(total, current) {
  const prevBtn = document.getElementById('articleSearchPrevBtn');
  const nextBtn = document.getElementById('articleSearchNextBtn');
  const countSpan = document.getElementById('articleSearchCount');
  const closeBtn = document.getElementById('articleSearchCloseBtn');
  const searchInput = document.getElementById('articleSearchInput');
  
  if (total > 0) {
    prevBtn.style.display = 'inline-flex';
    nextBtn.style.display = 'inline-flex';
    countSpan.style.display = 'inline-block';
    closeBtn.style.display = 'inline-flex';
    countSpan.textContent = `${current + 1}/${total}`;
    countSpan.style.color = '#6b7280';
  } else {
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    if (searchInput && searchInput.value.trim()) {
      closeBtn.style.display = 'inline-flex';
      countSpan.style.display = 'inline-block';
      countSpan.textContent = '0';
      countSpan.style.color = '#ef4444';
    } else {
      closeBtn.style.display = 'none';
      countSpan.style.display = 'none';
    }
  }
}

/**
 * Clear article search
 */
function clearArticleSearch() {
  const searchInput = document.getElementById('articleSearchInput');
  const articleContentEl = document.getElementById('articleContent');
  
  if (searchInput) {
    searchInput.value = '';
  }
  
  // Restore original content
  if (articleSearchOriginalContent && articleContentEl) {
    articleContentEl.innerHTML = articleSearchOriginalContent;
    articleSearchOriginalContent = null;
  }
  
  articleSearchResults = [];
  articleSearchCurrentIndex = -1;
  
  updateSearchUI(0, -1);
  
  // Reload highlights if needed
  if (window.currentTTSBookmark && articleContentEl) {
    loadHighlightsForArticle(window.currentTTSBookmark.id, articleContentEl);
    setupTextSelection(window.currentTTSBookmark.id, articleContentEl);
  }
}

// ========== ARTICLE EDITING FUNCTIONALITY ==========

/**
 * Handle edit article button click
 */
function handleEditArticle() {
  const articleContentEl = document.getElementById('articleContent');
  const editToolbar = document.getElementById('editArticleToolbar');
  const highlightToolbar = document.getElementById('highlightToolbar');
  
  if (!isEditMode) {
    // Clear search when entering edit mode
    clearArticleSearch();
    
    // Enter edit mode
    isEditMode = true;
    articleContentEl.contentEditable = 'true';
    articleContentEl.style.border = '2px solid #3b82f6';
    articleContentEl.style.padding = '15px';
    articleContentEl.style.borderRadius = '8px';
    articleContentEl.style.minHeight = '200px';
    articleContentEl.style.outline = 'none';
    editToolbar.style.display = 'flex';
    highlightToolbar.style.display = 'none';
    
    // Update edit button appearance
    const editBtn = document.getElementById('editArticleBtn');
    editBtn.classList.add('active');
    editBtn.title = 'Editing mode';
  }
}

/**
 * Handle cancel edit
 */
function handleCancelEdit() {
  const articleContentEl = document.getElementById('articleContent');
  const editToolbar = document.getElementById('editArticleToolbar');
  
  // Restore original content
  if (originalMarkdown) {
    const renderedHtml = renderMarkdown(originalMarkdown);
    articleContentEl.innerHTML = renderedHtml;
  }
  
  // Exit edit mode
  isEditMode = false;
  articleContentEl.contentEditable = 'false';
  articleContentEl.style.border = '';
  articleContentEl.style.padding = '';
  articleContentEl.style.borderRadius = '';
  articleContentEl.style.minHeight = '';
  editToolbar.style.display = 'none';
  
  // Update edit button
  const editBtn = document.getElementById('editArticleBtn');
  editBtn.classList.remove('active');
  editBtn.title = 'Edit article content';
  
  // Reload highlights
  if (window.currentTTSBookmark) {
    loadHighlightsForArticle(window.currentTTSBookmark.id, articleContentEl);
    setupTextSelection(window.currentTTSBookmark.id, articleContentEl);
  }
}

/**
 * Handle save and regenerate audio
 */
async function handleSaveAndRegenerate() {
  if (!window.currentTTSBookmark) {
    alert('No bookmark found');
    return;
  }
  
  const articleContentEl = document.getElementById('articleContent');
  const editedHtml = articleContentEl.innerHTML;
  
  // Convert edited HTML back to markdown
  const editedMarkdown = htmlToMarkdown(editedHtml);
  
  if (!editedMarkdown || editedMarkdown.trim() === '') {
    alert('Content cannot be empty');
    return;
  }
  
  try {
    // Get updated bookmark
    const allBookmarks = await storageManager.getBookmarks();
    const bookmark = allBookmarks.find(b => 
      b.id === window.currentTTSBookmark.id || String(b.id) === String(window.currentTTSBookmark.id)
    );
    
    if (!bookmark) {
      alert('Bookmark not found');
      return;
    }
    
    // Update bookmark with new markdown
    bookmark.extractedContent = editedMarkdown;
    // Also update HTML for consistency
    bookmark.html = editedHtml;
    
    // Delete existing audio since content changed
    try {
      await audioStorageManager.deleteAudio(bookmark.id);
    } catch (err) {
      // Continue even if deletion fails
    }
    
    // Clear audio status and data
    delete bookmark.audioStatus;
    delete bookmark.audioError;
    delete bookmark.audioStored;
    delete bookmark.audioData;
    delete bookmark.audioMimeType;
    delete bookmark.audioDuration;
    delete bookmark.audioUrl;
    
    // Save updated bookmark
    await storageManager.saveBookmark(bookmark);
    
    // Update current bookmark reference
    window.currentTTSBookmark = bookmark;
    originalMarkdown = editedMarkdown;
    
    // Exit edit mode
    isEditMode = false;
    articleContentEl.contentEditable = 'false';
    articleContentEl.style.border = '';
    articleContentEl.style.padding = '';
    articleContentEl.style.borderRadius = '';
    articleContentEl.style.minHeight = '';
    document.getElementById('editArticleToolbar').style.display = 'none';
    
    // Update edit button
    const editBtn = document.getElementById('editArticleBtn');
    editBtn.classList.remove('active');
    editBtn.title = 'Edit article content';
    
    // Reload bookmarks
    await loadBookmarks();
    
    // Start audio generation
    const settings = await storageManager.getSettings();
    if (!settings.openaiApiKey || !settings.openaiApiKey.trim()) {
      alert('OpenAI API key is required. Please configure it in Settings.');
      return;
    }
    
    // Set status to generating
    bookmark.audioStatus = 'generating';
    await storageManager.saveBookmark(bookmark);
    
    // Update UI to show generating state
    const playerEl = document.getElementById('audioPlayerContainer');
    const generatingEl = document.getElementById('audioGeneratingMsg');
    const errorEl = document.getElementById('audioErrorMsg');
    const ttsEl = document.getElementById('ttsControls');
    
    playerEl.style.display = 'none';
    generatingEl.style.display = 'flex';
    errorEl.style.display = 'none';
    ttsEl.style.display = 'none';
    
    // Clear audio player
    const audioPlayer = document.getElementById('audioPlayer');
    if (audioPlayer && audioPlayer.src) {
      URL.revokeObjectURL(audioPlayer.src);
      audioPlayer.src = '';
    }
    
    // Trigger audio generation
    try {
      chrome.runtime.sendMessage({ type: 'GENERATE_AUDIO', bookmarkId: bookmark.id }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message:', chrome.runtime.lastError);
          bookmark.audioStatus = 'error';
          bookmark.audioError = 'Failed to start generation: ' + chrome.runtime.lastError.message;
          storageManager.saveBookmark(bookmark);
          loadBookmarks();
        }
      });
    } catch (err) {
      console.error('Failed to send audio generation message:', err);
      bookmark.audioStatus = 'error';
      bookmark.audioError = 'Failed to start generation: ' + err.message;
      await storageManager.saveBookmark(bookmark);
      await loadBookmarks();
    }
    
    // Reload highlights with new content
    await loadHighlightsForArticle(bookmark.id, articleContentEl);
    setupTextSelection(bookmark.id, articleContentEl);
    
  } catch (error) {
    console.error('Error saving and regenerating:', error);
    alert('Error saving content: ' + error.message);
  }
}

// ========== JOB LOGS FUNCTIONALITY ==========

let allJobLogs = [];
let filteredJobLogs = [];

/**
 * Open job logs modal
 */
async function openJobLogsModal() {
  try {
    allJobLogs = await storageManager.getJobLogs();
    filteredJobLogs = allJobLogs;
    
    // Get unique bookmark titles for filter
    const bookmarkTitles = [...new Set(allJobLogs.map(log => log.bookmarkTitle))].sort();
    const filterSelect = document.getElementById('jobLogsFilter');
    filterSelect.innerHTML = '<option value="">All Articles</option>' +
      bookmarkTitles.map(title => 
        `<option value="${escapeHtml(title)}">${escapeHtml(title)}</option>`
      ).join('');
    
    renderJobLogs();
    document.getElementById('jobLogsModal').classList.add('active');
  } catch (error) {
    console.error('Error opening job logs modal:', error);
    alert('Failed to load job logs: ' + error.message);
  }
}

/**
 * Close job logs modal
 */
function closeJobLogsModal() {
  document.getElementById('jobLogsModal').classList.remove('active');
}

/**
 * Handle job logs filter
 */
function handleJobLogsFilter() {
  const filterValue = document.getElementById('jobLogsFilter').value;
  if (filterValue) {
    filteredJobLogs = allJobLogs.filter(log => log.bookmarkTitle === filterValue);
  } else {
    filteredJobLogs = allJobLogs;
  }
  renderJobLogs();
}

/**
 * Render job logs
 */
function renderJobLogs() {
  const logsList = document.getElementById('jobLogsList');
  
  if (filteredJobLogs.length === 0) {
    logsList.innerHTML = '<div class="empty-state"><p>No job logs found.</p></div>';
    return;
  }
  
  // Group logs by bookmark
  const logsByBookmark = {};
  filteredJobLogs.forEach(log => {
    const key = log.bookmarkId;
    if (!logsByBookmark[key]) {
      logsByBookmark[key] = [];
    }
    logsByBookmark[key].push(log);
  });
  
  logsList.innerHTML = Object.entries(logsByBookmark).map(([bookmarkId, logs]) => {
    const firstLog = logs[0];
    const latestLog = logs[logs.length - 1];
    
    return `
      <div class="job-log-group" style="margin-bottom: 20px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <div class="job-log-header" style="margin-bottom: 10px;">
          <h3 style="margin: 0 0 5px 0; font-size: 16px; font-weight: 600;">${escapeHtml(firstLog.bookmarkTitle)}</h3>
          <span style="font-size: 12px; color: #6b7280;">${logs.length} log${logs.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="job-log-items">
          ${logs.map(log => {
            const statusColors = {
              'started': '#3b82f6',
              'progress': '#f59e0b',
              'success': '#10b981',
              'error': '#ef4444',
              'cancelled': '#6b7280'
            };
            const statusColor = statusColors[log.status] || '#6b7280';
            const time = new Date(log.timestamp).toLocaleString();
            
            return `
              <div class="job-log-item" style="padding: 10px; margin: 5px 0; background: #f9fafb; border-radius: 6px; border-left: 3px solid ${statusColor};">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 5px;">
                  <span style="font-weight: 500; color: ${statusColor}; text-transform: capitalize;">${log.status}</span>
                  <span style="font-size: 11px; color: #6b7280;">${time}</span>
                </div>
                <div style="font-size: 13px; color: #374151;">${escapeHtml(log.message)}</div>
                ${log.details && Object.keys(log.details).length > 0 ? `
                  <div style="margin-top: 8px; font-size: 11px; color: #6b7280; line-height: 1.6;">
                    ${(() => {
                      const details = log.details;
                      const chunksInfo = [];
                      const otherInfo = [];
                      
                      // Prioritize chunk information
                      if (details.totalChunks !== undefined) {
                        chunksInfo.push(`<strong>Total Chunks:</strong> ${details.totalChunks}`);
                      }
                      if (details.completedChunks !== undefined) {
                        chunksInfo.push(`<strong>Completed:</strong> ${details.completedChunks}`);
                      }
                      if (details.currentChunk !== undefined) {
                        chunksInfo.push(`<strong>Current:</strong> ${details.currentChunk}`);
                      }
                      if (details.progressPercent !== undefined) {
                        chunksInfo.push(`<strong>Progress:</strong> ${details.progressPercent}%`);
                      }
                      if (details.chunksProcessed !== undefined && details.chunksTotal !== undefined) {
                        chunksInfo.push(`<strong>Chunks:</strong> ${details.chunksProcessed}/${details.chunksTotal}`);
                      }
                      
                      // Other details
                      Object.entries(details).forEach(([key, value]) => {
                        if (key === 'stack' || 
                            ['totalChunks', 'completedChunks', 'currentChunk', 'progressPercent', 
                             'chunksProcessed', 'chunksTotal'].includes(key)) {
                          return;
                        }
                        const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        otherInfo.push(`<strong>${displayKey}:</strong> ${escapeHtml(String(value))}`);
                      });
                      
                      let html = '';
                      if (chunksInfo.length > 0) {
                        html += `<div style="background: #eff6ff; padding: 8px; border-radius: 4px; margin-bottom: 5px;">
                          <div style="font-weight: 600; margin-bottom: 4px; color: #1e40af;">Chunk Progress:</div>
                          ${chunksInfo.join(' • ')}
                        </div>`;
                      }
                      if (otherInfo.length > 0) {
                        html += `<div>${otherInfo.join(' • ')}</div>`;
                      }
                      return html;
                    })()}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}