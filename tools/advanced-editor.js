import fs from 'fs/promises';
import path from 'path';
import FileUtilities from './file-utilities.js';

/**
 * Advanced Editor with Claude Code-like capabilities
 * Provides intelligent editing, refactoring, and code manipulation
 */

export default class AdvancedEditor extends FileUtilities {
    constructor(rootPath = process.cwd()) {
        super(rootPath);
        this.editorHistory = [];
    }

    /**
     * Smart string replacement with context awareness
     */
    async smartReplace(filePath, searchPattern, replacement, options = {}) {
        const editFunction = (content) => {
            const lines = content.split('\n');
            let replacements = 0;
            
            const newLines = lines.map((line, index) => {
                if (typeof searchPattern === 'string') {
                    if (line.includes(searchPattern)) {
                        replacements++;
                        return options.replaceAll ? 
                            line.replaceAll(searchPattern, replacement) :
                            line.replace(searchPattern, replacement);
                    }
                } else if (searchPattern instanceof RegExp) {
                    if (searchPattern.test(line)) {
                        replacements++;
                        return line.replace(searchPattern, replacement);
                    }
                }
                return line;
            });

            if (replacements === 0 && options.strict) {
                throw new Error(`Pattern "${searchPattern}" not found in file`);
            }

            return newLines.join('\n');
        };

        const result = await this.editFile(filePath, editFunction, options);
        return { ...result, replacements: result.changes };
    }

    /**
     * Insert content at specific line or pattern
     */
    async insertAt(filePath, target, content, options = {}) {
        const editFunction = (originalContent) => {
            const lines = originalContent.split('\n');
            let insertIndex = -1;

            if (typeof target === 'number') {
                // Insert at line number
                insertIndex = Math.max(0, Math.min(target - 1, lines.length));
            } else if (typeof target === 'string' || target instanceof RegExp) {
                // Insert after pattern match
                const lineIndex = lines.findIndex(line => 
                    typeof target === 'string' ? 
                        line.includes(target) : 
                        target.test(line)
                );
                
                if (lineIndex === -1) {
                    throw new Error(`Pattern "${target}" not found`);
                }
                
                insertIndex = options.before ? lineIndex : lineIndex + 1;
            }

            if (insertIndex === -1) {
                throw new Error('Invalid insertion target');
            }

            // Handle indentation
            let insertContent = content;
            if (options.matchIndentation && insertIndex > 0) {
                const referenceLineIndex = options.before ? insertIndex : insertIndex - 1;
                const referenceLine = lines[referenceLineIndex] || '';
                const indentation = referenceLine.match(/^\s*/)?.[0] || '';
                
                if (Array.isArray(content)) {
                    insertContent = content.map(line => indentation + line);
                } else {
                    insertContent = content.split('\n').map(line => 
                        line.trim() ? indentation + line : line
                    );
                }
            }

            // Insert content
            const contentLines = Array.isArray(insertContent) ? 
                insertContent : insertContent.split('\n');
            
            lines.splice(insertIndex, 0, ...contentLines);
            return lines.join('\n');
        };

        return this.editFile(filePath, editFunction, options);
    }

    /**
     * Remove lines matching pattern or range
     */
    async removeLines(filePath, target, options = {}) {
        const editFunction = (content) => {
            const lines = content.split('\n');
            let linesToRemove = [];

            if (Array.isArray(target) && target.length === 2) {
                // Remove range [start, end]
                const [start, end] = target;
                for (let i = start - 1; i < end && i < lines.length; i++) {
                    linesToRemove.push(i);
                }
            } else if (typeof target === 'string' || target instanceof RegExp) {
                // Remove lines matching pattern
                lines.forEach((line, index) => {
                    const matches = typeof target === 'string' ? 
                        line.includes(target) : 
                        target.test(line);
                    
                    if (matches) {
                        linesToRemove.push(index);
                        
                        // Include surrounding lines if specified
                        if (options.includeBefore) {
                            for (let i = 1; i <= options.includeBefore; i++) {
                                const beforeIndex = index - i;
                                if (beforeIndex >= 0 && !linesToRemove.includes(beforeIndex)) {
                                    linesToRemove.push(beforeIndex);
                                }
                            }
                        }
                        
                        if (options.includeAfter) {
                            for (let i = 1; i <= options.includeAfter; i++) {
                                const afterIndex = index + i;
                                if (afterIndex < lines.length && !linesToRemove.includes(afterIndex)) {
                                    linesToRemove.push(afterIndex);
                                }
                            }
                        }
                    }
                });
            }

            // Remove lines (in reverse order to maintain indices)
            linesToRemove.sort((a, b) => b - a);
            linesToRemove.forEach(index => lines.splice(index, 1));

            return lines.join('\n');
        };

        return this.editFile(filePath, editFunction, options);
    }

    /**
     * Extract and refactor code blocks
     */
    async extractFunction(filePath, functionName, startPattern, endPattern, options = {}) {
        let extractedCode = '';
        
        const editFunction = (content) => {
            const lines = content.split('\n');
            let startIndex = -1;
            let endIndex = -1;
            let braceCount = 0;

            // Find start pattern
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(startPattern)) {
                    startIndex = i;
                    break;
                }
            }

