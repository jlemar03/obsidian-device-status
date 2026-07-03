import { App, TFile } from 'obsidian';
import path from 'path';
import {
	getChangedMarkdownFiles,
	getGitContext,
	getHeadFileContent,
	getRepoRelativePath,
	type GitContext,
} from './git';

export interface DetailRow {
	label: string;
	value: string;
	actionLabel?: string;
	onClick?: () => void;
}

export interface DetailViewData {
	title: string;
	rows: DetailRow[];
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
	const stat = await app.vault.adapter.stat(activeFile.path);
	const gitContext = await getGitContext(app);
	const addedBytes = await getAddedBytesForFile(app, gitContext, activeFile, content);

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
				value: formatBytes(stat?.size ?? getByteSize(content)),
			},
		],
	};
}

export async function buildVaultDetails(
	app: App,
	showAffectedFiles: (files: string[]) => void,
): Promise<DetailViewData> {
	const files = app.vault.getMarkdownFiles();
	const gitContext = await getGitContext(app);

	let totalWords = 0;
	let totalBytes = 0;

	for (const file of files) {
		const [content, stat] = await Promise.all([
			app.vault.read(file),
			app.vault.adapter.stat(file.path),
		]);

		totalWords += countWords(content);
		totalBytes += stat?.size ?? getByteSize(content);
	}

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

	const affectedCount = changedFiles.files.length;
	const affectedValue = changedFiles.error
		? changedFiles.error
		: formatNumber(affectedCount);

	return {
		title: 'Vault details',
		rows: [
			{ label: 'Word count', value: formatNumber(totalWords) },
			{ label: 'File/page count', value: formatNumber(files.length) },
			{
				label: 'Total memory added',
				value: formatBytes(totalAddedBytes, changedFiles.error ?? undefined),
			},
			{ label: 'Total memory used', value: formatBytes(totalBytes) },
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

	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatNumber(value: number): string {
	return new Intl.NumberFormat().format(value);
