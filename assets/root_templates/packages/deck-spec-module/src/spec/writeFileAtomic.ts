import { copyFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

type NodeStyleError = Error & {
	code?: string;
};

async function ensureParentDir(filePath: string): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
}

function makeTempFilePath(filePath: string): string {
	const stamp = `${process.pid}-${Date.now()}`;
	return path.join(
		path.dirname(filePath),
		`.${path.basename(filePath)}.${stamp}.tmp`,
	);
}

export async function writeTextFileAtomic(
	filePath: string,
	content: string,
): Promise<void> {
	await writeAtomicFile(filePath, content, "utf8");
}

export async function writeBufferFileAtomic(
	filePath: string,
	content: Uint8Array,
): Promise<void> {
	await writeAtomicFile(filePath, content);
}

async function writeAtomicFile(
	filePath: string,
	content: string | Uint8Array,
	encoding?: BufferEncoding,
): Promise<void> {
	await ensureParentDir(filePath);
	const tempPath = makeTempFilePath(filePath);

	try {
		if (typeof content === "string") {
			await writeFile(tempPath, content, encoding ?? "utf8");
		} else {
			await writeFile(tempPath, content);
		}
		await rename(tempPath, filePath);
	} finally {
		await rm(tempPath, { force: true });
	}
}

export async function writeJsonFileAtomic(
	filePath: string,
	document: unknown,
): Promise<void> {
	await writeTextFileAtomic(filePath, `${JSON.stringify(document, null, 2)}\n`);
}

export async function copyFileIfExists(
	sourcePath: string,
	destPath: string,
): Promise<boolean> {
	try {
		await ensureParentDir(destPath);
		await copyFile(sourcePath, destPath);
		return true;
	} catch (error) {
		const nodeError = error as NodeStyleError;
		if (nodeError.code === "ENOENT") {
			return false;
		}
		throw error;
	}
}

export async function removeFileIfExists(filePath: string): Promise<void> {
	await rm(filePath, { force: true });
}
