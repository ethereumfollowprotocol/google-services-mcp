declare global {
	interface Env {
		// OAuth Configuration
		GOOGLE_CLIENT_ID: string;
		GOOGLE_CLIENT_SECRET: string;
		COOKIE_ENCRYPTION_KEY: string;
		HOSTED_DOMAIN?: string;

		// Google API Configuration
		GOOGLE_DRIVE_FOLDER_ID?: string;
		GOOGLE_CALENDAR_ID?: string;

		// KV Namespaces
		OAUTH_KV: KVNamespace;

		// Durable Objects
		MCP_OBJECT: DurableObjectNamespace;
	}
}

export {};