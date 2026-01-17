# <img src="assets/original logo.png" alt="Sonara Logo" width="32" height="32"> Sonara

A Chrome extension that saves articles and reads them to you with AI-powered voices. Save any article, listen while you work, and never miss great content.

<img src="assets/product/Article%20list.png" alt="Article List" width="600">

## ✨ Features

### 📚 Save & Organize Articles
- **One-click save**: Save any article instantly
- **Clean reading**: Automatically removes ads and clutter, shows clean formatted text
- **Tags & search**: Organize with tags and find articles quickly
- **Archive**: Mark articles as done to keep your list organized
- **Edit content**: Edit article text and regenerate audio with your changes

<img src="assets/product/Article%20view.png" alt="Article View" width="600">

### 🎧 Listen to Articles
- **AI voices**: High-quality text-to-speech using OpenAI (13 voice options)
- **Auto-generates**: Audio creates automatically when you save articles
- **Download audio**: Save audio files to listen offline
- **Custom audio**: Create audio from any text, no webpage needed
- **Background player**: Keep listening while browsing other pages
- **Auto-play**: Option to automatically start playing when audio is ready

### 📝 Highlights
- **Save quotes**: Select and save important text from articles
- **View all highlights**: See all your saved quotes in one place
- **Quick access**: Jump back to any article from your highlights

<img src="assets/product/Highlight.png" alt="Highlights" width="600">

### 🔍 Find What You Need
- **Search articles**: Search by title, URL, or tags
- **Search in article**: Find specific text within any article
- **Filter by status**: View new, all, or archived articles
- **Filter by tags**: Quickly find articles by topic

### 🎯 Smart Features
- **Fullscreen reading**: Distraction-free reading mode
- **Job logs**: Track audio generation progress with detailed logs
- **Reprocess audio**: Regenerate audio anytime
- **Cancel generation**: Stop audio generation if needed

## 🚀 Quick Start

1. **Install the extension**
   - Download or clone this repository
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the Sonara folder

2. **Set up (optional)**
   - Click the extension icon
   - Open Settings (⚙ icon)
   - Add your OpenAI API key for high-quality voices
   - Get your key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

<img src="assets/product/Settings.png" alt="Settings" width="600">

3. **Start using**
   - Visit any article
   - Click the extension icon
   - Click "Save Current Page"
   - Add tags if you want
   - Click "Save"

That's it! Audio will generate automatically. Click "Listen" when you're ready to hear it.

## 📖 How to Use

### Save an Article
1. Visit any article on the web
2. Click the Sonara extension icon
3. Click "Save Current Page"
4. Edit title and add tags (optional)
5. Click "Save"

### Listen to Articles
- Click any article in your list, or click the "🎧 Listen" button
- If audio is ready, it plays automatically (if auto-play is enabled)
- Use the player controls to play, pause, or seek
- Download audio to listen offline

### Create Custom Audio
- Click the microphone icon (🎙️) in the header
- Enter a title and paste your text
- Click "Generate Audio"
- Listen when ready

### Highlight Text
- Open any article
- Select the text you want to save
- Click "💾 Save Highlight"
- View all highlights by clicking the 📑 icon

### Search & Organize
- **Search**: Type in the search box to find articles
- **Filter**: Use dropdowns to filter by status or tags
- **Edit tags**: Click "+ Edit Tags" on any article
- **Archive**: Click "📦 Archive" when done reading
- **Delete**: Click "Delete" to remove articles

### Edit Articles
- Open any article
- Click the edit icon (✏️)
- Make your changes
- Click "Save & Regenerate Audio" to update the content and create new audio

## 🔒 Privacy

- **100% local**: All your data stays in your browser
- **No tracking**: We don't collect any information
- **Your data**: Everything is stored locally on your device
- **Optional API**: Works without OpenAI (uses your browser's voice)

## 🛠️ For Developers

Built with vanilla JavaScript, no frameworks. Uses Chrome Storage API and IndexedDB for data. See the code for implementation details.

## ⚠️ Known Issues

- **Article parsing is basic**: Due to Chrome extension limitations, we cannot use third-party libraries for article extraction. The current parser uses simple heuristics to find article content, which may not work perfectly on all websites. Some complex sites may require manual content selection.

- **Audio generation timeout**: Very long articles (over 10 minutes of audio) may timeout during generation. The system will auto-retry after 10 minutes if a timeout occurs.

- **Browser TTS limitations**: When OpenAI API key is not configured, the extension uses browser's built-in TTS which has limited voice options and quality compared to OpenAI voices.

- **Large audio files**: Very large audio files may take time to load or play, especially on slower connections.

- **Search in complex HTML**: Article search may not work perfectly on articles with complex HTML structures or embedded content.

## 📋 Todo

- [ ] Improve article extraction with better heuristics
- [ ] Add support for more article formats
- [ ] Chrome Sync for cross-device access
- [ ] Export/Import bookmarks (JSON)
- [ ] Keyboard shortcuts
- [ ] Batch operations (delete multiple, archive multiple)
- [ ] Reading statistics
- [ ] Better error messages for article extraction failures
- [ ] Support for PDF articles

## 📝 License

MIT License - See [LICENSE](LICENSE) file for details.

---

Made with ❤️ for readers who want to listen
