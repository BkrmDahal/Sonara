# Export/Import Feature Implementation Plan

## Overview
This document outlines the plan to implement export and import functionality for Sonara, allowing users to transfer their data (articles, highlights, settings, and audio) between computers.

## Current Data Storage Structure

### Chrome Storage (via `storage.js`)
- **bookmarks**: Array of article/bookmark objects
- **tags**: Array of tag strings
- **settings**: Object containing:
  - `openaiApiKey` (sensitive - should be optional in export)
  - `openaiVoice`
  - `ttsVoice`
  - `ttsSpeed`
  - `autoExtract`
- **jobLogs**: Array of job log objects (optional to export)

### IndexedDB - Highlights (via `highlights.js`)
- Database: `SonaraHighlightsDB`
- Store: `highlights`
- Each highlight contains:
  - `id` (auto-increment)
  - `bookmarkId`
  - `text`
  - `comment`
  - `context`
  - `createdAt`
  - `updatedAt`

### IndexedDB - Audio Files (via `audio-storage.js`)
- Database: `SonaraAudioDB`
- Store: `audioFiles`
- Each audio file contains:
  - `bookmarkId`
  - `base64Audio` (can be very large - several MB per article)
  - `mimeType`
  - `savedAt`

## Implementation Plan

### Phase 1: Export Functionality

#### 1.1 Export Data Structure
Create a JSON export format:
```json
{
  "version": "1.0.0",
  "exportDate": "2024-01-01T00:00:00.000Z",
  "data": {
    "bookmarks": [...],
    "tags": [...],
    "settings": {...},
    "highlights": [...],
    "audioFiles": [...] // Optional, can be excluded for smaller exports
  },
  "metadata": {
    "bookmarkCount": 10,
    "highlightCount": 5,
    "audioFileCount": 8,
    "totalSize": "2.5MB"
  }
}
```

#### 1.2 Export Function Implementation
**Location**: Add to `popup.js` or create new `export-import.js`

**Function**: `async function exportData(options = {})`
- Options:
  - `includeAudio`: boolean (default: false) - Include audio files in export
  - `includeApiKey`: boolean (default: false) - Include OpenAI API key
  - `includeJobLogs`: boolean (default: false) - Include job logs

**Steps**:
1. Get all bookmarks from Chrome Storage
2. Get all tags from Chrome Storage
3. Get settings (optionally exclude API key)
4. Get all highlights from IndexedDB
5. If `includeAudio` is true:
   - Get all audio files from IndexedDB
   - Note: This can create very large files (100MB+)
6. Build export object
7. Convert to JSON string
8. Create blob and download

#### 1.3 UI Changes for Export
**Location**: `popup.html` - Settings Modal

Add export section:
```html
<div class="form-group">
  <label>Data Export</label>
  <div style="display: flex; flex-direction: column; gap: 8px;">
    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
      <input type="checkbox" id="exportIncludeAudio" style="width: 18px; height: 18px;">
      <span>Include audio files (may create large files)</span>
    </label>
    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
      <input type="checkbox" id="exportIncludeApiKey" style="width: 18px; height: 18px;">
      <span>Include API key (not recommended)</span>
    </label>
    <button id="exportDataBtn" class="btn btn-secondary">📥 Export Data</button>
  </div>
  <p class="form-hint">Download all your articles, highlights, and settings as a JSON file.</p>
</div>
```

### Phase 2: Import Functionality

#### 2.1 Import Function Implementation
**Function**: `async function importData(file, options = {})`
- Options:
  - `mergeMode`: 'replace' | 'merge' (default: 'replace')
    - `replace`: Replace all existing data
    - `merge`: Merge with existing data (keep both, handle conflicts)

**Steps**:
1. Read file as text
2. Parse JSON
3. Validate structure and version
4. Show confirmation dialog with:
   - Number of items to import
   - Merge vs Replace option
   - Warning about overwriting data
5. If confirmed:
   - If merge mode:
     - Merge bookmarks (by URL or ID)
     - Merge tags (deduplicate)
     - Merge highlights
     - Merge audio files
     - Settings: merge (keep existing API key if not in import)
   - If replace mode:
     - Clear existing data
     - Import all new data
6. Show progress indicator
7. Save to Chrome Storage and IndexedDB
8. Show success/error message
9. Reload UI

#### 2.2 Conflict Resolution (Merge Mode)
- **Bookmarks**: Match by URL, update if exists, add if new
- **Tags**: Merge arrays, remove duplicates
- **Highlights**: Add all (IDs will be regenerated)
- **Audio Files**: Replace if bookmarkId exists, add if new
- **Settings**: Merge objects, preserve existing API key if import doesn't have one

#### 2.3 UI Changes for Import
**Location**: `popup.html` - Settings Modal

Add import section:
```html
<div class="form-group">
  <label>Data Import</label>
  <div style="display: flex; flex-direction: column; gap: 8px;">
    <input type="file" id="importFileInput" accept=".json" style="display: none;">
    <button id="importDataBtn" class="btn btn-secondary">📤 Import Data</button>
    <p class="form-hint">Restore your data from a previously exported JSON file.</p>
  </div>
</div>
```

