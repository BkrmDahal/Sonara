# Sonara

A modern Chrome extension for bookmarking articles, extracting clean content, and listening with AI-powered text-to-speech. Think Pocket, but with built-in audio narration.

![Sonara Extension](icons/icon128.png)

## ✨ Features

### 📚 Smart Bookmarking
- **One-click save**: Save any article with a single click
- **Clean extraction**: Automatically extracts article content, removing ads, sidebars, and clutter
- **Markdown rendering**: Articles displayed as beautifully formatted markdown for easy reading
- **Tag management**: Organize articles with tags, edit them inline, and filter by tags
- **Archive system**: Mark articles as read/done to keep your reading list organized
- **Text highlighting**: Select and save highlights from articles for quick reference

### 🎧 AI-Powered Audio
- **OpenAI TTS integration**: High-quality text-to-speech using GPT-4o mini TTS model
- **Background generation**: Audio generates automatically when you save, so it's ready when you want to listen
- **Multiple voices**: Choose from 13 OpenAI voices (Marin and Cedar recommended)
- **Browser fallback**: Uses browser's built-in TTS when OpenAI API key isn't configured
- **Audio download**: Download generated audio files as MP3
- **Create custom audio**: Generate audio from any text with custom title (no webpage needed)
- **Bottom audio player**: Compact sticky player at bottom when audio is playing
- **Robust generation**: Handles long articles with retry logic and better error handling

### 📝 Highlights & Notes
- **Text highlighting**: Select any text in articles and save highlights
- **Highlights view**: See all highlights in one place with article links
- **Quick access**: Jump to original article from highlights view
- **Visual indicators**: Highlights are marked in articles for easy reference

### 🔍 Organization
- **Search**: Search bookmarks by title, URL, or tags
- **Filter by status**: View New, All, or Archived articles
- **Tag filtering**: Filter by specific tags
- **Modern UI**: Clean, minimalistic design with smooth animations
- **Fullscreen reading**: Open articles in fullscreen for distraction-free reading

### 🔒 Privacy First
- **100% local storage**: All data stored in your browser
- **No tracking**: Zero analytics or tracking
- **API key optional**: Works without OpenAI (uses browser TTS)
- **Your data stays yours**: Nothing leaves your device

## 🚀 Installation

### Prerequisites
- Google Chrome (or Chromium-based browser)
- OpenAI API key (optional, for high-quality TTS)

### Steps

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd Sonara
   ```

2. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top right)
   - Click **Load unpacked**
   - Select the `Sonara` folder
   - The extension should now appear in your extensions list

3. **Pin the extension** (optional but recommended)
   - Click the puzzle piece icon in Chrome toolbar
   - Find "Sonara" and click the pin icon

4. **Configure OpenAI TTS** (optional)
   - Click the settings icon (⚙) in the extension popup
   - Enter your OpenAI API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Select your preferred voice
   - Click "Save Settings"

## 📖 Usage

### Saving an Article

1. Navigate to any web page with an article
2. Click the Sonara extension icon
3. Click **"Save Current Page"**
4. Edit the title and add tags (comma-separated) if needed
5. Click **"Save"**
   - If OpenAI is configured, audio will generate in the background
   - A spinner icon appears on the bookmark while generating

### Listening to Articles

1. Open the Sonara popup
2. Click on any bookmark card (or the **🎧 Listen** button)
3. If audio is ready:
   - The audio player appears automatically
   - Click play to start listening
   - Use seek controls to jump to any part
   - A compact player appears at the bottom when audio is playing
4. If audio is generating:
   - You'll see "Generating audio… Please wait."
   - The player will appear automatically when ready
5. If no audio (no API key):
   - Use the **Play** button for browser TTS
   - Adjust speed with the slider

### Creating Custom Audio

1. Click the **🎙️** icon in the header
2. Enter a title for your audio
3. Paste or type the text you want to convert to audio
4. Click **"Generate Audio"**
5. The entry appears in your bookmarks list
6. Audio generates in the background (same as saved articles)
7. Click **Listen** when ready to play

### Highlighting Text

1. Open any article in the Listen modal
2. Select the text you want to highlight
3. Click **"💾 Save Highlight"** in the toolbar
4. The text is highlighted and saved
5. View all highlights by clicking the **📑** icon in the header
6. Click **"View in Sonara"** to jump to the article with the highlight

### Fullscreen Reading

1. Open any article in the Listen modal
2. Click the **fullscreen** icon (⛶) in the header
3. Article opens in fullscreen for better reading
4. You can still highlight text in fullscreen mode
5. Close fullscreen by clicking the X button

### Managing Bookmarks

- **Search**: Type in the search box to find articles
- **Filter**: Use the dropdowns to filter by status (New/All/Archived) or tags
- **Edit tags**: Click **"+ Edit Tags"** on any bookmark
- **Remove tags**: Click the × on any tag
- **Archive**: Click **"📦 Send to Archive"** when done reading
- **Delete**: Click **"Delete"** to remove a bookmark

### Settings

Click the settings icon (⚙) to:
- Add/update your OpenAI API key
- Select your preferred TTS voice
- All settings are saved locally

## 🏗️ Architecture

### Tech Stack
- **Manifest V3**: Modern Chrome extension architecture
- **Vanilla JavaScript**: No frameworks, pure JS
- **Chrome Storage API**: Local data persistence
- **Web Speech API**: Browser TTS fallback
- **OpenAI TTS API**: High-quality AI voices

### Project Structure

```
Sonara/
├── manifest.json          # Extension configuration
├── popup.html             # Main UI
├── popup.js               # UI logic and event handlers
├── popup.css              # Styles
├── background.js          # Service worker (audio generation)
├── content.js             # Content script (article extraction)
├── storage.js             # Storage utilities
├── audio-storage.js       # IndexedDB storage for large audio files
├── highlights.js          # Highlights storage and management
├── tts.js                 # Browser TTS engine
├── openai-tts.js          # OpenAI TTS integration
├── icons/                 # Extension icons (16, 48, 128px)
├── docs/                  # Documentation
│   ├── PLAN.md           # Development plan
│   ├── TESTING.md        # Testing guide
│   └── QUICKSTART.md     # Quick start guide
├── assets/                # Assets and tools
│   ├── tools/            # Helper tools
│   └── *.png             # Source images
├── LICENSE                # MIT License
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

