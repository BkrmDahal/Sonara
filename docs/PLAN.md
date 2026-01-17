# Sonara - Pocket-like Chrome Extension with TTS

## Project Overview
Sonara is a Chrome extension that allows users to bookmark web pages, tag them, extract clean article content, and convert articles to speech using text-to-speech APIs or Mac's built-in TTS engine.

## Core Features

### 1. Bookmark Management
- **Save Pages**: One-click bookmarking of current page
- **Paste URL**: Paste any URL directly to save 
- **View Bookmarks**: List all saved bookmarks with metadata
- **Delete Bookmarks**: Remove unwanted bookmarks
- **Search Bookmarks**: Search by title, URL, or tags
- **URL Validation**: Automatic URL validation and https:// prefix addition 

### 2. Tagging System
- **Add Tags**: Assign multiple tags to each bookmark
- **Tag Management**: Create, edit, and delete tags
- **Tag Filtering**: Filter bookmarks by tags
- **Tag Suggestions**: Auto-suggest existing tags
- **edit tag**: allow user to edit tags

### 3. Article Extraction
- **Content Extraction**: Use Readability-like algorithm to extract main article content
- **Clean Formatting**: Remove ads, navigation, sidebars, and other clutter
- **Preserve Structure**: Maintain headings, paragraphs, and formatting
- **Fallback**: If extraction fails, use full page content
- **Retry Logic**: Automatic retry (up to 3 attempts) for content extraction 
- **DOM Ready Wait**: Waits for DOM to be fully ready before extraction 
- **Dynamic Content Support**: Extended wait times for JavaScript-rendered content 
- **Background Tab Extraction**: Extracts content from URLs opened in background tabs 

### 4. Text-to-Speech (TTS)
- **Browser Default TTS**: Uses browser's built-in/default TTS engine (UPDATED)
- **Web Speech API**: Primary TTS method using browser's Web Speech API
- **Playback Controls**: Play, pause, stop, and speed adjustment
- **Progress Tracking**: Show reading progress
- **Event Handlers**: Proper pause/resume/end event handling 
- **Status Management**: Real-time TTS status tracking 

### 5. Audio Generation & Playback 
- **MP3/Audio Generation**: Generate audio files from article text
- **HTML5 Audio Player**: Full-featured audio player with seek controls
- **Audio Storage**: Save audio files with bookmarks
- **Download Audio**: Download generated audio files as MP3
- **Seek Controls**: Seek/scrub through audio playback
- **Time Display**: Show current time and total duration
- **Volume Control**: Built-in volume controls
- **Auto-load Audio**: Automatically loads saved audio when available

## Technical Architecture

### Extension Structure
```
sonara/
├── manifest.json          # Extension configuration
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic
├── popup.css              # Popup styles
├── background.js          # Background service worker
├── content.js             # Content script for article extraction
├── storage.js             # Storage management utilities
├── extractor.js           # Article extraction logic
├── tts.js                 # Text-to-speech functionality
├── audio-generator.js     # Audio generation and recording 
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── PLAN.md                # Project plan (this file)
├── README.md              # User documentation
├── TESTING.md             # Testing guide 
├── QUICKSTART.md          # Quick start guide 
├── test-extension.sh      # Testing helper script 
└── create-icons.html      # Icon generator tool 
```

### Components

#### 1. Manifest (manifest.json)
- **Permissions**: 
  - `storage` - Save bookmarks locally
  - `tabs` - Access current tab info
  - `activeTab` - Inject content scripts
  - `scripting` - Execute content scripts
  - `downloads` - Download audio files 
- **Action**: Browser action with popup
- **Background**: Service worker for background tasks
- **Manifest Version**: V3 (latest)

#### 2. Popup (popup.html/js/css)
- **Bookmark List**: Display saved bookmarks
- **Add Bookmark**: Quick save button
- **Paste URL Section**: Input field to paste and save URLs 
- **Search Bar**: Search through bookmarks
- **Tag Filter**: Filter by tags
- **TTS Controls**: Play article audio (live TTS)
- **Audio Player**: HTML5 audio player with seek controls 
- **Generate Audio Button**: Generate and save audio files 
- **Download Audio**: Download saved audio files 
- **Larger UI**: 600px width, 700-900px height for better viewing 
- **Improved Layout**: Better spacing, larger text, more readable 

#### 3. Content Script (content.js)
- **Page Analysis**: Analyze DOM structure
- **Content Extraction**: Extract main article content
- **Metadata Extraction**: Get title, author, publish date
- **Article Extractor Class**: Embedded extractor for injected scripts 
- **Error Handling**: Graceful error handling for extraction failures 

