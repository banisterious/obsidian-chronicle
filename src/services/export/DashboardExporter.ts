import { App, Notice } from 'obsidian';
import { DashboardEntry, DashboardStatistics, DateFilter } from '../../types/dashboard';
import { ExportFormatters } from './ExportFormatters';
import { DashboardExportFormat, DashboardExportData, ExportOptions, ExportResult } from './types';
import { logger } from '../LoggingService';

export class DashboardExporter {
	private app: App;
	private formatters: ExportFormatters;

	constructor(app: App) {
		this.app = app;
		this.formatters = new ExportFormatters();
	}

	async exportDashboardData(
		entries: DashboardEntry[],
		statistics: DashboardStatistics,
		filter: DateFilter,
		searchQuery: string,
		options: ExportOptions
	): Promise<ExportResult> {
		try {
			const exportData: DashboardExportData = this.prepareExportData(entries, statistics, filter, searchQuery);

			switch (options.format) {
				case DashboardExportFormat.MARKDOWN_TABLE:
					return await this.exportAsMarkdownTable(exportData, options);
				case DashboardExportFormat.CSV:
					return await this.exportAsCSV(exportData, options);
				case DashboardExportFormat.JSON:
					return await this.exportAsJSON(exportData, options);
				default:
					throw new Error(`Unsupported export format: ${options.format}`);
			}
		} catch (error) {
			logger.error('DashboardExporter', 'exportDashboardData', 'Dashboard export failed', {
				format: options.format,
				error: error.message,
				entriesCount: entries.length,
				filter,
				searchQuery,
			});
			return {
				success: false,
				message: `Export failed: ${error.message}`,
			};
		}
	}

	private prepareExportData(
		entries: DashboardEntry[],
		statistics: DashboardStatistics,
		filter: DateFilter,
		searchQuery: string
	): DashboardExportData {
		return {
			entries,
			statistics,
			metadata: {
				exportDate: new Date().toISOString(),
				filter,
				searchQuery: searchQuery || undefined,
				totalEntries: entries.length,
			},
		};
	}

	private async exportAsMarkdownTable(data: DashboardExportData, options: ExportOptions): Promise<ExportResult> {
		const content = this.formatters.formatAsMarkdownTable(data);

		if (options.destination === 'clipboard') {
			await navigator.clipboard.writeText(content);
			new Notice('Dashboard exported to clipboard as Markdown table');
			return {
				success: true,
				message: 'Exported to clipboard as Markdown table',
				data: content,
			};
		} else {
			const filename = this.generateFilename('markdown-table', 'md');
			await this.saveToFile(content, filename);
			return {
				success: true,
				message: `Exported to ${filename}`,
				filePath: filename,
			};
		}
	}

	private async exportAsCSV(data: DashboardExportData, options: ExportOptions): Promise<ExportResult> {
		const content = this.formatters.formatAsCSV(data);
		const filename = options.filename || this.generateFilename('dashboard-export', 'csv');

		await this.saveToFile(content, filename);
		new Notice(`Dashboard exported to ${filename}`);

		return {
			success: true,
			message: `Exported to ${filename}`,
			filePath: filename,
		};
	}

	private async exportAsJSON(data: DashboardExportData, options: ExportOptions): Promise<ExportResult> {
		const content = this.formatters.formatAsJSON(data);
		const filename = options.filename || this.generateFilename('dashboard-export', 'json');

		await this.saveToFile(content, filename);
		new Notice(`Dashboard exported to ${filename}`);

		return {
			success: true,
			message: `Exported to ${filename}`,
			filePath: filename,
		};
	}

	private async saveToFile(content: string, filename: string): Promise<void> {
		try {
			// Create a blob and download link
			const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
			const url = URL.createObjectURL(blob);

			// Create temporary download link
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			link.classList.add('sfp-hidden');

			// Trigger download
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);

			// Clean up
			URL.revokeObjectURL(url);
		} catch (error) {
			logger.error('DashboardExporter', 'saveToFile', 'File save failed', {
				error: error.message,
				filename,
			});
			throw new Error(`Failed to save file: ${error.message}`);
		}
	}

	private generateFilename(prefix: string, extension: string): string {
		const now = new Date();
		const dateStr =
			now.getFullYear().toString() +
			(now.getMonth() + 1).toString().padStart(2, '0') +
			now.getDate().toString().padStart(2, '0'); // YYYYMMDD
		const timeStr =
			now.getHours().toString().padStart(2, '0') +
			now.getMinutes().toString().padStart(2, '0') +
			now.getSeconds().toString().padStart(2, '0'); // HHMMSS
		return `${prefix}-${dateStr}-${timeStr}.${extension}`;
	}
}