            if (startIndex === -1) {
                throw new Error(`Start pattern "${startPattern}" not found`);
            }

            // Find end pattern or matching braces
            if (endPattern) {
                for (let i = startIndex + 1; i < lines.length; i++) {
                    if (lines[i].includes(endPattern)) {
                        endIndex = i;
                        break;
                    }
                }
            } else {
                // Use brace matching
                for (let i = startIndex; i < lines.length; i++) {
                    const line = lines[i];
                    braceCount += (line.match(/\{/g) || []).length;
                    braceCount -= (line.match(/\}/g) || []).length;
                    
                    if (i > startIndex && braceCount === 0) {
                        endIndex = i;
                        break;
                    }
                }
            }

            if (endIndex === -1) {
                throw new Error('Could not find end of code block');
            }

            // Extract code
            extractedCode = lines.slice(startIndex, endIndex + 1).join('\n');

            // Replace with function call or remove
            if (options.replaceWithCall) {
                const indentation = lines[startIndex].match(/^\s*/)?.[0] || '';
                const callLine = `${indentation}${functionName}();`;
                lines.splice(startIndex, endIndex - startIndex + 1, callLine);
            } else {
                lines.splice(startIndex, endIndex - startIndex + 1);
            }

            return lines.join('\n');
        };

        const result = await this.editFile(filePath, editFunction, options);
        
        // Create extracted function if requested
        if (options.createFunction && extractedCode) {
            const functionCode = `function ${functionName}() {\n${extractedCode}\n}`;
            
            if (options.functionFile) {
                await this.insertAt(options.functionFile, options.insertLocation || 1, functionCode);
            }
        }

        return { 
            ...result, 
            extractedCode,
            functionName
        };
    }

    /**
     * Intelligent code formatting and style fixing
     */
    async formatCode(filePath, options = {}) {
        const editFunction = (content) => {
            let formatted = content;

            // Basic formatting rules
            if (options.fixIndentation !== false) {
                formatted = this._fixIndentation(formatted, options.indentSize || 2);
            }

            if (options.fixSpacing !== false) {
                formatted = this._fixSpacing(formatted);
            }

            if (options.removeTrailingSpaces !== false) {
                formatted = formatted.replace(/[ \t]+$/gm, '');
            }

            if (options.fixEmptyLines !== false) {
                formatted = formatted.replace(/\n\s*\n\s*\n/g, '\n\n');
            }

            return formatted;
        };

        return this.editFile(filePath, editFunction, options);
    }

    /**
     * Multi-file refactoring operations
     */
    async refactorAcrossFiles(filePattern, refactorFunction, options = {}) {
        const files = await this.findFiles(filePattern, options);
        const results = [];
        const changes = new Map();

        // First pass: analyze and prepare changes
        for (const file of files) {
            try {
                const content = await fs.readFile(file.path, 'utf-8');
                const analysis = await refactorFunction(content, file.relativePath, 'analyze');
                
                if (analysis && analysis.changes) {
                    changes.set(file.path, analysis.changes);
                }
            } catch (error) {
                results.push({
                    file: file.relativePath,
                    success: false,
                    error: `Analysis failed: ${error.message}`
                });
            }
        }

        // Second pass: apply changes
        for (const file of files) {
            if (!changes.has(file.path)) continue;

            try {
                const fileChanges = changes.get(file.path);
                const editFunction = (content) => refactorFunction(content, file.relativePath, 'apply', fileChanges);
                
                const result = await this.editFile(file.relativePath, editFunction, {
                    ...options,
                    backup: true
                });

                results.push({
                    file: file.relativePath,
                    success: true,
                    changes: result.changes
                });
            } catch (error) {
                results.push({
                    file: file.relativePath,
                    success: false,
                    error: error.message
                });
            }
        }

        return {
            totalFiles: files.length,
            processedFiles: results.length,
            successfulChanges: results.filter(r => r.success).length,
            results
        };
    }

    // Private helper methods
    _fixIndentation(content, indentSize = 2) {
        const lines = content.split('\n');
        let currentIndent = 0;
        const indentChar = ' '.repeat(indentSize);

        return lines.map(line => {
            const trimmed = line.trim();
            if (!trimmed) return '';

            // Adjust indent level based on brackets
            if (trimmed.includes('}') || trimmed.includes(']') || trimmed.includes(')')) {
                currentIndent = Math.max(0, currentIndent - 1);
            }

            const indentedLine = indentChar.repeat(currentIndent) + trimmed;

            if (trimmed.includes('{') || trimmed.includes('[') || trimmed.includes('(')) {
                currentIndent++;
            }

            return indentedLine;
        }).join('\n');
    }

    _fixSpacing(content) {
        return content
            .replace(/\s*([{}();,])\s*/g, '$1 ')  // Fix spacing around special chars
            .replace(/\s+/g, ' ')  // Multiple spaces to single space
            .replace(/\s*\n\s*/g, '\n');  // Clean line breaks
    }
}

// CLI intentionally removed in ESM mode to avoid dual-mode complexity