#### 4. Article Extractor (extractor.js)
- **Readability Algorithm**: Identify main content area
- **Clean HTML**: Remove scripts, styles, ads
- **Text Conversion**: Convert HTML to plain text for TTS

#### 5. TTS Engine (tts.js)
- **Browser Default TTS**: Uses browser's default/system voice (UPDATED)
- **Web Speech API**: Primary TTS method
- **Playback Management**: Control audio playback
- **Event Handlers**: onstart, onend, onpause, onresume, onerror 
- **Status Tracking**: Real-time playback status 
- **Voice Management**: Automatic voice selection (browser default) 

#### 6. Audio Generator (audio-generator.js) 
- **MediaRecorder API**: Records audio output
- **Audio Format Support**: WebM, OGG, MP4, WAV formats
- **Blob Management**: Creates downloadable audio blobs
- **Download Integration**: Chrome downloads API integration
- **MIME Type Detection**: Automatic format detection

#### 7. Storage (storage.js)
- **Chrome Storage API**: Store bookmarks, tags, settings
- **Data Structure**:
  ```javascript
  {
    bookmarks: [
      {
        id: "uuid",
        url: "https://...",
        title: "Article Title",
        tags: ["tag1", "tag2"],
        extractedContent: "...",
        html: "...",                    // HTML content 
        author: "...",                   // Author metadata 
        publishedDate: "...",           // Publication date 
        audioUrl: "blob:...",           // Audio file URL 
        audioBlob: Blob,                // Audio blob reference 
        savedAt: timestamp,
        readAt: timestamp
      }
    ],
    tags: ["tag1", "tag2", ...],
    settings: {
      ttsVoice: "default",
      ttsSpeed: 1.0,
      autoExtract: true
    }
  }
  ```
- **Search Functionality**: Search by title, URL, or tags 
- **Tag Filtering**: Filter bookmarks by specific tags 
- **Auto-tag Management**: Automatically manages tag list 

## Implementation Steps

### Phase 1: Basic Extension Setup
1. Create manifest.json with required permissions
2. Set up basic popup UI
3. Implement bookmark saving functionality
4. Create storage utilities

### Phase 2: Article Extraction
1. Implement content script injection
2. Build article extraction algorithm
3. Clean and format extracted content
4. Store extracted content with bookmarks

### Phase 3: Tagging System
1. Create tag input UI
2. Implement tag storage and retrieval
3. Add tag filtering functionality
4. Build tag management interface

### Phase 4: TTS Integration
1. Implement Mac TTS via Web Speech API (or native messaging)
2. Add playback controls
3. Implement progress tracking
4. Add voice selection (if available)

### Phase 5: UI/UX Polish
1. Improve popup design
2. Add animations and transitions
3. Implement search functionality
4. Add keyboard shortcuts

### Phase 6: Testing & Optimization
1. Test on various websites
2. Optimize extraction algorithm
3. Handle edge cases
4. Performance optimization

## Technical Stack

- **HTML/CSS/JavaScript**: Core extension code
- **Chrome Extension APIs**:
  - `chrome.storage` - Local storage
  - `chrome.tabs` - Tab management
  - `chrome.scripting` - Content script injection
- **Web Speech API**: Browser TTS (primary)
- **Readability Algorithm**: Custom implementation for article extraction

## Data Flow

1. **Bookmarking (Current Page)**:
   - User clicks extension icon → Popup opens
   - User clicks "Save Current Page" → Content script extracts article
   - Article content + metadata saved to storage

2. **Bookmarking (Paste URL)** :
   - User pastes URL in input field
   - URL validated and https:// added if needed
   - New tab opened in background
   - Waits for page to load (3+ seconds for dynamic content)
   - Waits for DOM to be ready
   - Content extracted with retry logic (up to 3 attempts)
   - Article content + metadata saved to storage

3. **TTS Playback**:
   - User selects bookmark → Clicks "Listen"
   - If no content, attempts to extract from existing/open tab 
   - Extracted content sent to TTS engine
   - Audio playback starts with controls
   - Proper event handling for pause/resume/stop 

4. **Audio Generation** :
   - User clicks "Generate & Save Audio"
   - Audio generated from article text
   - Audio file saved as blob
   - Audio URL stored in bookmark
   - HTML5 audio player appears with seek controls

