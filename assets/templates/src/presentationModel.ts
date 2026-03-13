export type WorkflowStep = {
	title: string;
	body: string;
};

export type Metric = {
	value: string;
	label: string;
	accent: string;
};

export type RoadmapPhase = {
	title: string;
	body: string;
	accent: string;
};

export type StarterDeckModel = {
	audienceLabel: string;
	title: string;
	subtitle: string;
	workflowSteps: WorkflowStep[];
	metrics: Metric[];
	roadmap: RoadmapPhase[];
};

export function createStarterDeckModel(): StarterDeckModel {
	return {
		audienceLabel: "TypeScript + TDD starter",
		title: "AI Native Presentation Studio",
		subtitle:
			"Turn a prompt into an editable deck, validate it locally, and tighten the story with fast test feedback.",
		workflowSteps: [
			{
				title: "Frame the deck",
				body: "Define the audience, desired outcome, slide count, and tone before layout work begins.",
			},
			{
				title: "Generate editably",
				body: "Build PowerPoint-native slides in TypeScript so the deck stays rebuildable and human-editable.",
			},
			{
				title: "Review with tests",
				body: "Use linting, type checks, and focused Vitest coverage for the presentation model before rendering.",
			},
			{
				title: "Validate visually",
				body: "Run the existing Python render, overflow, montage, and font checks before shipping the deck.",
			},
		],
		metrics: [
			{ value: "<10 min", label: "Prompt to first draft", accent: "1E8C7A" },
			{
				value: "4 gates",
				label: "Feedback loops in CI/local",
				accent: "1F3A5F",
			},
			{ value: "100%", label: "Editable PPTX output", accent: "E97855" },
		],
		roadmap: [
			{
				title: "Phase 1",
				body: "Establish typed slide builders and a testable presentation model.",
				accent: "1E8C7A",
			},
			{
				title: "Phase 2",
				body: "Add reusable brand components and richer layout assertions.",
				accent: "D9A441",
			},
			{
				title: "Phase 3",
				body: "Layer in rendered-slide critique, approvals, and publish-to-web steps.",
				accent: "E97855",
			},
		],
	};
}