Add import confirmation modal:
```html
<div id="importConfirmModal" class="modal">
  <div class="modal-content">
    <div class="modal-header">
      <h2>Confirm Import</h2>
      <button class="close-btn" id="closeImportConfirmModal">&times;</button>
    </div>
    <div class="modal-body">
      <div id="importPreview"></div>
      <div class="form-group">
        <label>Import Mode:</label>
        <select id="importMode" class="form-input">
          <option value="replace">Replace all data</option>
          <option value="merge">Merge with existing data</option>
        </select>
      </div>
      <div class="form-actions">
        <button id="confirmImportBtn" class="btn btn-primary">Import</button>
        <button id="cancelImportBtn" class="btn btn-secondary">Cancel</button>
      </div>
    </div>
  </div>
</div>
```

### Phase 3: Error Handling & Validation

#### 3.1 Validation
- Check file format (must be JSON)
- Check version compatibility
- Validate required fields
- Check data types
- Warn about large files (>50MB)

#### 3.2 Error Handling
- Invalid file format
- Corrupted data
- Missing required fields
- Storage quota exceeded
- IndexedDB errors
- Show user-friendly error messages

#### 3.3 Progress Indicators
- Show progress during export (especially for large audio files)
- Show progress during import
- Display estimated time remaining

### Phase 4: Implementation Details

#### 4.1 File Structure
Create new file: `export-import.js`
- Contains all export/import logic
- Can be imported in `popup.html`

Or add functions to `popup.js`:
- Keep everything in one place
- Easier to access existing functions

**Recommendation**: Add to `popup.js` for simplicity, but keep functions well-organized.

#### 4.2 Functions to Implement

**Export Functions**:
- `async exportData(options)` - Main export function
- `async getAllAudioFiles()` - Get all audio from IndexedDB
- `formatExportData(data, metadata)` - Format data for export
- `downloadJSON(data, filename)` - Download JSON file

**Import Functions**:
- `async importData(file, options)` - Main import function
- `validateImportData(data)` - Validate imported data
- `async mergeData(existing, imported)` - Merge data
- `async replaceData(imported)` - Replace all data
- `showImportPreview(data)` - Show preview in modal

#### 4.3 Event Listeners
Add to `setupEventListeners()` in `popup.js`:
- `exportDataBtn` click → `handleExportData()`
- `importDataBtn` click → `handleImportData()` (triggers file input)
- `importFileInput` change → `handleImportFileSelect()`
- `confirmImportBtn` click → `handleConfirmImport()`
- `cancelImportBtn` click → `closeImportConfirmModal()`

### Phase 5: Testing Considerations

#### 5.1 Test Cases
1. **Export**:
   - Export with no data
   - Export with bookmarks only
   - Export with highlights
   - Export with audio files (large file)
   - Export with/without API key

2. **Import**:
   - Import valid file (replace mode)
   - Import valid file (merge mode)
   - Import file with conflicts
   - Import corrupted file
   - Import old version file
   - Import very large file

3. **Edge Cases**:
   - Empty bookmarks array
   - Missing required fields
   - Invalid data types
   - Storage quota exceeded
   - Network errors during download

### Phase 6: User Experience Enhancements

#### 6.1 Export Options
- Show file size estimate before export
- Warn about large files
- Show export progress
- Success notification with file size

#### 6.2 Import Options
- Show preview of what will be imported
- Warn about data loss (replace mode)
- Show import progress
- Success notification with counts
- Error recovery suggestions

#### 6.3 Additional Features (Future)
- Scheduled automatic exports
- Cloud backup integration
- Export to different formats (CSV for bookmarks)
- Selective export (by tags, date range)

## Implementation Order

1. ✅ **Phase 1.2**: Implement export function (without audio first)
2. ✅ **Phase 1.3**: Add export UI to settings modal
3. ✅ **Phase 2.1**: Implement import function (replace mode first)
4. ✅ **Phase 2.3**: Add import UI to settings modal
5. ✅ **Phase 3**: Add validation and error handling
6. ✅ **Phase 1.2**: Add audio export option
7. ✅ **Phase 2.1**: Add merge mode
8. ✅ **Phase 5**: Testing
9. ✅ **Phase 6**: UX improvements

## File Changes Summary

### Files to Modify:
1. **popup.html**
   - Add export/import UI to settings modal
   - Add import confirmation modal

2. **popup.js**
   - Add export/import functions
   - Add event listeners
   - Add UI helper functions

3. **popup.css** (if needed)
   - Style for new UI elements
   - Progress indicators

### New Files (Optional):
- `export-import.js` - If separating concerns

## Notes

- **Audio Files**: Consider making audio export optional by default due to file size
- **API Key**: Should be optional in export for security
- **Versioning**: Include version in export to handle future format changes
- **Backup**: Recommend users export before major updates
- **Privacy**: All data stays local, export is user-initiated
