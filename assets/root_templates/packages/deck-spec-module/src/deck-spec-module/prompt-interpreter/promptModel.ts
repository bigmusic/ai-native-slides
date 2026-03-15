const numberWordMap = new Map<string, number>([
	["three", 3],
	["four", 4],
	["five", 5],
	["six", 6],
]);

const stopWords = new Set([
	"a",
	"an",
	"and",
	"about",
	"around",
	"build",
	"create",
	"deck",
	"describe",
	"deterministic",
	"explain",
	"for",
	"from",
	"how",
	"in",
	"into",
	"of",
	"on",
	"that",
	"the",
	"this",
	"to",
	"with",
]);

const keywordPriority = [
	"canonical",
	"spec",
	"review",
	"media",
	"image",
	"build",
	"render",
	"workflow",
	"validation",
	"contract",
] as const;

export type PromptModel = {
	rawPrompt: string;
	targetSlideCount: number;
	themeLabel: string;
	keywords: string[];
};

function clampSlideCount(value: number): number {
	return Math.max(3, Math.min(6, value));
}

function extractSlideCount(prompt: string): number {
	const digitMatch = prompt.match(/\b(\d+)\s*-\s*slide\b|\b(\d+)\s+slide\b/i);
	if (digitMatch) {
		const matchValue = digitMatch[1] ?? digitMatch[2];
		return clampSlideCount(Number(matchValue));
	}

	for (const [word, value] of numberWordMap.entries()) {
		if (new RegExp(`\\b${word}(?:\\s+|-)?slide\\b`, "i").test(prompt)) {
			return value;
		}
	}

	return 6;
}

function normalizeToken(token: string): string {
	return token.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

function extractKeywords(prompt: string): string[] {
	const normalizedPrompt = prompt.toLowerCase();
	const explicitKeywords = keywordPriority.filter((keyword) =>
		normalizedPrompt.includes(keyword),
	);

	if (explicitKeywords.length > 0) {
		return [...explicitKeywords];
	}

	const discoveredKeywords = prompt
		.split(/[^a-zA-Z0-9-]+/)
		.map(normalizeToken)
		.filter((token) => token.length >= 4 && !stopWords.has(token));

	return [...new Set(discoveredKeywords)].slice(0, 4);
}

function createThemeLabel(keywords: string[]): string {
	if (keywords.length === 0) {
		return "deck spec";
	}

	return keywords.slice(0, 3).join(" ");
}

export function interpretPrompt(prompt: string): PromptModel {
	const trimmedPrompt = prompt.trim();
	if (trimmedPrompt.length < 16) {
		throw new Error(
			"Prompt is too short to derive a canonical deck spec. Provide a fuller user prompt.",
		);
	}

	const keywords = extractKeywords(trimmedPrompt);

	return {
		rawPrompt: trimmedPrompt,
		targetSlideCount: extractSlideCount(trimmedPrompt),
		themeLabel: createThemeLabel(keywords),
		keywords,
	};
}
