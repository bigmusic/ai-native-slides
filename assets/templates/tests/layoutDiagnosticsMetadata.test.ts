import { createRequire } from "node:module";

import { afterEach, describe, expect, it, vi } from "vitest";

type DiagnosticsOptions = {
	decorative?: boolean;
	ignoreOutOfBounds?: boolean;
	ignoreOverlap?: boolean;
};

type SlideObject = {
	data?: {
		fill?: Record<string, unknown>;
		h: number;
		line?: Record<string, unknown>;
		w: number;
		x: number;
		y: number;
	};
	type: string;
};

type SlideLike = {
	_presLayout: {
		height: number;
		width: number;
	};
	_slideObjects: SlideObject[];
};

type PresentationLike = {
	_slides: SlideLike[];
};

type HelperApi = {
	getSlideObjectDiagnosticsOptions: (obj: SlideObject) => DiagnosticsOptions;
	markLastSlideObjectAsDecorative: (
		slide: SlideLike,
		options?: DiagnosticsOptions,
	) => SlideObject;
	setLastSlideObjectDiagnosticsOptions: (
		slide: SlideLike,
		options: DiagnosticsOptions,
	) => SlideObject;
	warnIfSlideElementsOutOfBounds: (
		slide: SlideLike,
		pptx: PresentationLike,
	) => void;
	warnIfSlideHasOverlaps: (slide: SlideLike, pptx: PresentationLike) => void;
};

const require = createRequire(import.meta.url);
const {
	getSlideObjectDiagnosticsOptions,
	markLastSlideObjectAsDecorative,
	setLastSlideObjectDiagnosticsOptions,
	warnIfSlideElementsOutOfBounds,
	warnIfSlideHasOverlaps,
} = require("../../../assets/pptxgenjs_helpers/index.js") as HelperApi;

function createShape(x: number, y: number, w: number, h: number): SlideObject {
	return {
		type: "shape",
		data: {
			x,
			y,
			w,
			h,
			fill: { color: "FFFFFF" },
			line: { color: "0F172A", pt: 1 },
		},
	};
}

function createSlide(objects: SlideObject[]): SlideLike {
	return {
		_slideObjects: objects,
		_presLayout: {
			width: 10,
			height: 7.5,
		},
	};
}

function createPresentation(slide: SlideLike): PresentationLike {
	return {
		_slides: [slide],
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("layout diagnostics metadata", () => {
	it("ignores overlap diagnostics only for explicitly marked decorative objects", () => {
		const slide = createSlide([
			createShape(0.6, 0.8, 2.2, 1.8),
			createShape(1.4, 1.5, 2.4, 1.6),
		]);
		const pptx = createPresentation(slide);
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		markLastSlideObjectAsDecorative(slide);

		expect(getSlideObjectDiagnosticsOptions(slide._slideObjects[1])).toEqual(
			expect.objectContaining({
				decorative: true,
				ignoreOverlap: true,
				ignoreOutOfBounds: true,
			}),
		);

		warnIfSlideHasOverlaps(slide, pptx);

		expect(warnSpy).not.toHaveBeenCalled();
		expect(errorSpy).not.toHaveBeenCalled();
		expect(logSpy).not.toHaveBeenCalled();
	});

	it("preserves default overlap warnings for unmarked elements", () => {
		const slide = createSlide([
			createShape(0.6, 0.8, 2.2, 1.8),
			createShape(1.4, 1.5, 2.4, 1.6),
		]);
		const pptx = createPresentation(slide);
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		warnIfSlideHasOverlaps(slide, pptx);

		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("Overlap detected"),
		);
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("1 overlapping pair"),
		);
	});

	it("supports targeted out-of-bounds suppression without muting other diagnostics", () => {
		const slide = createSlide([
			createShape(0.8, 0.9, 1.4, 1.1),
			createShape(-0.3, 2.2, 1.2, 1),
		]);
		const pptx = createPresentation(slide);
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		setLastSlideObjectDiagnosticsOptions(slide, {
			ignoreOutOfBounds: true,
		});

		expect(getSlideObjectDiagnosticsOptions(slide._slideObjects[1])).toEqual(
			expect.objectContaining({
				ignoreOutOfBounds: true,
			}),
		);

		warnIfSlideElementsOutOfBounds(slide, pptx);

		expect(warnSpy).not.toHaveBeenCalled();
		expect(logSpy).not.toHaveBeenCalled();
	});
});
