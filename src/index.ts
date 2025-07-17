import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { McpAgent } from 'agents/mcp'
import { z } from 'zod'
import { GoogleHandler } from './google-handler'
import { GoogleDriveService } from './services/google-drive.service'
import { GoogleCalendarService } from './services/google-calendar.service'
import { CacheService } from './services/cache.service'

// Context from the auth process, encrypted & stored in the auth token
// and provided to the MyMCP as this.props
type Props = {
  name: string
  email: string
  accessToken: string
}

export class MyMCP extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({
    name: 'Meetings MCP',
    version: '1.0.0',
    description: 'Access and analyze Google Drive meeting transcripts and Calendar events',
  })

  private driveService!: GoogleDriveService
  private calendarService!: GoogleCalendarService
  private cacheService!: CacheService

  async init() {
    // Initialize services
    this.driveService = new GoogleDriveService(this.props.accessToken)
    this.calendarService = new GoogleCalendarService(this.props.accessToken)
    this.cacheService = new CacheService(this.env.OAUTH_KV)

    // Register Drive tools
    this.server.tool(
      'search_meeting_transcripts',
      {
        query: z.string().describe('Search query to find in meeting transcripts'),
        folderId: z.string().optional().describe('Google Drive folder ID to search in (uses default if not provided)'),
      },
      async ({ query, folderId }) => {
        try {
          const folderToSearch = folderId || this.env.GOOGLE_DRIVE_FOLDER_ID
          const cacheKey = CacheService.keys.driveFolder(folderToSearch || 'root', query)

          const results = await this.cacheService.getOrFetch(
            cacheKey,
            async () => {
              return await this.driveService.searchFiles(query, folderToSearch)
            },
            {
              ttl: CacheService.ttl.fileList,
              namespace: 'drive',
            },
          )

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(results, null, 2),
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error searching files: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          }
        }
      },
    )

    this.server.tool(
      'get_meeting_transcript',
      {
        fileId: z.string().describe('Google Drive file ID of the meeting transcript'),
      },
      async ({ fileId }) => {
        try {
          const cacheKey = CacheService.keys.driveContent(fileId)

          const content = await this.cacheService.getOrFetch(
            cacheKey,
            async () => {
              const metadata = await this.driveService.getFileMetadata(fileId)
              const text = await this.driveService.getFileContent(metadata)
              return { metadata, content: text }
            },
            {
              ttl: CacheService.ttl.fileContent,
              namespace: 'drive',
            },
          )

          return {
            content: [
              {
                type: 'text',
                text: `File: ${content.metadata.name}\nModified: ${content.metadata.modifiedTime}\n\n${content.content}`,
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting transcript: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          }
        }
      },
    )

    this.server.tool(
      'list_recent_meetings',
      {
        folderId: z.string().optional().describe('Google Drive folder ID (uses default if not provided)'),
        limit: z.number().optional().default(10).describe('Number of recent meetings to return'),
      },
      async ({ folderId, limit }) => {
        try {
          const folderToSearch = folderId || this.env.GOOGLE_DRIVE_FOLDER_ID || 'root'
          const cacheKey = CacheService.keys.driveFolder(folderToSearch, `recent-${limit}`)

          const results = await this.cacheService.getOrFetch(
            cacheKey,
            async () => {
              const { files } = await this.driveService.listFilesInFolder(folderToSearch, {
                pageSize: limit,
              })
              // Sort by modified time (most recent first)
              return files.sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime())
            },
            {
              ttl: CacheService.ttl.fileList,
              namespace: 'drive',
            },
          )

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(results.slice(0, limit), null, 2),
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error listing recent meetings: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          }
        }
      },
    )

    // Register Calendar tools
    this.server.tool(
      'get_upcoming_meetings',
      {
        daysAhead: z.number().optional().default(7).describe('Number of days ahead to look for meetings'),
        calendarId: z.string().optional().describe('Google Calendar ID (uses default if not provided)'),
      },
      async ({ daysAhead, calendarId }) => {
        try {
          const calendar = calendarId || this.env.GOOGLE_CALENDAR_ID || 'primary'
          const cacheKey = CacheService.keys.calendarEvents(calendar, `upcoming-${daysAhead}`)

          const events = await this.cacheService.getOrFetch(
            cacheKey,
            async () => {
              return await this.calendarService.getUpcomingEvents(calendar, daysAhead)
            },
            {
              ttl: CacheService.ttl.calendarEvents,
              namespace: 'calendar',
            },
          )

          const formattedEvents = events.map((event) => ({
            summary: event.summary,
            time: this.calendarService.formatEventTime(event),
            attendees: event.attendees?.length || 0,
            location: event.location,
            link: event.htmlLink,
          }))

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(formattedEvents, null, 2),
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting upcoming meetings: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          }
        }
      },
    )

    this.server.tool(
      'get_meeting_attendees',
      {
        eventId: z.string().describe('Google Calendar event ID'),
        calendarId: z.string().optional().describe('Google Calendar ID (uses default if not provided)'),
      },
      async ({ eventId, calendarId }) => {
        try {
          const calendar = calendarId || this.env.GOOGLE_CALENDAR_ID || 'primary'
          const cacheKey = CacheService.keys.calendarEvent(eventId)

          const event = await this.cacheService.getOrFetch(
            cacheKey,
            async () => {
              return await this.calendarService.getEvent(eventId, calendar)
            },
            {
              ttl: CacheService.ttl.calendarEvent,
              namespace: 'calendar',
            },
          )

          const attendeeInfo = {
            meeting: event.summary,
            time: this.calendarService.formatEventTime(event),
            organizer: event.organizer,
            attendees: event.attendees || [],
            totalAttendees: event.attendees?.length || 0,
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(attendeeInfo, null, 2),
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting meeting attendees: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          }
        }
      },
    )

    this.server.tool(
      'search_meetings_by_date',
      {
        startDate: z.string().describe('Start date (YYYY-MM-DD)'),
        endDate: z.string().describe('End date (YYYY-MM-DD)'),
        calendarId: z.string().optional().describe('Google Calendar ID (uses default if not provided)'),
      },
      async ({ startDate, endDate, calendarId }) => {
        try {
          const calendar = calendarId || this.env.GOOGLE_CALENDAR_ID || 'primary'
          const cacheKey = CacheService.keys.calendarEvents(calendar, `range-${startDate}-${endDate}`)

          const events = await this.cacheService.getOrFetch(
            cacheKey,
            async () => {
              return await this.calendarService.getEventsByDateRange(startDate, endDate, calendar)
            },
            {
              ttl: CacheService.ttl.calendarEvents,
              namespace: 'calendar',
            },
          )

          const formattedEvents = events.map((event) => ({
            summary: event.summary,
            time: this.calendarService.formatEventTime(event),
            description: event.description,
            location: event.location,
          }))

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(formattedEvents, null, 2),
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error searching meetings by date: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          }
        }
      },
    )

    // // Analysis tools
    // this.server.tool(
    // 	"summarize_meeting",
    // 	{
    // 		fileId: z.string().describe("Google Drive file ID of the meeting transcript"),
    // 	},
    // 	async ({ fileId }) => {
    // 		try {
    // 			const cacheKey = CacheService.keys.driveContent(fileId);

    // 			const data = await this.cacheService.getOrFetch(
    // 				cacheKey,
    // 				async () => {
    // 					const metadata = await this.driveService.getFileMetadata(fileId);
    // 					const text = await this.driveService.getFileContent(metadata);
    // 					return { metadata, content: text };
    // 				},
    // 				{
    // 					ttl: CacheService.ttl.fileContent,
    // 					namespace: "drive",
    // 				},
    // 			);

    // 			// Simple summary extraction (in production, you might use an AI service)
    // 			const lines = data.content.split("\n").filter((line) => line.trim());
    // 			const summary = {
    // 				title: data.metadata.name,
    // 				date: data.metadata.modifiedTime,
    // 				wordCount: data.content.split(/\s+/).length,
    // 				lineCount: lines.length,
    // 				preview: lines.slice(0, 5).join("\n"),
    // 			};

    // 			return {
    // 				content: [
    // 					{
    // 						type: "text",
    // 						text: JSON.stringify(summary, null, 2),
    // 					},
    // 				],
    // 			};
    // 		} catch (error) {
    // 			return {
    // 				content: [
    // 					{
    // 						type: "text",
    // 						text: `Error summarizing meeting: ${error instanceof Error ? error.message : String(error)}`,
    // 					},
    // 				],
    // 			};
    // 		}
    // 	},
    // );
  }
}

export default new OAuthProvider({
  apiHandler: MyMCP.mount('/sse') as any,
  apiRoute: '/sse',
  authorizeEndpoint: '/authorize',
  clientRegistrationEndpoint: '/register',
  defaultHandler: GoogleHandler as any,
  tokenEndpoint: '/token',
})