### Key Components

**Storage Manager** (`storage.js`)
- Manages bookmarks, tags, and settings
- Handles Chrome Storage API operations
- Provides search and filter utilities

**Article Extractor** (`content.js`)
- Extracts clean article content from web pages
- Removes ads, sidebars, and navigation
- Identifies article title, author, and publish date

**TTS Engine** (`tts.js`)
- Browser-based text-to-speech using Web Speech API
- Handles play, pause, stop, and speed control
- Fallback when OpenAI is not configured

**OpenAI TTS** (`openai-tts.js`)
- Integrates with OpenAI's GPT-4o mini TTS API
- Handles long text by chunking (4096 char limit)
- Combines audio chunks into single MP3

**Background Service** (`background.js`)
- Generates audio in the background when bookmarks are saved
- Updates bookmarks with audio data when complete
- Sends notifications when audio is ready
- Robust error handling with retry logic
- Increased timeouts for longer articles (10 minutes total, 2 minutes per chunk)

**Audio Storage** (`audio-storage.js`)
- IndexedDB storage for large audio files
- Bypasses Chrome storage quota limits (10MB)
- Supports files of any size (GB range)
- Automatic migration from Chrome storage

**Highlights Manager** (`highlights.js`)
- IndexedDB storage for text highlights
- Associates highlights with bookmarks
- Stores highlighted text, context, and timestamps

## 🔧 Development

### Local Development

1. Make changes to the code
2. Go to `chrome://extensions/`
3. Click the reload icon on the Sonara extension
4. Test your changes

### Testing

See `docs/TESTING.md` for detailed testing procedures.

### Building

No build step required! The extension runs directly from source. Just load the folder in Chrome.

## 🌐 Browser Compatibility

- ✅ **Chrome**: Fully supported
- ✅ **Chromium-based browsers** (Edge, Brave, Opera): Should work
- ❌ **Firefox**: Not supported (uses Manifest V3)

## 🔐 Privacy & Security

- **Local storage only**: All data stored in `chrome.storage.local`
- **No external requests** (except OpenAI API when configured)
- **No tracking**: Zero analytics or telemetry
- **API key storage**: Stored locally, never transmitted except to OpenAI
- **Open source**: Full code transparency

## 📝 License

MIT License - See [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines
- Follow existing code style
- Add comments for complex logic
- Test thoroughly before submitting
- Update documentation if needed

## 🐛 Troubleshooting

### Audio Not Generating
- Check that your OpenAI API key is correct in Settings
- Verify you have API credits available
- Check browser console for errors (F12 → Console)
- Try reloading the extension

### Article Extraction Fails
- Some websites have complex structures
- Try saving anyway - you can still listen to the full page
- The extension falls back to full page content

### Extension Not Loading
- Make sure all files are present
- Check that `manifest.json` is valid JSON
- Verify icons exist in `icons/` folder
- Check Chrome's extension error page

### Audio Player Not Showing
- Wait for the "Generating audio…" message to disappear
- Check that audio was generated (look for spinner on bookmark)
- Try saving the bookmark again
- Check browser console for errors

## 🗺️ Roadmap

- [x] Notes and highlights ✅
- [x] Markdown article rendering ✅
- [x] Fullscreen reading mode ✅
- [x] Create audio from custom text ✅
- [x] Bottom audio player ✅
- [ ] Chrome Sync for cross-device access
- [ ] Export/Import bookmarks (JSON)
- [ ] Reading time estimates
- [ ] Keyboard shortcuts
- [ ] Dark mode
- [ ] Batch operations
- [ ] Reading statistics

## 📧 Support

For issues, questions, or suggestions, please open an issue on GitHub.

---

Made with ❤️ for readers who want to listen
