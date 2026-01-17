/**
 * Sonara - Popup UI Logic
 * Main interface for bookmark management, article listening, and settings
 */

let currentBookmarks = [];
let allTags = [];
let currentBookmark = null;

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
  });
});

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
  
  // Modal close buttons
  document.getElementById('closeModal').addEventListener('click', closeBookmarkModal);
  document.getElementById('closeTTSModal').addEventListener('click', closeTTSModal);
  document.getElementById('closeEditTagsModal').addEventListener('click', closeEditTagsModal);
  document.getElementById('fullscreenArticleBtn').addEventListener('click', openFullscreenArticle);
  document.getElementById('closeFullscreenModal').addEventListener('click', closeFullscreenArticle);
  document.getElementById('fullscreenSaveHighlightBtn').addEventListener('click', saveHighlightDirectFullscreen);
  document.getElementById('fullscreenCancelHighlightBtn').addEventListener('click', cancelHighlightFullscreen);
  
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
  document.getElementById('sendToArchiveBtn').addEventListener('click', handleSendToArchive);
  document.getElementById('retryAudioBtn').addEventListener('click', handleRetryAudio);
  
  // Highlights
  document.getElementById('highlightsBtn').addEventListener('click', openHighlightsModal);
  document.getElementById('closeHighlightsModal').addEventListener('click', closeHighlightsModal);
  document.getElementById('saveHighlightDirectBtn').addEventListener('click', saveHighlightDirect);
  document.getElementById('cancelHighlightBtn').addEventListener('click', cancelHighlight);
  
  // Close modals on outside click
  document.getElementById('highlightsModal').addEventListener('click', (e) => {
    if (e.target.id === 'highlightsModal') closeHighlightsModal();
  });
  
  // Audio player
  const audioPlayer = document.getElementById('audioPlayer');
  audioPlayer.addEventListener('timeupdate', () => {
    updateAudioTime();
    updateBottomAudioPlayer();
  });
  audioPlayer.addEventListener('loadedmetadata', () => {
    updateAudioTime();
    updateBottomAudioPlayer();
  });
  audioPlayer.addEventListener('play', () => {
    showBottomAudioPlayer();
    updateBottomAudioPlayer();
  });
  audioPlayer.addEventListener('pause', () => {
    updateBottomAudioPlayer();
  });
  audioPlayer.addEventListener('ended', () => {
    hideBottomAudioPlayer();
  });
  
  // Bottom audio player controls
  document.getElementById('bottomPlayPauseBtn').addEventListener('click', toggleBottomAudioPlayPause);
  document.getElementById('bottomStopBtn').addEventListener('click', stopBottomAudio);
  
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
    if (target.tagName !== 'BUTTON') {
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
    let bookmark = allBookmarks.find(b => b.id === bookmarkId);
    
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
    if (bookmark.isCustomAudio) {
      // For custom audio, render the text as markdown
      const renderedHtml = renderMarkdown(bookmark.extractedContent);
      articleContentEl.innerHTML = renderedHtml || bookmark.extractedContent;
    } else if (bookmark.html && bookmark.html.trim()) {
      const markdown = htmlToMarkdown(bookmark.html);
      const renderedHtml = renderMarkdown(markdown);
      articleContentEl.innerHTML = renderedHtml || bookmark.extractedContent;
    } else {
      // If no HTML, try to render the plain text as markdown
      const renderedHtml = renderMarkdown(bookmark.extractedContent);
      articleContentEl.innerHTML = renderedHtml || bookmark.extractedContent;
    }
    
    // Load and display highlights for this article
    await loadHighlightsForArticle(bookmarkId, articleContentEl);
    
    // Setup text selection for highlighting
    setupTextSelection(bookmarkId, articleContentEl);
    
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
      const audioBlob = new Blob([Uint8Array.from(atob(audioData), c => c.charCodeAt(0))], { type: mimeType });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audioPlayer = document.getElementById('audioPlayer');
      audioPlayer.src = audioUrl;
      
      // Update bottom player with new audio info
      updateBottomAudioPlayerInfo(bookmark);
      
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
      
      // Show bottom audio player when audio starts playing
      audioPlayer.addEventListener('play', () => {
        showBottomAudioPlayer();
        updateBottomAudioPlayer();
      }, { once: true });
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
      archiveBtn.textContent = '✓ Archived';
      archiveBtn.disabled = true;
      archiveBtn.classList.add('archived');
    } else {
      archiveBtn.textContent = '📦 Send to Archive';
      archiveBtn.disabled = false;
      archiveBtn.classList.remove('archived');
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

// Handle delete
async function handleDelete(bookmarkId) {
  const confirmed = window.confirm('Are you sure you want to delete this bookmark?');
  if (!confirmed) return;
  
  try {
    // Delete audio from IndexedDB if it exists
    try {
      await audioStorageManager.deleteAudio(bookmarkId);
    } catch (audioError) {
      console.warn('Error deleting audio from IndexedDB (may not exist):', audioError);
      // Continue with bookmark deletion even if audio deletion fails
    }
    
    await storageManager.deleteBookmark(bookmarkId);
    await loadBookmarks();
    // Also reload tags in case this was the last bookmark with a tag
    await loadTags();
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    alert('Error deleting bookmark: ' + error.message);
  }
}

// Send to archive (from Listen modal)
async function handleSendToArchive() {
  if (!window.currentTTSBookmark) return;
  const id = window.currentTTSBookmark.id;
  try {
    await storageManager.archiveBookmark(id);
    window.currentTTSBookmark.archived = true;
    const btn = document.getElementById('sendToArchiveBtn');
    btn.textContent = '✓ Archived';
    btn.disabled = true;
    btn.classList.add('archived');
    await loadBookmarks();
  } catch (e) {
    console.error('Archive failed:', e);
    alert('Failed to archive: ' + e.message);
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
    playerEl.style.display = 'block';
    generatingEl.style.display = 'none';
    errorEl.style.display = 'none';
    ttsEl.style.display = 'none';
    
    // Update bottom player with new audio info
    if (b) {
      updateBottomAudioPlayerInfo(b);
    }
    
    // Show bottom audio player when audio starts playing
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
  document.getElementById('ttsModal').classList.remove('active');
  // Don't clear currentTTSBookmark if audio is still playing - keep bottom player visible
  const audioPlayer = document.getElementById('audioPlayer');
  if (audioPlayer && audioPlayer.src && !audioPlayer.paused) {
    // Audio is playing, keep the bookmark reference for bottom player
  } else {
    window.currentTTSBookmark = null;
    hideBottomAudioPlayer();
  }
  updateTTSControls();
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

// Update audio time display
function updateAudioTime() {
  const audioPlayer = document.getElementById('audioPlayer');
  const timeDiv = document.getElementById('audioTime');
  
  if (audioPlayer.duration && !isNaN(audioPlayer.duration)) {
    const current = formatTime(audioPlayer.currentTime);
    const total = formatTime(audioPlayer.duration);
    timeDiv.textContent = `${current} / ${total}`;
  }
}

// Update bottom audio player
function updateBottomAudioPlayer() {
  const audioPlayer = document.getElementById('audioPlayer');
  const bottomPlayer = document.getElementById('bottomAudioPlayer');
  const bottomTime = document.getElementById('bottomAudioTime');
  const bottomPlayPauseBtn = document.getElementById('bottomPlayPauseBtn');
  
  if (!audioPlayer.src || audioPlayer.src === '') {
    return;
  }
  
  if (audioPlayer.duration && !isNaN(audioPlayer.duration)) {
    const current = formatTime(audioPlayer.currentTime);
    const total = formatTime(audioPlayer.duration);
    bottomTime.textContent = `${current} / ${total}`;
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

// Show bottom audio player
function showBottomAudioPlayer() {
  const audioPlayer = document.getElementById('audioPlayer');
  const bottomPlayer = document.getElementById('bottomAudioPlayer');
  
  if (!audioPlayer || !bottomPlayer) {
    return;
  }
  
  if (audioPlayer.src && audioPlayer.src !== '') {
    // Update info if we have current bookmark
    if (window.currentTTSBookmark) {
      updateBottomAudioPlayerInfo(window.currentTTSBookmark);
    }
    bottomPlayer.style.display = 'flex';
    updateBottomAudioPlayer();
  }
}

// Hide bottom audio player
function hideBottomAudioPlayer() {
  const bottomPlayer = document.getElementById('bottomAudioPlayer');
  bottomPlayer.style.display = 'none';
}

// Toggle play/pause from bottom player
function toggleBottomAudioPlayPause() {
  const audioPlayer = document.getElementById('audioPlayer');
  
  if (!audioPlayer.src || audioPlayer.src === '') {
    // If no audio in main player, try to open the last bookmark
    if (window.currentTTSBookmark) {
      handleListen(window.currentTTSBookmark.id);
    }
    return;
  }
  
  if (audioPlayer.paused) {
    audioPlayer.play().catch(err => {
      console.error('Error playing audio:', err);
    });
  } else {
    audioPlayer.pause();
  }
  
  updateBottomAudioPlayer();
}

// Stop audio from bottom player
function stopBottomAudio() {
  const audioPlayer = document.getElementById('audioPlayer');
  audioPlayer.pause();
  audioPlayer.currentTime = 0;
  hideBottomAudioPlayer();
  updateBottomAudioPlayer();
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
              <button class="btn btn-small highlight-view-sonara-btn" onclick="openArticleFromHighlight('${bookmarkId}')">
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
                  <button class="btn btn-small btn-delete" onclick="deleteHighlight(${h.id})">Delete</button>
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
  closeHighlightsModal();
  await handleListen(bookmarkId);
}

/**
 * Delete highlight
 */
async function deleteHighlight(highlightId) {
  if (!confirm('Are you sure you want to delete this highlight?')) {
    return;
  }
  
  try {
    await highlightsManager.deleteHighlight(highlightId);
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