import { GoogleGenAI } from "@google/genai";

import { createGeminiHttpOptions } from "../providerRequestConfig.js";

export const DEFAULT_GEMINI_PLANNER_MODEL = "gemini-3-flash-preview";
export const DEFAULT_GEMINI_PLANNER_SYSTEM_INSTRUCTION =
	"You are a deck-spec planner. Return exactly one valid JSON object that follows the requested contract. Do not emit markdown, prose, comments, code fences, aliases, null placeholders, or extra top-level keys. Prefer strict schema compliance and complete required fields over stylistic variation.";

export type GenerateDeckSpecCandidateRequest = {
	apiKey: string;
	prompt: string;
	model?: string;
	seed?: number;
};

type GenerateContentResponseLike = {
	text?: string;
};

export async function generateDeckSpecCandidateWithGemini(
	request: GenerateDeckSpecCandidateRequest,
): Promise<unknown> {
	const client = new GoogleGenAI({
		apiKey: request.apiKey,
	});
	const response = (await client.models.generateContent({
		model: request.model ?? DEFAULT_GEMINI_PLANNER_MODEL,
		contents: request.prompt,
		config: {
			systemInstruction: DEFAULT_GEMINI_PLANNER_SYSTEM_INSTRUCTION,
			responseMimeType: "application/json",
			httpOptions: createGeminiHttpOptions(),
			seed: request.seed,
		},
	})) as GenerateContentResponseLike;

	if (typeof response.text !== "string" || response.text.trim().length === 0) {
		throw new Error("Gemini planner returned an empty JSON response.");
	}

	try {
		return JSON.parse(response.text) as unknown;
	} catch (error) {
		throw new Error(
			error instanceof Error
				? `Gemini planner returned invalid JSON: ${error.message}`
				: `Gemini planner returned invalid JSON: ${String(error)}`,
		);
	}
}
