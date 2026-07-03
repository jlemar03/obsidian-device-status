import { App, TFile } from 'obsidian';
import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const MARKDOWN_GLOB = ':(glob)**/*.md';

export interface GitContext {
	repoRoot: string | null;
	vaultBasePath: string | null;
	error: string | null;
}

export interface ChangedFileSummary {
	files: string[];
	error: string | null;
}

export function getVaultBasePath(app: App): string | null {
	const adapter = app.vault.adapter as { getBasePath?: () => string };

	if (typeof adapter.getBasePath !== 'function') {
		return null;
	}

	return adapter.getBasePath();
}

export async function getGitContext(app: App): Promise<GitContext> {
	const vaultBasePath = getVaultBasePath(app);

	if (!vaultBasePath) {
		return {
			repoRoot: null,
			vaultBasePath: null,
			error: 'Vault path is unavailable in this environment.',
		};
	}

	try {
		const { stdout } = await execFileAsync(
			'git',
			['rev-parse', '--show-toplevel'],
			{ cwd: vaultBasePath },
		);

		return {
			repoRoot: stdout.trim(),
			vaultBasePath,
			error: null,
		};
	} catch (error) {
		return {
			repoRoot: null,
			vaultBasePath,
			error: getGitErrorMessage(error, 'Vault root is not a Git repository.'),
		};
	}
}

export function getRepoRelativePath(
	context: GitContext,
	file: TFile,
): string | null {
	if (!context.repoRoot || !context.vaultBasePath) {
		return null;
	}

	const absolutePath = path.join(context.vaultBasePath, file.path);
	const relativePath = path.relative(context.repoRoot, absolutePath);

	if (relativePath.startsWith('..')) {
		return null;
	}

	return relativePath;
}

export async function getHeadFileContent(
	context: GitContext,
	repoRelativePath: string,
): Promise<string | null> {
	if (!context.repoRoot) {
		return null;
	}

	try {
		const { stdout } = await execFileAsync(
			'git',
			['show', `HEAD:${repoRelativePath}`],
			{ cwd: context.repoRoot, maxBuffer: 1024 * 1024 * 10 },
		);

		return stdout;
	} catch {
		return null;
	}
}

export async function getChangedMarkdownFiles(
	context: GitContext,
): Promise<ChangedFileSummary> {
	if (!context.repoRoot) {
		return {
			files: [],
			error: context.error ?? 'Vault root is not a Git repository.',
		};
	}

	try {
		const tracked = await execFileAsync(
			'git',
			['diff', '--name-only', 'HEAD', '--', MARKDOWN_GLOB],
			{ cwd: context.repoRoot },
		);
		const untracked = await execFileAsync(
			'git',
			['ls-files', '--others', '--exclude-standard', '--', MARKDOWN_GLOB],
			{ cwd: context.repoRoot },
		);

		const files = new Set<string>();

		for (const file of tracked.stdout.split('\n')) {
			const trimmed = file.trim();
			if (trimmed) {
				files.add(trimmed);
			}
		}

		for (const file of untracked.stdout.split('\n')) {
			const trimmed = file.trim();
			if (trimmed) {
				files.add(trimmed);
			}
		}

		return {
			files: Array.from(files).sort(),
			error: null,
		};
	} catch (error) {
		return {
			files: [],
			error: getGitErrorMessage(
				error,
				'Git change detection failed for the vault repository.',
			),
		};
	}
}

function getGitErrorMessage(error: unknown, fallback: string): string {
	if (error && typeof error === 'object' && 'stderr' in error) {
		const stderr = error.stderr;
		if (typeof stderr === 'string') {
			const trimmed = stderr.trim();
			if (trimmed) {
				return trimmed;
			}
		}
	}

	if (error instanceof Error && error.message.trim()) {
		return error.message.trim();
	}

	return fallback;
}
