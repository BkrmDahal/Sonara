# How to Test Sonara Extension Locally

## Prerequisites

1. **Google Chrome** (or Chromium-based browser)
2. **Icons** - The extension needs icon files (see Step 1 below)

## Step 1: Set Up Icons

The extension requires three icon files. You have a few options:

### Option A: Use Existing Images (Quick)
If you have PNG files in the `icons/` folder, rename them:

```bash
cd /Users/bkrmmini/code/Sonara/icons
# Copy one of your existing PNGs to create the required sizes
cp download.png icon16.png
cp download.png icon48.png
cp download.png icon128.png
```

### Option B: Generate Icons (Recommended)
1. Open `create-icons.html` in your browser
2. Icons will be auto-generated
3. Right-click each canvas → "Save image as..."
4. Save as:
   - `icon16.png` (16x16)
   - `icon48.png` (48x48)
   - `icon128.png` (128x128)

### Option C: Use Any PNG Images
You can use any PNG images - Chrome will resize them automatically.

## Step 2: Load Extension in Chrome

1. **Open Chrome Extensions Page**
   - Open Chrome
   - Navigate to: `chrome://extensions/`
   - OR: Menu (⋮) → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner
   - It should turn blue/on

3. **Load the Extension**
   - Click "Load unpacked" button
   - Navigate to: `/Users/bkrmmini/code/Sonara`
   - Click "Select" or "Open"

4. **Verify Installation**
   - You should see "Sonara" in your extensions list
   - If there are errors (red text), check the console (see Troubleshooting)

## Step 3: Pin the Extension

1. Click the **puzzle piece icon** (🧩) in Chrome's toolbar
2. Find "Sonara" in the dropdown
3. Click the **pin icon** 📌 to keep it visible in your toolbar

## Step 4: Test Basic Functionality

### Test 1: Open the Popup
1. Click the Sonara icon in your toolbar
2. ✅ **Expected**: Popup opens showing "Save Current Page" button
3. ✅ **Expected**: Empty state message if no bookmarks

### Test 2: Save a Bookmark
1. Visit a news article (e.g., https://www.bbc.com/news or any article page)
2. Click the Sonara extension icon
3. Click "Save Current Page" button
4. ✅ **Expected**: Modal opens with title and tag fields
5. Add some tags (e.g., "news, tech")
6. Click "Save"
7. ✅ **Expected**: Bookmark appears in the list

### Test 3: Search Bookmarks
1. In the popup, type in the search box
2. ✅ **Expected**: Bookmarks filter as you type

### Test 4: Filter by Tags
1. Click the tag dropdown
2. Select a tag
3. ✅ **Expected**: Only bookmarks with that tag are shown

### Test 5: Text-to-Speech
1. Click "🎧 Listen" on a saved bookmark
2. ✅ **Expected**: TTS modal opens with article content
3. Click "▶ Play"
4. ✅ **Expected**: Article is read aloud
5. Test pause, stop, and speed controls

### Test 6: Delete Bookmark
1. Click "Delete" on a bookmark
2. Confirm deletion
3. ✅ **Expected**: Bookmark is removed from list

## Step 5: Test Article Extraction

Visit different types of sites to test extraction:

1. **News Articles**: BBC, CNN, Medium articles
2. **Blog Posts**: Personal blogs, tech blogs
3. **Complex Sites**: Sites with lots of ads/sidebars

✅ **Expected**: Clean article text is extracted (ads/navigation removed)

## Debugging & Troubleshooting

### View Extension Console
1. Right-click the extension icon → "Inspect popup"
2. OR: Go to `chrome://extensions/` → Find Sonara → Click "service worker" (for background.js)
3. Check for errors in the Console tab

### Common Issues

**"Icons not found" error:**
- Make sure `icon16.png`, `icon48.png`, `icon128.png` exist in `icons/` folder
- Reload the extension after adding icons

**"Cannot access chrome.tabs" error:**
- Make sure you're testing on a real webpage (not chrome:// pages)
- The extension needs `activeTab` permission

**TTS not working:**
- Open browser console (F12)
- Check for Web Speech API errors
- Try on a different website
- Some browsers/sites may block TTS

**Article extraction not working:**
- Check console for errors
- Some sites block content scripts
- Try a different article page

### Reload Extension After Changes

After making code changes:
1. Go to `chrome://extensions/`
2. Find Sonara
3. Click the **reload icon** (🔄) on the extension card

## Testing Checklist

- [ ] Extension loads without errors
- [ ] Popup opens when clicking icon
- [ ] Can save a bookmark from an article page
- [ ] Tags are saved and displayed
- [ ] Search functionality works
- [ ] Tag filtering works
- [ ] TTS plays audio
- [ ] TTS controls (play/pause/stop) work
- [ ] Speed adjustment works
- [ ] Delete bookmark works
- [ ] Article extraction removes ads/navigation
- [ ] Bookmarks persist after closing/reopening popup

## Quick Test URLs

Good test pages for article extraction:
- https://www.bbc.com/news
- https://medium.com (any article)
- https://www.theverge.com (any article)
- https://www.nytimes.com (any article)

## Next Steps

Once testing is complete:
- Report any bugs you find
- Suggest improvements
- Test on different websites
- Test with different article formats

Happy testing! 🚀
