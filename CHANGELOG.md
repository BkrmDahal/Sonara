# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-01-17

### Added
- **Markdown Article Rendering**: Articles now display as beautifully formatted markdown with proper typography
- **Text Highlighting**: Select and save highlights from articles with visual indicators
- **Fullscreen Article View**: Open articles in fullscreen mode for better reading and highlighting
- **Create Audio from Text**: Manually create audio from custom title and text (no webpage required)
- **Bottom Audio Player**: Compact sticky audio player at bottom of popup when audio is playing
- **Compact Audio Controls**: Streamlined audio player interface for more article space
- **IndexedDB Audio Storage**: Large audio files stored in IndexedDB to avoid Chrome storage quota limits
- **Improved Error Handling**: Better error messages and retry logic for audio generation
- **Enhanced API Robustness**: Increased timeouts, retry logic with exponential backoff for longer articles
- **Highlights Management**: View all highlights in one place with article links and details
- **Simple Flat Icons**: Clean SVG icons for Create Audio, Highlights, and Settings with tooltips

### Improved
- **Article Display**: Markdown rendering with proper headings, lists, code blocks, and formatting
- **Audio Generation**: More robust handling of long articles with better timeout management
- **Error Visibility**: Errors now shown to users in UI, not just console
- **Storage Efficiency**: Audio files moved to IndexedDB, freeing up Chrome storage quota
- **UI/UX**: More compact controls, better spacing, improved visual hierarchy
- **Fullscreen Experience**: Dedicated fullscreen view optimized for reading and highlighting

### Fixed
- **Storage Quota Issues**: Large audio files (7MB+) now save successfully using IndexedDB
- **Audio Generation Errors**: Better error handling and user feedback when generation fails
- **Long Article Timeouts**: Increased timeouts and added retry logic for longer articles
- **Display Issues**: Fixed popup layout to properly fill screen height
- **Highlight Saving**: Fixed issues with highlight save functionality

### Technical
- IndexedDB integration for large file storage
- HTML to Markdown converter
- Markdown to HTML renderer
- Enhanced error handling and logging
- Improved text selection and range handling

## [1.0.0] - 2026-01-17

### Added
- Initial release
- Bookmark pages with one-click save
- Article content extraction (removes ads, sidebars)
- Tag management system with inline editing
- Archive system (New/All/Archived filters)
- OpenAI TTS integration (GPT-4o mini TTS)
- Background audio generation
- Audio download functionality
- Browser TTS fallback (Web Speech API)
- Search and filter by tags
- Modern, minimalistic UI design
- Settings panel for API key and voice selection
- Audio generation status indicators
- Click-to-listen on bookmark cards

### Features
- **Smart Bookmarking**: Extract clean article content automatically
- **AI-Powered Audio**: High-quality TTS with 13 voice options
- **Background Processing**: Audio generates automatically when saving
- **Privacy First**: All data stored locally, no tracking
- **Archive System**: Organize articles by read status
- **Tag Management**: Add, edit, and filter by tags

### Technical
- Manifest V3 architecture
- Chrome Storage API for persistence
- Background service worker for audio generation
- Content scripts for article extraction
- OpenAI TTS API integration
- Web Speech API fallback
