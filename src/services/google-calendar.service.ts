export interface CalendarEvent {
	id: string;
	summary: string;
	description?: string;
	start: {
		dateTime?: string;
		date?: string;
		timeZone?: string;
	};
	end: {
		dateTime?: string;
		date?: string;
		timeZone?: string;
	};
	attendees?: Attendee[];
	organizer?: {
		email: string;
		displayName?: string;
	};
	htmlLink?: string;
	hangoutLink?: string;
	location?: string;
	status?: string;
}

export interface Attendee {
	email: string;
	displayName?: string;
	responseStatus?: "needsAction" | "declined" | "tentative" | "accepted";
	organizer?: boolean;
	optional?: boolean;
}

export interface CalendarListOptions {
	calendarId?: string;
	timeMin?: string;
	timeMax?: string;
	maxResults?: number;
	singleEvents?: boolean;
	orderBy?: "startTime" | "updated";
	pageToken?: string;
	q?: string;
}

export class GoogleCalendarService {
	private readonly baseUrl = "https://www.googleapis.com/calendar/v3";

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
			throw new Error(`Google Calendar API error: ${response.status} - ${error}`);
		}

		return response;
	}

	async listEvents(
		options: CalendarListOptions = {},
	): Promise<{ events: CalendarEvent[]; nextPageToken?: string }> {
		const calendarId = options.calendarId || "primary";
		const params = new URLSearchParams({
			singleEvents: "true",
			orderBy: options.orderBy || "startTime",
			maxResults: String(options.maxResults || 50),
		});

		if (options.timeMin) {
			params.set("timeMin", options.timeMin);
		}
		if (options.timeMax) {
			params.set("timeMax", options.timeMax);
		}
		if (options.pageToken) {
			params.set("pageToken", options.pageToken);
		}
		if (options.q) {
			params.set("q", options.q);
		}

		const response = await this.makeRequest(
			`${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
		);
		const data = await response.json() as { items?: CalendarEvent[]; nextPageToken?: string };

		return {
			events: data.items || [],
			nextPageToken: data.nextPageToken,
		};
	}

	async getUpcomingEvents(
		calendarId?: string,
		daysAhead: number = 7,
	): Promise<CalendarEvent[]> {
		const now = new Date();
		const futureDate = new Date();
		futureDate.setDate(now.getDate() + daysAhead);

		const { events } = await this.listEvents({
			calendarId,
			timeMin: now.toISOString(),
			timeMax: futureDate.toISOString(),
			singleEvents: true,
			orderBy: "startTime",
		});

		return events;
	}

	async getPastEvents(
		calendarId?: string,
		daysBehind: number = 30,
	): Promise<CalendarEvent[]> {
		const now = new Date();
		const pastDate = new Date();
		pastDate.setDate(now.getDate() - daysBehind);

		const { events } = await this.listEvents({
			calendarId,
			timeMin: pastDate.toISOString(),
			timeMax: now.toISOString(),
			singleEvents: true,
			orderBy: "startTime",
		});

		return events;
	}

	async getEvent(eventId: string, calendarId: string = "primary"): Promise<CalendarEvent> {
		const response = await this.makeRequest(
			`${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(
				eventId,
			)}`,
		);
		return await response.json() as CalendarEvent;
	}

	async searchEvents(query: string, calendarId?: string): Promise<CalendarEvent[]> {
		const { events } = await this.listEvents({
			calendarId,
			q: query,
			singleEvents: true,
			orderBy: "startTime",
		});

		return events;
	}

	async getEventsByDateRange(
		startDate: string,
		endDate: string,
		calendarId?: string,
	): Promise<CalendarEvent[]> {
		const { events } = await this.listEvents({
			calendarId,
			timeMin: new Date(startDate).toISOString(),
			timeMax: new Date(endDate).toISOString(),
			singleEvents: true,
			orderBy: "startTime",
		});

		return events;
	}

	formatEventTime(event: CalendarEvent): string {
		const start = event.start.dateTime || event.start.date;
		const end = event.end.dateTime || event.end.date;

		if (!start) return "No time specified";

		const startDate = new Date(start);
		const endDate = end ? new Date(end) : null;

		// All-day event
		if (event.start.date) {
			return startDate.toLocaleDateString();
		}

		// Timed event
		const timeOptions: Intl.DateTimeFormatOptions = {
			hour: "2-digit",
			minute: "2-digit",
		};

		const dateOptions: Intl.DateTimeFormatOptions = {
			weekday: "short",
			month: "short",
			day: "numeric",
		};

		let result = startDate.toLocaleDateString(undefined, dateOptions);
		result += ` ${startDate.toLocaleTimeString(undefined, timeOptions)}`;

		if (endDate) {
			result += ` - ${endDate.toLocaleTimeString(undefined, timeOptions)}`;
		}

		return result;
	}
}