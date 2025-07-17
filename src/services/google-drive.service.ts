export interface DriveFile {
	id: string;
	name: string;
	mimeType: string;
	modifiedTime: string;
	webViewLink?: string;
	size?: string;
}

export interface DriveSearchOptions {
	folderId?: string;
	query?: string;
	pageSize?: number;
	pageToken?: string;
}

export class GoogleDriveService {
	private readonly baseUrl = "https://www.googleapis.com/drive/v3";
	private readonly docsUrl = "https://docs.googleapis.com/v1";

	constructor(private readonly accessToken: string) {}

	private async makeRequest(url: string, options?: RequestInit): Promise<Response> {
		const response = await fetch(url, {
			...options,
			headers: {
				Authorization: `Bearer ${this.accessToken}`,
				"Content-Type": "application/json",
				...options?.headers,
			},
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Google Drive API error: ${response.status} - ${error}`);
		}

		return response;
	}

	async listFilesInFolder(
		folderId: string,
		options?: Omit<DriveSearchOptions, "folderId">,
	): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
		const params = new URLSearchParams({
			q: `'${folderId}' in parents and trashed = false`,
			fields: "files(id,name,mimeType,modifiedTime,webViewLink,size),nextPageToken",
			pageSize: String(options?.pageSize || 100),
		});

		if (options?.query) {
			params.set("q", `'${folderId}' in parents and trashed = false and ${options.query}`);
		}

		if (options?.pageToken) {
			params.set("pageToken", options.pageToken);
		}

		const response = await this.makeRequest(`${this.baseUrl}/files?${params}`);
		const data = await response.json() as { files?: DriveFile[]; nextPageToken?: string };

		return {
			files: data.files || [],
			nextPageToken: data.nextPageToken,
		};
	}

	async searchFiles(
		query: string,
		folderId?: string,
	): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
		let searchQuery = `fullText contains '${query}' and trashed = false`;
		if (folderId) {
			searchQuery = `'${folderId}' in parents and ${searchQuery}`;
		}

		const params = new URLSearchParams({
			q: searchQuery,
			fields: "files(id,name,mimeType,modifiedTime,webViewLink,size),nextPageToken",
			pageSize: "50",
		});

		const response = await this.makeRequest(`${this.baseUrl}/files?${params}`);
		const data = await response.json() as { files?: DriveFile[]; nextPageToken?: string };

		return {
			files: data.files || [],
			nextPageToken: data.nextPageToken,
		};
	}

	async getFileMetadata(fileId: string): Promise<DriveFile> {
		const params = new URLSearchParams({
			fields: "id,name,mimeType,modifiedTime,webViewLink,size,description,owners,lastModifyingUser",
		});

		const response = await this.makeRequest(`${this.baseUrl}/files/${fileId}?${params}`);
		return await response.json() as DriveFile;
	}

	async getGoogleDocContent(documentId: string): Promise<string> {
		const response = await this.makeRequest(`${this.docsUrl}/documents/${documentId}`);
		const doc = await response.json() as any;

		// Extract text content from Google Docs structure
		let text = "";
		if (doc.body?.content) {
			for (const element of doc.body.content) {
				if (element.paragraph?.elements) {
					for (const textRun of element.paragraph.elements) {
						if (textRun.textRun?.content) {
							text += textRun.textRun.content;
						}
					}
				}
			}
		}

		return text;
	}

	async exportFile(fileId: string, mimeType: string = "text/plain"): Promise<string> {
		const response = await this.makeRequest(
			`${this.baseUrl}/files/${fileId}/export?mimeType=${encodeURIComponent(mimeType)}`,
		);
		return await response.text();
	}

	async getFileContent(file: DriveFile): Promise<string> {
		// Handle Google Docs
		if (file.mimeType === "application/vnd.google-apps.document") {
			return await this.getGoogleDocContent(file.id);
		}

		// Handle other Google Workspace files by exporting as text
		if (file.mimeType.startsWith("application/vnd.google-apps.")) {
			return await this.exportFile(file.id, "text/plain");
		}

		// For regular files, download content
		const response = await this.makeRequest(`${this.baseUrl}/files/${file.id}?alt=media`);
		return await response.text();
	}
}