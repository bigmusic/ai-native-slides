import { GoogleGenAI } from "@google/genai";

import type { AspectRatio } from "../../spec/contract.js";
import { createGeminiHttpOptions } from "../providerRequestConfig.js";

export const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

export type GenerateGeminiImageRequest = {
	apiKey: string;
	prompt: string;
	aspectRatio: AspectRatio;
	model?: string;
};

export type GeneratedImage = {
	imageBytes: Buffer;
	mimeType: string;
	model: string;
};

type InlineImagePart = {
	inlineData?: {
		data?: string;
		mimeType?: string;
	};
};

type GenerateContentResponseLike = {
	candidates?: Array<{
		content?: {
			parts?: InlineImagePart[];
		};
	}>;
};

function findInlineImageData(response: GenerateContentResponseLike) {
	const parts =
		response.candidates?.flatMap(
			(candidate) => candidate.content?.parts ?? [],
		) ?? [];

	return parts.find(
		(part) =>
			typeof part.inlineData?.data === "string" &&
			part.inlineData.data.length > 0 &&
			typeof part.inlineData.mimeType === "string" &&
			part.inlineData.mimeType.startsWith("image/"),
	);
}

export async function generateImageWithGemini(
	request: GenerateGeminiImageRequest,
): Promise<GeneratedImage> {
	const model = request.model ?? DEFAULT_GEMINI_IMAGE_MODEL;
	const client = new GoogleGenAI({
		apiKey: request.apiKey,
	});

	const response = (await client.models.generateContent({
		model,
		contents: request.prompt,
		config: {
			httpOptions: createGeminiHttpOptions(),
			responseModalities: ["Image"],
			imageConfig: {
				aspectRatio: request.aspectRatio,
			},
		},
	})) as GenerateContentResponseLike;

	const imagePart = findInlineImageData(response);

	if (!imagePart?.inlineData?.data) {
		throw new Error(
			`Gemini did not return inline image data for model ${model}.`,
		);
	}

	return {
		imageBytes: Buffer.from(imagePart.inlineData.data, "base64"),
		mimeType: imagePart.inlineData.mimeType ?? "image/png",
		model,
	};
}
