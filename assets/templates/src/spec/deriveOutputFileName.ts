import type { DeckImageAsset, SharedVisualAsset } from "./contract.js";

type SlideScopedOutputInput = Pick<
	DeckImageAsset,
	"slide_id" | "intended_usage" | "size_tier" | "output_format"
>;

type SharedOutputInput = Pick<
	SharedVisualAsset,
	"intended_usage" | "size_tier" | "output_format"
>;

export function deriveSlideScopedOutputFileName(
	asset: SlideScopedOutputInput,
): string {
	return `${asset.slide_id}__${asset.intended_usage}__${asset.size_tier}.${asset.output_format}`;
}

export function deriveSharedOutputFileName(asset: SharedOutputInput): string {
	return `shared__${asset.intended_usage}__${asset.size_tier}.${asset.output_format}`;
}

export function deriveOutputFileName(
	asset: DeckImageAsset | SharedVisualAsset,
): string {
	return "slide_id" in asset
		? deriveSlideScopedOutputFileName(asset)
		: deriveSharedOutputFileName(asset);
}
