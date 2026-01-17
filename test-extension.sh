#!/bin/bash

# Quick test script for Sonara Chrome Extension

echo "🚀 Sonara Extension Testing Helper"
echo "=================================="
echo ""

# Check if icons exist
echo "📋 Checking icons..."
if [ -f "icons/icon16.png" ] && [ -f "icons/icon48.png" ] && [ -f "icons/icon128.png" ]; then
    echo "✅ All icons found!"
else
    echo "❌ Missing icons! Creating from existing PNG..."
    cd icons
    if [ -f "download.png" ]; then
        cp download.png icon16.png 2>/dev/null
        cp download.png icon48.png 2>/dev/null
        cp download.png icon128.png 2>/dev/null
        echo "✅ Icons created!"
    else
        echo "⚠️  No icon source found. Please create icons manually or use create-icons.html"
    fi
    cd ..
fi

echo ""
echo "📁 Extension location:"
echo "   $(pwd)"
echo ""
echo "📝 Next steps:"
echo "   1. Open Chrome"
echo "   2. Go to: chrome://extensions/"
echo "   3. Enable 'Developer mode' (top-right toggle)"
echo "   4. Click 'Load unpacked'"
echo "   5. Select this folder: $(pwd)"
echo ""
echo "✨ For detailed testing instructions, see docs/TESTING.md"
echo ""

# Check for common issues
echo "🔍 Checking for common issues..."

if [ ! -f "manifest.json" ]; then
    echo "❌ manifest.json not found!"
fi

if [ ! -f "popup.html" ]; then
    echo "❌ popup.html not found!"
fi

if [ ! -f "popup.js" ]; then
    echo "❌ popup.js not found!"
fi

if [ ! -f "storage.js" ]; then
    echo "❌ storage.js not found!"
fi

if [ ! -f "tts.js" ]; then
    echo "❌ tts.js not found!"
fi

if [ ! -f "content.js" ]; then
    echo "❌ content.js not found!"
fi

if [ ! -f "background.js" ]; then
    echo "❌ background.js not found!"
fi

echo ""
echo "✅ Ready to test! Open chrome://extensions/ and load this folder."
