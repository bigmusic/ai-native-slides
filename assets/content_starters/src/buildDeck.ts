import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
	createStarterDeckModel,
	type StarterDeckModel,
} from "./presentationModel.js";

type TextOptions = Record<string, unknown>;

type LayoutBox = {
	h: number;
};

type SlideBackground = {
	color: string;
};

type PptxSlide = {
	background?: SlideBackground;
	addShape: (shapeName: "rect" | "roundRect", options: TextOptions) => void;
	addText: (text: string, options: TextOptions) => void;
};

type Presentation = {
	layout: string;
	author: string;
	company: string;
	subject: string;
	title: string;
	lang: string;
	theme: TextOptions;
	addSlide: () => PptxSlide;
	writeFile: (options: { fileName: string }) => Promise<string>;
};

type HelperApi = {
	autoFontSize: (
		text: string,
		fontFace: string,
		options: TextOptions,
	) => TextOptions;
	calcTextBox: (fontSize: number, options: TextOptions) => LayoutBox;
	safeOuterShadow: (
		color: string,
		opacity: number,
		angle: number,
		blur: number,
		distance: number,
	) => TextOptions;
	warnIfSlideHasOverlaps: (slide: PptxSlide, pptx: Presentation) => void;
	warnIfSlideElementsOutOfBounds: (
		slide: PptxSlide,
		pptx: Presentation,
	) => void;
};

const require = createRequire(import.meta.url);
const PptxGenJS = require("pptxgenjs") as {
	new (): Presentation;
};
const helperApi =
	require("../../../asset-pipeline/pptxgenjs_helpers/index.js") as HelperApi;
const {
	autoFontSize,
	calcTextBox,
	safeOuterShadow,
	warnIfSlideHasOverlaps,
	warnIfSlideElementsOutOfBounds,
} = helperApi;

const headingFont = "Arial";
const bodyFont = "Arial";
const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

export const defaultOutputFile = path.join(
	projectRoot,
	"output",
	`${path.basename(projectRoot)}.pptx`,
);

const palette = {
	ink: "132238",
	muted: "54657D",
	sand: "F4F0E8",
	mist: "EFF4F8",
	white: "FFFFFF",
	line: "D7E0EA",
	teal: "1E8C7A",
	coral: "E97855",
	gold: "D9A441",
	sky: "7FA6E8",
	navy: "1F3A5F",
};

function finalizeSlide(slide: PptxSlide, pptx: Presentation): void {
	warnIfSlideHasOverlaps(slide, pptx);
	warnIfSlideElementsOutOfBounds(slide, pptx);
}

function addBadge(
	slide: PptxSlide,
	label: string,
	x: number,
	y: number,
	width: number,
	fillColor: string,
	textColor: string,
): void {
	slide.addShape("roundRect", {
		x,
		y,
		w: width,
		h: 0.34,
		rectRadius: 0.06,
		fill: { color: fillColor },
		line: { color: fillColor, pt: 1 },
	});
	slide.addText(label, {
		x,
		y: y + 0.07,
		w: width,
		h: 0.18,
		fontFace: bodyFont,
		fontSize: 10,
		bold: true,
		color: textColor,
		align: "center",
		margin: 0,
	});
}

function addSectionHeader(
	slide: PptxSlide,
	eyebrow: string,
	title: string,
	subtitle: string,
	backgroundColor: string,
): void {
	slide.background = { color: backgroundColor };
	slide.addText(eyebrow, {
		x: 0.6,
		y: 0.42,
		w: 3.5,
		h: 0.24,
		fontFace: bodyFont,
		fontSize: 10,
		bold: true,
		color: palette.teal,
		margin: 0,
		charSpace: 1.4,
	});
	slide.addText(title, {
		x: 0.6,
		y: 0.72,
		w: 6.2,
		h: 0.56,
		fontFace: headingFont,
		fontSize: 24,
		bold: true,
		color: palette.ink,
		margin: 0,
	});
	slide.addText(subtitle, {
		x: 0.6,
		y: 1.36,
		w: 6.4,
		h: 0.52,
		fontFace: bodyFont,
		fontSize: 12,
		color: palette.muted,
		margin: 0,
	});
}

