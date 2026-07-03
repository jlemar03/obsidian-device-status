import { App, TFile } from 'obsidian';
import path from 'path';
import {
	getChangedMarkdownFiles,
	getGitContext,
	getHeadFileContent,
	getRepoRelativePath,
	type GitContext,
} from './git';
import { getFreeBytesForPath } from './storage';

export interface MemoryBar {
	value: string;
	summary: string;
	percentage: number;
	primaryLabel: string;
	primaryValue: string;
	secondaryLabel: string;
	secondaryValue: string;
}

export interface DetailRow {
	label: string;
	value: string;
	bar?: MemoryBar;
	actionLabel?: string;
	onClick?: () => void;
}

export interface DetailViewData {
	title: string;
	rows: DetailRow[];
}

interface VaultTotals {
	totalWords: number;
	totalBytes: number;
	fileCount: number;
}

export async function buildPageDetails(app: App): Promise<DetailViewData> {
	const activeFile = app.workspace.getActiveFile();

	if (!activeFile) {
		return {
			title: 'Page details',
			rows: [{ label: 'Status', value: 'No active markdown file.' }],
		};
	}

	const content = await app.vault.read(activeFile);
	const currentBytes = getByteSize(content);
	const [gitContext, vaultTotals] = await Promise.all([
		getGitContext(app),
		getVaultTotals(app),
	]);
	const addedBytes = await getAddedBytesForFile(app, gitContext, activeFile, content);
	const pageShareBar = buildRatioBar(
		currentBytes,
		vaultTotals.totalBytes,
		'Current page',
		formatBytes(currentBytes),
		'Vault total',
		formatBytes(vaultTotals.totalBytes),
		'of vault memory',
	);

	return {
		title: 'Page details',
		rows: [
			{ label: 'Page', value: activeFile.path },
			{ label: 'Word count', value: formatNumber(countWords(content)) },
			{ label: 'Character count', value: formatNumber(content.length) },
			{
				label: 'Added memory',
				value: formatBytes(addedBytes.bytes, addedBytes.error),
			},
			{
				label: 'Total memory',
				value: formatBytes(currentBytes),
			},
			{
				label: 'Share of vault memory',
				value: pageShareBar.value,
				bar: pageShareBar,
			},
		],
	};
}

export async function buildVaultDetails(
	app: App,
	showAffectedFiles: (files: string[]) => void,
): Promise<DetailViewData> {
	const [vaultTotals, gitContext] = await Promise.all([
		getVaultTotals(app),
		getGitContext(app),
	]);

	const changedFiles = await getChangedMarkdownFiles(gitContext);
	let totalAddedBytes = 0;

	if (!changedFiles.error) {
		for (const repoRelativePath of changedFiles.files) {
			totalAddedBytes += await getAddedBytesForVaultPath(
				app,
				gitContext,
				repoRelativePath,
			);
		}
	}

	const storageSnapshot = await getFreeBytesForPath(gitContext.vaultBasePath);
	const storageBar = storageSnapshot.error
		? undefined
		: buildRatioBar(
				vaultTotals.totalBytes,
				vaultTotals.totalBytes + storageSnapshot.freeBytes,
				'Vault used',
				formatBytes(vaultTotals.totalBytes),
				'Free on device',
				formatBytes(storageSnapshot.freeBytes),
				'of vault + free device space',
			);
	const affectedCount = changedFiles.files.length;
	const affectedValue = changedFiles.error
		? changedFiles.error
		: formatNumber(affectedCount);

	return {
		title: 'Vault details',
		rows: [
			{ label: 'Word count', value: formatNumber(vaultTotals.totalWords) },
			{ label: 'File/page count', value: formatNumber(vaultTotals.fileCount) },
			{
				label: 'Total memory added',
				value: formatBytes(totalAddedBytes, changedFiles.error ?? undefined),
			},
			{ label: 'Total memory used', value: formatBytes(vaultTotals.totalBytes) },
			{
				label: 'Vault vs free device space',
				value: storageBar?.value ?? storageSnapshot.error ?? 'Unavailable',
				bar: storageBar,
			},
			{
				label: 'Files/pages affected since last commit',
				value: affectedValue,
				actionLabel: affectedCount > 0 ? 'Show list' : undefined,
				onClick:
					affectedCount > 0
						? () => showAffectedFiles(changedFiles.files)
						: undefined,
			},
		],
	};
}

async function getVaultTotals(app: App): Promise<VaultTotals> {
	const files = app.vault.getMarkdownFiles();
	let totalWords = 0;
	let totalBytes = 0;

	for (const file of files) {
		const content = await app.vault.read(file);
		totalWords += countWords(content);
		totalBytes += getByteSize(content);
	}

	return {
		totalWords,
		totalBytes,
		fileCount: files.length,
	};
}

function buildRatioBar(
	numerator: number,
	denominator: number,
	primaryLabel: string,
	primaryValue: string,
	secondaryLabel: string,
	secondaryValue: string,
	summary: string,
): MemoryBar {
	const percentage = denominator > 0 ? (numerator / denominator) * 100 : 0;

	return {
		value: formatPercent(percentage),
		summary,
		percentage,
		primaryLabel,
		primaryValue,
		secondaryLabel,
		secondaryValue,
	};
}

function countWords(content: string): number {
	const trimmed = content.trim();

	if (!trimmed) {
		return 0;
	}

	return trimmed.split(/\s+/u).length;
}

function getByteSize(content: string): number {
	return new TextEncoder().encode(content).length;
}

async function getAddedBytesForFile(
	app: App,
	gitContext: GitContext,
	file: TFile,
	currentContent: string,
): Promise<{ bytes: number; error?: string }> {
	const repoRelativePath = getRepoRelativePath(gitContext, file);

	if (!repoRelativePath) {
		return {
			bytes: 0,
			error: gitContext.error ?? 'This page is outside the Git repository.',
		};
	}

	const headContent = await getHeadFileContent(gitContext, repoRelativePath);
	const currentBytes = getByteSize(currentContent);

	if (headContent === null) {
		return { bytes: currentBytes };
	}

	return {
		bytes: Math.max(currentBytes - getByteSize(headContent), 0),
	};
}

async function getAddedBytesForVaultPath(
	app: App,
	gitContext: GitContext,
	repoRelativePath: string,
): Promise<number> {
	if (!gitContext.vaultBasePath || !gitContext.repoRoot) {
		return 0;
	}

	const absolutePath = path.join(gitContext.repoRoot, repoRelativePath);
	const vaultRelativePath = path.relative(gitContext.vaultBasePath, absolutePath);
	const targetFile = app.vault.getAbstractFileByPath(vaultRelativePath);
	const headContent = await getHeadFileContent(gitContext, repoRelativePath);

	if (!(targetFile instanceof TFile)) {
		return 0;
	}

	const currentContent = await app.vault.read(targetFile);
	const currentBytes = getByteSize(currentContent);

	if (headContent === null) {
		return currentBytes;
	}

	return Math.max(currentBytes - getByteSize(headContent), 0);
}

function formatBytes(bytes: number, fallback?: string): string {
	if (fallback) {
		return fallback;
	}

	if (bytes < 1024) {
		return `${bytes} B`;
	}

	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}

	if (bytes < 1024 * 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}

	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatNumber(value: number): string {
	return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number): string {
	return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}
