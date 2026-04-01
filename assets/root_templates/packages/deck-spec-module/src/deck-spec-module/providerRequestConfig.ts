export const DEFAULT_GEMINI_PROVIDER_TIMEOUT_MS = 60_000;
export const DEFAULT_GEMINI_PROVIDER_RETRY_ATTEMPTS = 1;

export function createGeminiHttpOptions() {
	return {
		timeout: DEFAULT_GEMINI_PROVIDER_TIMEOUT_MS,
		retryOptions: {
			attempts: DEFAULT_GEMINI_PROVIDER_RETRY_ATTEMPTS,
		},
	};
}