function addCard(
	slide: PptxSlide,
	{
		accent,
		body,
		bodySize,
		height,
		title,
		titleSize,
		width,
		x,
		y,
	}: {
		accent: string;
		body: string;
		bodySize: number;
		height: number;
		title: string;
		titleSize: number;
		width: number;
		x: number;
		y: number;
	},
): void {
	const bodyBox = calcTextBox(bodySize, {
		text: body,
		w: width - 0.72,
		fontFace: bodyFont,
		leading: 1.18,
		margin: 0,
		padding: 0.16,
	});

	slide.addShape("roundRect", {
		x,
		y,
		w: width,
		h: height,
		rectRadius: 0.08,
		fill: { color: palette.white },
		line: { color: palette.line, pt: 1 },
		shadow: safeOuterShadow("132238", 0.12, 45, 2, 1),
	});
	slide.addShape("rect", {
		x: x + 0.18,
		y: y + 0.22,
		w: 0.12,
		h: height - 0.44,
		fill: { color: accent },
		line: { color: accent, pt: 0.5 },
	});
	slide.addText(title, {
		x: x + 0.42,
		y: y + 0.26,
		w: width - 0.6,
		h: 0.34,
		fontFace: headingFont,
		fontSize: titleSize,
		bold: true,
		color: palette.ink,
		margin: 0,
	});
	slide.addText(body, {
		x: x + 0.42,
		y: y + 0.76,
		w: width - 0.72,
		h: Math.min(height - 0.96, bodyBox.h),
		fontFace: bodyFont,
		fontSize: bodySize,
		color: palette.muted,
		margin: 0,
		valign: "top",
	});
}

function addMetricCard(
	slide: PptxSlide,
	metric: StarterDeckModel["metrics"][number],
	x: number,
	y: number,
	width: number,
): void {
	slide.addShape("roundRect", {
		x,
		y,
		w: width,
		h: 1.4,
		rectRadius: 0.08,
		fill: { color: palette.white },
		line: { color: palette.line, pt: 1 },
	});
	slide.addText(metric.value, {
		x: x + 0.24,
		y: y + 0.22,
		w: width - 0.48,
		h: 0.38,
		fontFace: headingFont,
		fontSize: 23,
		bold: true,
		color: metric.accent,
		margin: 0,
	});
	slide.addText(metric.label, {
		x: x + 0.24,
		y: y + 0.74,
		w: width - 0.48,
		h: 0.3,
		fontFace: bodyFont,
		fontSize: 11,
		color: palette.muted,
		margin: 0,
	});
}

function buildCover(
	slide: PptxSlide,
	model: StarterDeckModel,
	pptx: Presentation,
): void {
	slide.background = { color: palette.sand };

	addBadge(
		slide,
		model.audienceLabel,
		0.62,
		0.46,
		1.95,
		"E0F0EB",
		palette.teal,
	);

	slide.addText(
		model.title,
		autoFontSize(model.title, headingFont, {
			x: 0.62,
			y: 1.02,
			w: 5.8,
			h: 1.0,
			fontSize: 30,
			minFontSize: 22,
			maxFontSize: 30,
			mode: "shrink",
			bold: true,
			color: palette.ink,
			margin: 0,
			leading: 1.05,
		}),
	);

	slide.addText(model.subtitle, {
		x: 0.62,
		y: 2.25,
		w: 5.9,
		h: 1.0,
		fontFace: bodyFont,
		fontSize: 13,
		color: palette.muted,
		margin: 0,
		valign: "top",
	});

	addBadge(
		slide,
		"Typed slide builders",
		0.62,
		3.52,
		1.75,
		"FFFFFF",
		palette.ink,
	);
	addBadge(slide, "Fast Vitest loop", 2.55, 3.52, 1.55, "FFFFFF", palette.ink);
	addBadge(slide, "Editable PPTX", 4.28, 3.52, 1.4, "FFFFFF", palette.ink);

	slide.addShape("roundRect", {
		x: 7.05,
		y: 0.86,
		w: 5.2,
		h: 5.74,
		rectRadius: 0.12,
		fill: { color: "FBFCFD" },
		line: { color: palette.line, pt: 1.2 },
	});

	for (const [index, step] of model.workflowSteps.entries()) {
		addCard(slide, {
			x: 7.42,
			y: 1.18 + index * 1.12,
			width: 4.42,
			height: 0.92,
			title: `${index + 1}. ${step.title}`,
			body: step.body,
			accent: index % 2 === 0 ? palette.teal : palette.navy,
			titleSize: 15,
			bodySize: 10.5,
		});
	}

	finalizeSlide(slide, pptx);
}

