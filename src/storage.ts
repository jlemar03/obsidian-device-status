import { promises as fs } from 'fs';

export interface StorageSpaceSnapshot {
	freeBytes: number;
	error: string | null;
}

export async function getFreeBytesForPath(
	targetPath: string | null,
): Promise<StorageSpaceSnapshot> {
	if (!targetPath) {
		return {
			freeBytes: 0,
			error: 'Vault path is unavailable in this environment.',
		};
	}

	try {
		const stats = await fs.statfs(targetPath);

		return {
			freeBytes: stats.bavail * stats.bsize,
			error: null,
		};
	} catch (error) {
		return {
			freeBytes: 0,
			error: getStorageErrorMessage(error),
		};
	}
}

function getStorageErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.trim()) {
		return error.message.trim();
	}

	return 'Free device space is unavailable.';
}
