import { App, TFile, TFolder } from 'obsidian';
import { ScribeFlowPluginSettings } from '../types';
import { DashboardEntry, ParsedTemplate } from '../types/dashboard';
import { TemplateAnalyzer } from './TemplateAnalyzer';
import { logger } from './LoggingService';

export class DashboardParser {
	private app: App;
	private settings: ScribeFlowPluginSettings;
	private templateAnalyzer: TemplateAnalyzer;
	private parsedTemplates: Map<string, ParsedTemplate>;
	private vocabularyCache: Map<string, { uniqueWordCount: number; uniqueWordPercentage: number }>;

	constructor(app: App, settings: ScribeFlowPluginSettings) {
		this.app = app;
		this.settings = settings;
		this.templateAnalyzer = new TemplateAnalyzer();
		this.parsedTemplates = new Map();
		this.vocabularyCache = new Map();
	}

	/**
	 * Parse all journal entries from configured folders and templates
	 */
	async parseAllEntries(): Promise<DashboardEntry[]> {
		// Analyze selected templates first
		await this.analyzeSelectedTemplates();

		// Get all markdown files from selected folders
		const files = await this.getFilesFromFolders();

		// Parse each file
		const entries: DashboardEntry[] = [];

		for (const file of files) {
			try {
				const fileEntries = await this.parseJournalFile(file);
				if (fileEntries.length > 0) {
					entries.push(...fileEntries);
				}
			} catch (error) {
				logger.warn('DashboardParser', 'parseAllEntries', `Failed to parse journal file ${file.path}`, {
					error: error.message,
					filePath: file.path,
				});
			}
		}

		return entries;
	}

	/**
	 * Get parsed templates for use in statistics calculations
	 */
	getParsedTemplates(): ParsedTemplate[] {
		return Array.from(this.parsedTemplates.values());
	}

	/**
	 * Analyze all selected templates to understand their structure
	 */
	private async analyzeSelectedTemplates(): Promise<void> {
		this.parsedTemplates.clear();

		for (const templateId of this.settings.dashboardSettings.parseTemplates) {
			const template = this.settings.templates.find(t => t.id === templateId);
			if (template && this.templateAnalyzer.hasRequiredPlaceholders(template)) {
				const parsedTemplate = this.templateAnalyzer.analyzeTemplate(template);
				this.parsedTemplates.set(templateId, parsedTemplate);
			}
		}
	}

	/**
	 * Get all markdown files from configured scan folders
	 */
	private async getFilesFromFolders(): Promise<TFile[]> {
		const files: TFile[] = [];

		for (const folderPath of this.settings.dashboardSettings.scanFolders) {
			const folder = this.app.vault.getAbstractFileByPath(folderPath);
			if (folder instanceof TFolder) {
				const folderFiles = this.getMarkdownFilesFromFolder(folder);
				files.push(...folderFiles);
			}
		}

		return files;
	}

