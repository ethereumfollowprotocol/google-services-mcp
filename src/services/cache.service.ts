export interface CacheOptions {
	ttl?: number; // Time to live in seconds
	namespace?: string; // Cache namespace for different types of data
}

export class CacheService {
	constructor(private readonly kv: KVNamespace) {}

	private getKey(key: string, namespace?: string): string {
		return namespace ? `${namespace}:${key}` : key;
	}

	async get<T>(key: string, namespace?: string): Promise<T | null> {
		const fullKey = this.getKey(key, namespace);
		const value = await this.kv.get(fullKey, "json");
		return value as T | null;
	}

	async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
		const fullKey = this.getKey(key, options?.namespace);
		const expirationTtl = options?.ttl || 300; // Default 5 minutes

		await this.kv.put(fullKey, JSON.stringify(value), {
			expirationTtl,
		});
	}

	async delete(key: string, namespace?: string): Promise<void> {
		const fullKey = this.getKey(key, namespace);
		await this.kv.delete(fullKey);
	}

	async getOrFetch<T>(
		key: string,
		fetchFn: () => Promise<T>,
		options?: CacheOptions,
	): Promise<T> {
		// Try to get from cache first
		const cached = await this.get<T>(key, options?.namespace);
		if (cached !== null) {
			return cached;
		}

		// Fetch fresh data
		const freshData = await fetchFn();

		// Store in cache
		await this.set(key, freshData, options);

		return freshData;
	}

	// Cache keys for different types of data
	static keys = {
		driveFile: (fileId: string) => `drive:file:${fileId}`,
		driveFolder: (folderId: string, query?: string) =>
			`drive:folder:${folderId}:${query || "all"}`,
		driveContent: (fileId: string) => `drive:content:${fileId}`,
		calendarEvents: (calendarId: string, timeRange: string) =>
			`calendar:events:${calendarId}:${timeRange}`,
		calendarEvent: (eventId: string) => `calendar:event:${eventId}`,
	};

	// TTL values for different types of data (in seconds)
	static ttl = {
		fileList: 300, // 5 minutes
		fileContent: 3600, // 1 hour
		fileMetadata: 600, // 10 minutes
		calendarEvents: 300, // 5 minutes
		calendarEvent: 600, // 10 minutes
	};
}