5. **Audio Playback** :
   - If audio file exists, HTML5 player is shown
   - Full seek/scrub controls available
   - Time display (current/total)
   - Download button available

6. **Tagging**:
   - User adds tags when saving or editing
   - Tags stored with bookmark
   - Tags available for filtering
   - Tag suggestions shown when adding tags 

## Implemented Improvements (Post-Plan)

### UI/UX Enhancements
- ✅ **Larger Popup**: Increased from 400px to 600px width, 700-900px height
- ✅ **Better Typography**: Larger fonts (14-15px), improved line-height
- ✅ **Improved Spacing**: More padding, better visual hierarchy
- ✅ **Gradient Backgrounds**: Modern gradient design for URL input section
- ✅ **Better Button Sizing**: Larger, more clickable buttons
- ✅ **Enhanced Modal**: Larger TTS modal (900px) for better content viewing

### Functionality Improvements
- ✅ **Paste URL Feature**: Direct URL pasting and saving
- ✅ **URL Validation**: Automatic https:// prefix addition
- ✅ **Background Tab Extraction**: Opens URLs in background for extraction
- ✅ **Retry Logic**: 3-attempt retry for content extraction
- ✅ **DOM Ready Wait**: Waits for JavaScript-rendered content
- ✅ **Extended Wait Times**: 3+ seconds for dynamic content loading
- ✅ **Event Delegation**: Fixed Listen/Delete button issues
- ✅ **Better Error Handling**: Comprehensive error handling and logging
- ✅ **Fallback Extraction**: Attempts to extract content when clicking Listen if missing

### Audio Features
- ✅ **MP3/Audio Generation**: Generate audio files from articles
- ✅ **HTML5 Audio Player**: Full-featured player with seek controls
- ✅ **Audio Storage**: Save audio files with bookmarks
- ✅ **Download Audio**: Download generated audio files
- ✅ **Seek Controls**: Full seek/scrub functionality
- ✅ **Time Display**: Current time and total duration
- ✅ **Auto-load Audio**: Automatically loads saved audio

### TTS Improvements
- ✅ **Browser Default Voice**: Uses browser's default TTS voice
- ✅ **Fixed Pause/Stop**: Proper pause and stop button functionality
- ✅ **Event Handlers**: Complete event handling (onstart, onend, onpause, onresume)
- ✅ **Status Tracking**: Real-time TTS status management
- ✅ **Better Controls**: Improved button state management

### Documentation
- ✅ **TESTING.md**: Comprehensive testing guide
- ✅ **QUICKSTART.md**: Quick start instructions
- ✅ **test-extension.sh**: Automated testing helper script
- ✅ **create-icons.html**: Icon generator tool

## Future Enhancements

- **Sync**: Chrome sync storage for cross-device access
- **Export**: Export bookmarks to JSON/CSV
- **Import**: Import from Pocket, Instapaper, etc.
- **Offline Reading**: Cache articles for offline access
- **Reading Time**: Estimate reading time
- **Highlights**: Highlight important sections
- **Notes**: Add notes to bookmarks
- **Categories**: Organize bookmarks into categories
- **Better Audio Generation**: Use proper TTS API service for MP3 generation
- **Audio Concatenation**: Combine multiple audio chunks for long articles
- **Audio Quality Settings**: Adjustable audio quality/bitrate
- **Batch Operations**: Save multiple URLs at once
- **Keyboard Shortcuts**: Quick actions via keyboard

## Browser Compatibility

- **Primary**: Chrome/Chromium-based browsers
- **Future**: Firefox (with manifest v3 compatibility)

## Security & Privacy

- All data stored locally (Chrome storage)
- No external API calls (except optional TTS and audio generation)
- No tracking or analytics
- User data never leaves the browser
- Audio files stored as local blobs 
- Downloads require user permission 

## Testing & Quality Assurance

### Testing Tools Created
- **test-extension.sh**: Automated setup and verification script
- **TESTING.md**: Comprehensive testing guide with step-by-step instructions
- **QUICKSTART.md**: Quick start guide for new users

### Testing Checklist
- ✅ Extension loads without errors
- ✅ Popup opens and displays correctly
- ✅ Save current page works
- ✅ Paste URL feature works
- ✅ Content extraction with retry logic
- ✅ Tag system (add, filter, search)
- ✅ TTS playback (play, pause, stop)
- ✅ Audio generation and playback
- ✅ Audio download functionality
- ✅ Search and filter bookmarks
- ✅ Delete bookmarks
- ✅ Error handling and edge cases