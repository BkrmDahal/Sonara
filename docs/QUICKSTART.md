# Quick Start Guide

## Step 1: Generate Icons

You have two options:

### Option A: Use the Icon Generator (Easiest)
1. Open `create-icons.html` in your browser
2. Icons will be automatically generated
3. Right-click each canvas and "Save image as..."
4. Save them as:
   - `icons/icon16.png`
   - `icons/icon48.png`
   - `icons/icon128.png`

### Option B: Create Your Own Icons
Create PNG images with these sizes and save them in the `icons/` folder:
- `icon16.png` - 16x16 pixels
- `icon48.png` - 48x48 pixels
- `icon128.png` - 128x128 pixels

## Step 2: Load Extension in Chrome

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `Sonara` folder
6. Done! The extension should now appear

## Step 3: Pin the Extension

1. Click the puzzle piece icon (🧩) in Chrome's toolbar
2. Find "Sonara" in the list
3. Click the pin icon to keep it visible

## Step 4: Start Using

1. Visit any article page
2. Click the Sonara extension icon
3. Click "Save Current Page"
4. Add tags and save
5. Click "🎧 Listen" on any bookmark to hear it read aloud!

## Troubleshooting

**Icons not showing?**
- Make sure all three icon files exist in `icons/` folder
- Reload the extension after adding icons

**TTS not working?**
- Make sure your browser supports Web Speech API
- Try a different browser if needed
- Check browser console (F12) for errors

**Article extraction not perfect?**
- Some sites have complex layouts
- The extension will use full page content as fallback
- You can still listen to it!

Enjoy using Sonara! 🎉
