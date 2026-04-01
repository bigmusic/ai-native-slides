import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@google/genai", () => {
	const generateContent = vi.fn();
	const GoogleGenAI = vi.fn(() => ({
		models: {
			generateContent,
		},
	}));

	return {
		GoogleGenAI,
		__mock: {
			generateContent,
			GoogleGenAI,
		},
	};
});

import { __mock } from "@google/genai";

import {
	DEFAULT_GEMINI_IMAGE_MODEL,
	DEFAULT_GEMINI_PLANNER_MODEL,
	DEFAULT_GEMINI_PLANNER_SYSTEM_INSTRUCTION,
	DEFAULT_GEMINI_PROVIDER_RETRY_ATTEMPTS,
	DEFAULT_GEMINI_PROVIDER_TIMEOUT_MS,
	generateDeckSpecCandidateWithGemini,
	generateImageWithGemini,
} from "../src/public-testing.js";

type MockGenerateContent = ReturnType<typeof vi.fn>;

function getGenerateContentMock(): MockGenerateContent {
	return __mock.generateContent as MockGenerateContent;
}

describe("Gemini provider request config", () => {
	beforeEach(() => {
		getGenerateContentMock().mockReset();
	});

	it("passes explicit timeout and disables extra retries for planner requests", async () => {
		getGenerateContentMock().mockResolvedValueOnce({
			text: "{\"ok\":true}",
		});

		await generateDeckSpecCandidateWithGemini({
			apiKey: "test-key",
			prompt: "Return a small deck plan.",
		});

		expect(getGenerateContentMock()).toHaveBeenCalledWith({
			model: DEFAULT_GEMINI_PLANNER_MODEL,
			contents: "Return a small deck plan.",
			config: {
				systemInstruction: DEFAULT_GEMINI_PLANNER_SYSTEM_INSTRUCTION,
				responseMimeType: "application/json",
				httpOptions: {
					timeout: DEFAULT_GEMINI_PROVIDER_TIMEOUT_MS,
					retryOptions: {
						attempts: DEFAULT_GEMINI_PROVIDER_RETRY_ATTEMPTS,
					},
				},
				seed: undefined,
			},
		});
	});

	it("passes explicit timeout and disables extra retries for image requests", async () => {
		getGenerateContentMock().mockResolvedValueOnce({
			candidates: [
				{
					content: {
						parts: [
							{
								inlineData: {
									data: Buffer.from("png").toString("base64"),
									mimeType: "image/png",
								},
							},
						],
					},
				},
			],
		});

		await generateImageWithGemini({
			apiKey: "test-key",
			prompt: "Create a clean product shot.",
			aspectRatio: "16:9",
		});

		expect(getGenerateContentMock()).toHaveBeenCalledWith({
			model: DEFAULT_GEMINI_IMAGE_MODEL,
			contents: "Create a clean product shot.",
			config: {
				httpOptions: {
					timeout: DEFAULT_GEMINI_PROVIDER_TIMEOUT_MS,
					retryOptions: {
						attempts: DEFAULT_GEMINI_PROVIDER_RETRY_ATTEMPTS,
					},
				},
				responseModalities: ["Image"],
				imageConfig: {
					aspectRatio: "16:9",
				},
			},
		});
	});
});