function buildWorkflow(
	slide: PptxSlide,
	model: StarterDeckModel,
	pptx: Presentation,
): void {
	addSectionHeader(
		slide,
		"WORKFLOW",
		"The fast loop is now code-first, test-first, and still grounded in rendered output.",
		"TypeScript guards the authoring layer; Python keeps handling render, overflow, montage, and font checks.",
		palette.mist,
	);

	for (const [index, step] of model.workflowSteps.entries()) {
		addCard(slide, {
			x: 0.6 + index * 3.12,
			y: 2.1,
			width: 2.85,
			height: 3.4,
			title: step.title,
			body: step.body,
			accent:
				[palette.teal, palette.navy, palette.gold, palette.coral][index] ??
				palette.teal,
			titleSize: 18,
			bodySize: 12,
		});
	}

	slide.addText(
		"This split keeps the authoring model fast to iterate while leaving visual verification to the proven local toolchain.",
		{
			x: 0.6,
			y: 6.2,
			w: 12.0,
			h: 0.4,
			fontFace: bodyFont,
			fontSize: 11.5,
			color: palette.muted,
			margin: 0,
		},
	);

	finalizeSlide(slide, pptx);
}

function buildQualityBar(
	slide: PptxSlide,
	model: StarterDeckModel,
	pptx: Presentation,
): void {
	addSectionHeader(
		slide,
		"QUALITY BAR",
		"A deck is only done when the code checks and the rendered checks both agree.",
		"Use tests for fast structural feedback and keep the existing rendering pipeline as the last gate before delivery.",
		palette.white,
	);

	for (const [index, metric] of model.metrics.entries()) {
		addMetricCard(slide, metric, 0.7 + index * 4.18, 2.05, 3.72);
	}

	addCard(slide, {
		x: 0.7,
		y: 3.95,
		width: 5.9,
		height: 1.8,
		title: "Recommended local sequence",
		body: "Run pnpm lint, pnpm typecheck, pnpm test, and pnpm build before launching validate-local.sh.",
		accent: palette.teal,
		titleSize: 18,
		bodySize: 12,
	});
	addCard(slide, {
		x: 6.75,
		y: 3.95,
		width: 5.9,
		height: 1.8,
		title: "Why this boundary works",
		body: "Most regressions surface earlier in TypeScript or tests, so Python validation can stay focused on rendered behavior and font fidelity.",
		accent: palette.navy,
		titleSize: 18,
		bodySize: 12,
	});

	finalizeSlide(slide, pptx);
}

function buildRoadmap(
	slide: PptxSlide,
	model: StarterDeckModel,
	pptx: Presentation,
): void {
	addSectionHeader(
		slide,
		"ROADMAP",
		"Move from a JS starter into a maintainable presentation codebase without touching the Python validators yet.",
		"This template proves the architecture; the next iteration should swap in product-specific copy, brand styling, and richer visual assets.",
		palette.sand,
	);

	for (const [index, phase] of model.roadmap.entries()) {
		addCard(slide, {
			x: 0.7 + index * 4.05,
			y: 2.15,
			width: 3.55,
			height: 3.2,
			title: phase.title,
			body: phase.body,
			accent: phase.accent,
			titleSize: 18,
			bodySize: 12,
		});
	}

	slide.addText(
		"Treat the generated workspace as a real software project: the deck content lives in src/, the regression checks live in tests/, and output artifacts stay disposable.",
		{
			x: 0.7,
			y: 6.15,
			w: 12.0,
			h: 0.45,
			fontFace: bodyFont,
			fontSize: 11.5,
			color: palette.muted,
			margin: 0,
		},
	);

	finalizeSlide(slide, pptx);
}

export function buildPresentation(
	model: StarterDeckModel = createStarterDeckModel(),
): {
	pptx: Presentation;
	slideCount: number;
} {
	const pptx = new PptxGenJS();

	pptx.layout = "LAYOUT_WIDE";
	pptx.author = "Codex";
	pptx.company = "bigmusic";
	pptx.subject = "AI-native presentation starter deck";
	pptx.title = model.title;
	pptx.lang = "en-US";
	pptx.theme = {
		headFontFace: headingFont,
		bodyFontFace: bodyFont,
		lang: "en-US",
	};

	const slides = [
		() => {
			const slide = pptx.addSlide();
			buildCover(slide, model, pptx);
		},
		() => {
			const slide = pptx.addSlide();
			buildWorkflow(slide, model, pptx);
		},
		() => {
			const slide = pptx.addSlide();
			buildQualityBar(slide, model, pptx);
		},
		() => {
			const slide = pptx.addSlide();
			buildRoadmap(slide, model, pptx);
		},
	];

	for (const buildSlide of slides) {
		buildSlide();
	}

	return {
		pptx,
		slideCount: slides.length,
	};
}

export async function writePresentation(
	destination: string = defaultOutputFile,
): Promise<{
	outputFile: string;
	slideCount: number;
}> {
	fs.mkdirSync(path.dirname(destination), { recursive: true });
	const { pptx, slideCount } = buildPresentation();

	await pptx.writeFile({ fileName: destination });

	return {
		outputFile: destination,
		slideCount,
	};
}