	/**
	 * Recursively get all markdown files from a folder
	 */
	private getMarkdownFilesFromFolder(folder: TFolder): TFile[] {
		const files: TFile[] = [];

		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === 'md') {
				files.push(child);
			} else if (child instanceof TFolder) {
				// Recursively scan subfolders
				const subFiles = this.getMarkdownFilesFromFolder(child);
				files.push(...subFiles);
			}
		}

		return files;
	}

	/**
	 * Parse a single journal file to extract dashboard entry data
	 */
	private async parseJournalFile(file: TFile): Promise<DashboardEntry[]> {
		const content = await this.app.vault.read(file);

		// Check if this file contains a journal entry callout
		if (!this.containsJournalEntry(content)) {
			return [];
		}

		// Extract all journal callout blocks from the file
		const calloutBlocks = this.extractAllJournalCalloutBlocks(content);
		const entries: DashboardEntry[] = [];

		// Process each callout block
		for (const calloutBlock of calloutBlocks) {
			// Try to match against each parsed template
			for (const [templateId, parsedTemplate] of this.parsedTemplates) {
				const entry = this.tryParseCalloutBlock(file, calloutBlock, parsedTemplate);
				if (entry) {
					entries.push(entry);
					break; // Found a match for this callout, move to next
				}
			}
		}

		return entries;
	}

	/**
	 * Check if content contains a journal entry callout
	 */
	private containsJournalEntry(content: string): boolean {
		const calloutPattern = new RegExp(`> \\[!${this.settings.calloutNames.journalEntry}\\]`, 'i');
		return calloutPattern.test(content);
	}

	/**
	 * Try to parse file content using a specific template structure (legacy method)
	 */
	private tryParseWithTemplate(file: TFile, content: string, template: ParsedTemplate): DashboardEntry | null {
		try {
			// Extract journal entry callout block
			const journalBlock = this.extractJournalCalloutBlock(content);
			if (!journalBlock) {
				return null;
			}

			return this.tryParseCalloutBlock(file, journalBlock, template);
		} catch (error) {
			logger.warn(
				'DashboardParser',
				'tryParseWithTemplate',
				`Failed to parse ${file.path} with template ${template.name}`,
				{ error: error.message, filePath: file.path, templateName: template.name }
			);
			return null;
		}
	}

	/**
	 * Try to parse a specific callout block using a template structure
	 */
	private tryParseCalloutBlock(file: TFile, calloutBlock: string, template: ParsedTemplate): DashboardEntry | null {
		try {
			// Extract date from the callout header
			const date = this.extractDateFromCallout(calloutBlock);
			if (!date) {
				return null;
			}

			// Extract journal content (text between callout start and dream diary callout)
			const journalContent = this.extractJournalContent(calloutBlock);

			// Calculate metrics
			const wordCount = this.calculateWordCount(journalContent);
			const imageCount = this.countImages(calloutBlock);
			const preview = this.generatePreview(journalContent);
			const tags = this.extractTags(journalContent);
			const vocabularyRichness = this.calculateVocabularyRichness(journalContent);

			// Generate title with date for multiple entries per file
			const title = this.generateTitleWithDate(file, date);

			return {
				date,
				title,
				preview,
				fullContent: journalContent,
				wordCount,
				imageCount,
				filePath: file.path,
				tags,
				uniqueWordCount: vocabularyRichness.uniqueWordCount,
				uniqueWordPercentage: vocabularyRichness.uniqueWordPercentage,
			};
		} catch (error) {
			logger.warn('DashboardParser', 'tryParseCalloutBlock', `Failed to parse callout block from ${file.path}`, {
				error: error.message,
				filePath: file.path,
			});
			return null;
		}
	}

	/**
	 * Extract all journal entry callout blocks from file content
	 */
	private extractAllJournalCalloutBlocks(content: string): string[] {
		const calloutName = this.settings.calloutNames.journalEntry;
		const startPattern = new RegExp(`> \\[!${calloutName}\\].*`, 'i');
		const lines = content.split('\n');
		const calloutBlocks: string[] = [];

		let i = 0;
		while (i < lines.length) {
			// Find start of a journal callout
			if (startPattern.test(lines[i])) {
				const startIndex = i;
				let endIndex = lines.length;

				// Find end of this callout (first line not starting with '>')
				for (let j = startIndex + 1; j < lines.length; j++) {
					if (!lines[j].startsWith('>')) {
						endIndex = j;
						break;
					}
				}

				const calloutBlock = lines.slice(startIndex, endIndex).join('\n');
				calloutBlocks.push(calloutBlock);

				// Continue searching after this callout
				i = endIndex;
			} else {
				i++;
			}
		}

		return calloutBlocks;
	}

	/**
	 * Extract the journal entry callout block from file content (legacy method for single callout)
	 */
	private extractJournalCalloutBlock(content: string): string | null {
		const blocks = this.extractAllJournalCalloutBlocks(content);
		return blocks.length > 0 ? blocks[0] : null;
	}

	/**
	 * Extract date from journal callout header
	 */
	private extractDateFromCallout(calloutBlock: string): string | null {
		// Look for date pattern in the callout header
		const headerLine = calloutBlock.split('\n')[0];

		// Try YYYY-MM-DD format first
		const isoPattern = /(\d{4}-\d{2}-\d{2})/;
		const isoMatch = headerLine.match(isoPattern);
		if (isoMatch) {
			return isoMatch[1];
		}

		// Try to extract from compact date in the second line (^20250114)
		const lines = calloutBlock.split('\n');
		if (lines.length > 1) {
			const compactPattern = /\^(\d{8})/;
			const compactMatch = lines[1].match(compactPattern);
			if (compactMatch) {
				const compactDate = compactMatch[1];
				// Convert YYYYMMDD to YYYY-MM-DD
				return `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`;
			}
		}

		// Try to parse natural language dates like "Tuesday, January 14"
		const textDatePattern =
			/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}/i;
		const textMatch = headerLine.match(textDatePattern);
		if (textMatch) {
			try {
				// Try to parse the date and convert to YYYY-MM-DD
				const dateStr = textMatch[0];
				const currentYear = new Date().getFullYear();
				const parsedDate = new Date(`${dateStr} ${currentYear}`);
				if (!isNaN(parsedDate.getTime())) {
					return parsedDate.toISOString().split('T')[0];
				}
			} catch (e) {
				// Fall through to null
			}
		}

		return null;
	}

	/**
	 * Extract all content (journal + dream content) from callout block
	 */
	private extractJournalContent(calloutBlock: string): string {
		const lines = calloutBlock.split('\n');
		const contentLines: string[] = [];
		let inMetricsSection = false;

		for (const line of lines) {
			// Skip the header line and block ID line
			if (line.includes('[!journal-entry]') || line.match(/>\s*\^[\w\d-]+\s*$/)) {
				continue;
			}

			// Check if we're entering a dream-metrics section
			if (line.includes('[!dream-metrics]')) {
				inMetricsSection = true;
				continue;
			}

			// Check if we're exiting the metrics section (new callout or non-callout line)
			if (inMetricsSection) {
				// If we hit another callout or non-callout line, exit metrics section
				if (line.includes('[!') && !line.includes('[!dream-metrics]')) {
					inMetricsSection = false;
				} else if (!line.startsWith('>')) {
					inMetricsSection = false;
				} else {
					// Still in metrics section, skip this line
					continue;
				}
			}

			// Process any line that starts with '>' (callout content)
			if (line.startsWith('>') && !inMetricsSection) {
				// Remove all '> ' prefixes to handle nested callouts
				let cleanLine = line.replace(/^>+\s*/, '');

				// Handle dream-diary callouts specially to extract titles
				if (cleanLine.startsWith('[!dream-diary]')) {
					const dreamTitle = this.extractDreamTitle(cleanLine);
					if (dreamTitle) {
						contentLines.push(''); // Add empty line before dream title
						contentLines.push(`Dream: ${dreamTitle}`);
						contentLines.push(''); // Add empty line after dream title
					}
					continue;
				}

				// Skip other callout headers (like [!journal-page])
				if (cleanLine.startsWith('[!')) {
					continue;
				}

				// Handle empty lines - preserve them as paragraph breaks
				if (!cleanLine) {
					contentLines.push(''); // Keep empty lines for paragraph breaks
					continue;
				}

				// Clean the line content
				cleanLine = this.cleanLineContent(cleanLine);

				if (cleanLine) {
					contentLines.push(cleanLine);
				}
			}
		}

		// Join lines preserving paragraph breaks
		// Convert empty lines to double line breaks for paragraph separation
		let result = '';
		for (let i = 0; i < contentLines.length; i++) {
			const line = contentLines[i];
			const nextLine = contentLines[i + 1];

			if (line === '') {
				// Empty line - check if next line is also empty to avoid triple line breaks
				if (nextLine !== '') {
					result += '\n\n';
				}
			} else {
				// Non-empty line
				result += line;
				// Add space if next line exists and is not empty
				if (nextLine !== undefined && nextLine !== '') {
					result += ' ';
				}
			}
		}

		return result.trim();
	}

	/**
	 * Clean line content by removing embeds and converting links to plain text
	 */
	private cleanLineContent(line: string): string {
		let cleaned = line;

		// Remove embeds: ![[image]] → (removed entirely)
		cleaned = cleaned.replace(/!\[\[[^\]]+\]\]/g, '');

		// Convert wikilinks: [[link|text]] → text, [[link]] → link
		cleaned = cleaned.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (_match, link, _pipe, text) => {
			return text || link;
		});

		// Convert markdown links: [text](url) → text
		cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

		// Strip markdown headings: ### text → text
		cleaned = cleaned.replace(/^#{1,6}\s+/, '');

		// Convert HTML line breaks to actual line breaks
		cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');

		// Strip underline tags: <u>text</u> → text
		cleaned = cleaned.replace(/<\/?u>/gi, '');

		// Strip span tags but keep content: <span class="...">text</span> → text
		cleaned = cleaned.replace(/<span[^>]*>(.*?)<\/span>/gi, '$1');

		// Strip any remaining callout syntax that might have slipped through
		cleaned = cleaned.replace(/>\s*\[![^\]]*\]\s*/g, '');

		// Clean up multiple spaces but preserve line breaks
		cleaned = cleaned.replace(/[ \t]+/g, ' ').trim();

		return cleaned;
	}

	/**
	 * Count images in the callout block
	 */
	private countImages(calloutBlock: string): number {
		const imagePattern = /!\[\[[^\]]+\]\]/g;
		const matches = calloutBlock.match(imagePattern);
		return matches ? matches.length : 0;
	}

	/**
	 * Calculate word count from text
	 */
	private calculateWordCount(text: string): number {
		if (!text || typeof text !== 'string') {
			return 0;
		}

		const words = text
			.trim()
			.split(/\s+/)
			.filter(word => word.length > 0);
		return words.length;
	}

	/**
	 * Generate preview text
	 */
	private generatePreview(content: string): string {
		if (!content) {
			return '';
		}

		const words = content.trim().split(/\s+/);
		const limit = this.settings.dashboardSettings.previewWordLimit;

		if (words.length <= limit) {
			return content;
		}

		return words.slice(0, limit).join(' ') + '...';
	}

	/**
	 * Generate title from filename
	 */
	private generateTitle(file: TFile): string {
		return file.basename;
	}

	private generateTitleWithDate(file: TFile, date: string): string {
		// Format: "filename - YYYY-MM-DD" for multiple entries per file
		return `${file.basename} - ${date}`;
	}

	/**
	 * Extract dream title from dream-diary callout line
	 * Example: "[!dream-diary] Flying Over Mountains [[Dream Diary]]" -> "Flying Over Mountains"
	 */
	private extractDreamTitle(dreamCalloutLine: string): string | null {
		// Pattern to match: [!dream-diary] {title} [[link]]
		// The title is between the callout and the link
		const match = dreamCalloutLine.match(/\[!dream-diary\]\s*([^[\]]+?)(?:\s*\[\[|$)/i);

		if (match && match[1]) {
			return match[1].trim();
		}

		// Fallback: if no link, everything after the callout is the title
		const fallbackMatch = dreamCalloutLine.match(/\[!dream-diary\]\s*(.+)/i);
		if (fallbackMatch && fallbackMatch[1]) {
			return fallbackMatch[1].trim();
		}

		return null;
	}

	/**
	 * Calculate vocabulary richness (unique words analysis) with caching
	 */
	private calculateVocabularyRichness(content: string): { uniqueWordCount: number; uniqueWordPercentage: number } {
		if (!content || typeof content !== 'string') {
			return { uniqueWordCount: 0, uniqueWordPercentage: 0 };
		}

		// Create a simple hash of the content for caching
		const contentHash = this.hashContent(content);
		
		// Check cache first
		const cachedResult = this.vocabularyCache.get(contentHash);
		if (cachedResult) {
			return cachedResult;
		}

		// Tokenize and normalize words
		const words = this.tokenizeWords(content);
		const totalWords = words.length;
		
		if (totalWords === 0) {
			const result = { uniqueWordCount: 0, uniqueWordPercentage: 0 };
			this.vocabularyCache.set(contentHash, result);
			return result;
		}

		// Count unique words (case-insensitive)
		const uniqueWords = new Set(words.map(word => word.toLowerCase()));
		const uniqueWordCount = uniqueWords.size;
		
		// Calculate percentage
		const uniqueWordPercentage = Math.round((uniqueWordCount / totalWords) * 100);

		const result = { uniqueWordCount, uniqueWordPercentage };
		
		// Cache the result
		this.vocabularyCache.set(contentHash, result);
		
		// Implement simple LRU eviction if cache gets too large
		if (this.vocabularyCache.size > 1000) {
			const firstKey = this.vocabularyCache.keys().next().value;
			this.vocabularyCache.delete(firstKey);
		}

		return result;
	}

	/**
	 * Create a simple hash of content for caching
	 */
	private hashContent(content: string): string {
		let hash = 0;
		for (let i = 0; i < content.length; i++) {
			const char = content.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return hash.toString();
	}

	/**
	 * Tokenize text into normalized words for vocabulary analysis
	 */
	private tokenizeWords(text: string): string[] {
		// Remove markdown formatting
		let cleaned = text
			.replace(/\*\*([^*]+)\*\*/g, '$1') // **bold** → bold
			.replace(/\*([^*]+)\*/g, '$1')     // *italic* → italic
			.replace(/`([^`]+)`/g, '$1')      // `code` → code
			.replace(/~~([^~]+)~~/g, '$1')    // ~~strikethrough~~ → strikethrough
			.replace(/==([^=]+)==/g, '$1');   // ==highlight== → highlight

		// Remove URLs
		cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
		
		// Remove email addresses
		cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');

		// Split on word boundaries and clean each word
		const words: string[] = [];
		const wordPattern = /\b[\w''-]+\b/g;
		let match;

		while ((match = wordPattern.exec(cleaned)) !== null) {
			let word = match[0];
			
			// Skip if word is just numbers or single characters
			if (/^\d+$/.test(word) || word.length < 2) {
				continue;
			}

			// Handle contractions - keep as single unit but normalize
			// don't → dont, I'll → ill, etc.
			word = word.replace(/'/g, '').replace(/-/g, '');
			
			// Remove possessive endings
			word = word.replace(/s$/, '');
			
			// Skip if word became too short after cleaning
			if (word.length < 2) {
				continue;
			}

			words.push(word);
		}

		return words;
	}

	/**
	 * Extract inline tags from content (#tagname patterns)
	 */
	private extractTags(content: string): string[] {
		if (!content || typeof content !== 'string') {
			return [];
		}

		const tags = new Set<string>();
		
		// Pattern to match #tagname (including nested tags like #work/project)
		// Must start with # followed by alphanumeric, underscore, dash, or forward slash
		// Stops at whitespace, punctuation (except /, -, _), or end of string
		const tagPattern = /#([a-zA-Z0-9_/-]+)/g;
		
		let match;
		while ((match = tagPattern.exec(content)) !== null) {
			const tag = match[1];
			
			// Skip if this looks like a URL fragment (contains :// before the #)
			const beforeHash = content.substring(0, match.index);
			if (beforeHash.match(/https?:\/\/[^\s]*$/)) {
				continue;
			}
			
			// Skip if tag is just numbers (like #123 which might be issue references)
			if (/^\d+$/.test(tag)) {
				continue;
			}
			
			// Add tag to set (removes duplicates automatically)
			tags.add(tag);
		}
		
		// Convert to sorted array for consistent ordering
		return Array.from(tags).sort();
	}

	/**
	 * Update settings reference
	 */
	updateSettings(settings: ScribeFlowPluginSettings): void {
		this.settings = settings;
	}
}
