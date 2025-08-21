import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

/**
 * Advanced File Finding and Editing Utilities
 * Provides Claude Code-like capabilities for file operations
 */

export default class FileUtilities {
    constructor(rootPath = process.cwd()) {
        this.rootPath = rootPath;
    }

    /**
     * Advanced file search with pattern matching
     */
    async findFiles(pattern, options = {}) {
        const defaultOptions = {
            ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
            dot: false,
            ...options
        };

        try {
            const files = await glob(pattern, {
                cwd: this.rootPath,
                ignore: defaultOptions.ignore,
                dot: defaultOptions.dot,
                absolute: true
            });

            return files.map(file => ({
                path: file,
                relativePath: path.relative(this.rootPath, file),
                basename: path.basename(file),
                ext: path.extname(file)
            }));
        } catch (error) {
            throw new Error(`File search failed: ${error.message}`);
        }
    }

    /**
     * Content-based search across files
     */
    async searchInFiles(searchPattern, filePattern = '**/*', options = {}) {
        const files = await this.findFiles(filePattern, options);
        const results = [];

        for (const file of files) {
            try {
                const content = await fs.readFile(file.path, 'utf-8');
                const lines = content.split('\n');
                const matches = [];

                lines.forEach((line, index) => {
                    if (line.includes(searchPattern) || 
                        (searchPattern instanceof RegExp && searchPattern.test(line))) {
                        matches.push({
                            line: index + 1,
                            content: line.trim(),
                            context: this._getContext(lines, index, 2)
                        });
                    }
                });

                if (matches.length > 0) {
                    results.push({
                        file: file.relativePath,
                        fullPath: file.path,
                        matches
                    });
                }
            } catch (error) {
                // Skip files that can't be read (binary, permissions, etc.)
                continue;
            }
        }

        return results;
    }

    /**
     * Smart file editing with backup and validation
     */
    async editFile(filePath, editFunction, options = {}) {
        const absolutePath = path.resolve(this.rootPath, filePath);
        const backupPath = `${absolutePath}.backup-${Date.now()}`;
        
        try {
            // Create backup
            if (options.backup !== false) {
                const content = await fs.readFile(absolutePath, 'utf-8');
                await fs.writeFile(backupPath, content);
            }

            // Read current content
            const originalContent = await fs.readFile(absolutePath, 'utf-8');
            
            // Apply edit function
            const newContent = await editFunction(originalContent);
            
            // Validate changes if validator provided
            if (options.validator) {
                const isValid = await options.validator(newContent, originalContent);
                if (!isValid) {
                    throw new Error('Content validation failed');
                }
            }

            // Write new content
            await fs.writeFile(absolutePath, newContent);

            // Clean up backup if successful and not requested to keep
            if (options.keepBackup !== true && options.backup !== false) {
                await fs.unlink(backupPath);
            }

            return {
                success: true,
                filePath: absolutePath,
                backupPath: options.backup !== false ? backupPath : null,
                changes: this._calculateChanges(originalContent, newContent)
            };

        } catch (error) {
            // Restore from backup if it exists
            if (await this._fileExists(backupPath)) {
                try {
                    const backupContent = await fs.readFile(backupPath, 'utf-8');
                    await fs.writeFile(absolutePath, backupContent);
                    await fs.unlink(backupPath);
                } catch (restoreError) {
                    console.error('Failed to restore from backup:', restoreError);
                }
            }
            
            throw new Error(`Edit failed: ${error.message}`);
        }
    }

    /**
     * Batch edit multiple files
     */
    async batchEdit(filePatterns, editFunction, options = {}) {
        const results = [];
        
        for (const pattern of filePatterns) {
            const files = await this.findFiles(pattern, options);
            
            for (const file of files) {
                try {
                    const result = await this.editFile(file.relativePath, editFunction, {
                        ...options,
                        backup: true // Always backup for batch operations
                    });
                    results.push({
                        ...result,
                        file: file.relativePath
                    });
                } catch (error) {
                    results.push({
                        success: false,
                        file: file.relativePath,
                        error: error.message
                    });
                }
            }
        }

        return results;
    }

    /**
     * Create file with directory structure
     */
    async createFile(filePath, content, options = {}) {
        const absolutePath = path.resolve(this.rootPath, filePath);
        const dirname = path.dirname(absolutePath);

        try {
            // Create directory structure if it doesn't exist
            await fs.mkdir(dirname, { recursive: true });

            // Check if file exists and handle accordingly
            if (await this._fileExists(absolutePath) && !options.overwrite) {
                throw new Error('File already exists and overwrite is false');
            }

            await fs.writeFile(absolutePath, content);

            return {
                success: true,
                filePath: absolutePath,
                created: true
            };
        } catch (error) {
            throw new Error(`File creation failed: ${error.message}`);
        }
    }

    /**
     * Get file statistics and metadata
     */
    async getFileInfo(filePath) {
        const absolutePath = path.resolve(this.rootPath, filePath);
        
        try {
            const stats = await fs.stat(absolutePath);
            const content = await fs.readFile(absolutePath, 'utf-8');
            
            return {
                path: absolutePath,
                relativePath: path.relative(this.rootPath, absolutePath),
                size: stats.size,
                lines: content.split('\n').length,
                modified: stats.mtime,
                created: stats.birthtime,
                isDirectory: stats.isDirectory(),
                isFile: stats.isFile(),
                extension: path.extname(absolutePath),
                encoding: this._detectEncoding(content)
            };
        } catch (error) {
            throw new Error(`Failed to get file info: ${error.message}`);
        }
    }

    // Private helper methods
    _getContext(lines, centerIndex, contextLines) {
        const start = Math.max(0, centerIndex - contextLines);
        const end = Math.min(lines.length, centerIndex + contextLines + 1);
        
        return lines.slice(start, end).map((line, index) => ({
            lineNumber: start + index + 1,
            content: line,
            isMatch: start + index === centerIndex
        }));
    }

    _calculateChanges(oldContent, newContent) {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        
        return {
            linesAdded: Math.max(0, newLines.length - oldLines.length),
            linesRemoved: Math.max(0, oldLines.length - newLines.length),
            totalLines: newLines.length,
            charactersChanged: Math.abs(newContent.length - oldContent.length)
        };
    }

    async _fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    _detectEncoding(content) {
        // Simple encoding detection
        try {
            // Try to detect if it's valid UTF-8
            Buffer.from(content, 'utf-8').toString('utf-8');
            return 'utf-8';
        } catch {
            return 'binary';
        }
    }
}

// CLI Interface (ESM)
const isMain = (() => {
    try {
        const { fileURLToPath } = require('url');
        // In ESM context require is not available; skip
        return false;
    } catch {
        // Fallback check using import.meta when executed directly
        return false;
    }
})();

if (isMain) {
    // Intentionally left inert to avoid dual-mode complexity
}
