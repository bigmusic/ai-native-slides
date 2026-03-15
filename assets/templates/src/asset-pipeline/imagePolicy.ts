import sharp from "sharp";

import type {
	AspectRatio,
	ImageIntendedUsage,
	OutputFormat,
	SizeTier,
} from "../spec/contract.js";

export type TargetDimensions = {
	width: number;
	height: number;
};

export type ResizeStrategy = "crop" | "contain";

export type NormalizeGeneratedImageInput = {
	sourceBuffer: Buffer;
	outputFormat: OutputFormat;
	sizeTier: SizeTier;
	aspectRatio: AspectRatio;
	intendedUsage: ImageIntendedUsage;
};

const largeBounds = {
	width: 1920,
	height: 1200,
} as const;

export function resolveAspectRatioValue(aspectRatio: AspectRatio): number {
	switch (aspectRatio) {
		case "1:1":
			return 1;
		case "4:3":
			return 4 / 3;
		case "3:2":
			return 3 / 2;
		case "16:9":
			return 16 / 9;
		case "16:10":
			return 16 / 10;
		case "9:16":
			return 9 / 16;
	}
}

function fitWithinLongEdge(
	longEdge: number,
	aspectRatio: number,
): TargetDimensions {
	if (aspectRatio >= 1) {
		return {
			width: longEdge,
			height: Math.max(1, Math.round(longEdge / aspectRatio)),
		};
	}

	return {
		width: Math.max(1, Math.round(longEdge * aspectRatio)),
		height: longEdge,
	};
}

function fitWithinBounds(
	maxWidth: number,
	maxHeight: number,
	aspectRatio: number,
): TargetDimensions {
	const widthFromHeight = Math.round(maxHeight * aspectRatio);

	if (widthFromHeight <= maxWidth) {
		return {
			width: Math.max(1, widthFromHeight),
			height: maxHeight,
		};
	}

	return {
		width: maxWidth,
		height: Math.max(1, Math.round(maxWidth / aspectRatio)),
	};
}

export function resolveTargetDimensions(
	sizeTier: SizeTier,
	aspectRatio: AspectRatio,
): TargetDimensions {
	const aspectRatioValue = resolveAspectRatioValue(aspectRatio);

	switch (sizeTier) {
		case "small":
			return fitWithinLongEdge(512, aspectRatioValue);
		case "medium":
			return fitWithinLongEdge(1024, aspectRatioValue);
		case "large":
			return fitWithinBounds(
				largeBounds.width,
				largeBounds.height,
				aspectRatioValue,
			);
	}
}

export function resolveResizeStrategy(
	intendedUsage: ImageIntendedUsage,
): ResizeStrategy {
	switch (intendedUsage) {
		case "hero_visual":
		case "background":
			return "crop";
		default:
			return "contain";
	}
}

export function resolvePaddingColor(outputFormat: OutputFormat): sharp.Color {
	if (outputFormat === "png") {
		return {
			r: 0,
			g: 0,
			b: 0,
			alpha: 0,
		};
	}

	return {
		r: 245,
		g: 246,
		b: 248,
		alpha: 1,
	};
}

export async function normalizeGeneratedImage(
	input: NormalizeGeneratedImageInput,
): Promise<Buffer> {
	const target = resolveTargetDimensions(input.sizeTier, input.aspectRatio);
	const strategy = resolveResizeStrategy(input.intendedUsage);
	const paddingColor = resolvePaddingColor(input.outputFormat);

	const resizedImage = sharp(input.sourceBuffer)
		.rotate()
		.resize({
			width: target.width,
			height: target.height,
			fit: strategy === "crop" ? "cover" : "contain",
			position: strategy === "crop" ? "attention" : "centre",
			background: paddingColor,
		});

	if (input.outputFormat === "png") {
		return resizedImage.png({ compressionLevel: 9 }).toBuffer();
	}

	return resizedImage
		.flatten({ background: paddingColor })
		.jpeg({
			quality: 88,
			mozjpeg: true,
		})
		.toBuffer();
}
