# Advanced File Utilities for Claude Code

This toolkit provides Claude Code-like capabilities for file finding, editing, and manipulation.

## Features

### File Utilities (`file-utilities.js`)
- **Advanced File Search**: Pattern-based file finding with glob support
- **Content Search**: Search within files with context
- **Smart Editing**: File editing with backup and validation
- **Batch Operations**: Process multiple files simultaneously
- **File Metadata**: Get detailed file information

### Advanced Editor (`advanced-editor.js`)
- **Smart Replace**: Context-aware string replacement
- **Precise Insertion**: Insert content at specific lines or patterns
- **Line Removal**: Remove lines by pattern or range
- **Code Extraction**: Extract functions and code blocks
- **Code Formatting**: Intelligent formatting and style fixing
- **Multi-file Refactoring**: Refactor across multiple files

## Usage Examples

### CLI Usage

```bash
# Find files
node tools/file-utilities.js find "**/*.tsx"
node tools/file-utilities.js find "src/**/*.{js,ts,tsx}"

# Search in files
node tools/file-utilities.js search "useState" "**/*.tsx"
node tools/file-utilities.js search "interface" "**/*.ts"

# Get file info
node tools/file-utilities.js info "src/App.tsx"

# Edit files
node tools/advanced-editor.js replace "src/App.tsx" "oldText" "newText"
node tools/advanced-editor.js insert "src/App.tsx" 10 "// New comment"
node tools/advanced-editor.js format "src/App.tsx"
```

### Programmatic Usage

```javascript
const FileUtilities = require('./tools/file-utilities');
const AdvancedEditor = require('./tools/advanced-editor');

const fileUtils = new FileUtilities();
const editor = new AdvancedEditor();

// Find React components
const components = await fileUtils.findFiles('**/*.tsx');

// Search for hooks usage
const hookResults = await fileUtils.searchInFiles('use', '**/*.tsx');

// Smart replace with backup
await editor.smartReplace('src/App.tsx', 'oldFunction', 'newFunction', {
    backup: true,
    replaceAll: true
});

// Insert import at top of file
await editor.insertAt('src/App.tsx', 1, "import { NewComponent } from './NewComponent';");

// Format code
await editor.formatCode('src/App.tsx', {
    fixIndentation: true,
    removeTrailingSpaces: true
});
```

## API Reference

### FileUtilities Methods

- `findFiles(pattern, options)` - Find files matching glob pattern
- `searchInFiles(searchPattern, filePattern, options)` - Search content in files
- `editFile(filePath, editFunction, options)` - Edit file with function
- `batchEdit(filePatterns, editFunction, options)` - Edit multiple files
- `createFile(filePath, content, options)` - Create file with directories
- `getFileInfo(filePath)` - Get file metadata and statistics

### AdvancedEditor Methods

- `smartReplace(filePath, searchPattern, replacement, options)` - Smart text replacement
- `insertAt(filePath, target, content, options)` - Insert content at location
- `removeLines(filePath, target, options)` - Remove lines by pattern/range
- `extractFunction(filePath, functionName, startPattern, endPattern, options)` - Extract code blocks
- `formatCode(filePath, options)` - Format and style code
- `refactorAcrossFiles(filePattern, refactorFunction, options)` - Multi-file refactoring

## Options

### Common Options
- `backup: boolean` - Create backup before editing (default: true)
- `overwrite: boolean` - Allow overwriting existing files
- `keepBackup: boolean` - Keep backup files after successful edit
- `validator: function` - Validation function for content changes

### Search Options
- `ignore: string[]` - Patterns to ignore (default: node_modules, .git, dist, build)
- `dot: boolean` - Include dotfiles (default: false)

### Edit Options
- `strict: boolean` - Fail if pattern not found
- `replaceAll: boolean` - Replace all occurrences
- `matchIndentation: boolean` - Match surrounding indentation
- `before: boolean` - Insert before pattern instead of after

## Error Handling

All methods include comprehensive error handling with:
- Automatic backup and restore on failure
- Detailed error messages with context
- Validation of inputs and outputs
- Safe file operations with permission checks

## Integration with Claude Code

These utilities can be integrated into your development workflow:

1. **File Discovery**: Use with Claude Code's Read tool for targeted file analysis
2. **Batch Operations**: Process multiple files efficiently
3. **Safe Editing**: All edits include backup and validation
4. **Code Quality**: Built-in formatting and style fixes
5. **Search Capabilities**: Advanced content search with context