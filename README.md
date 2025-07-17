# Meetings MCP Server

A comprehensive Model Context Protocol (MCP) server that provides read-only access to Google Drive meeting transcripts and Google Calendar events. This server enables AI assistants to search through meeting documents, analyze transcripts, and access calendar information to provide intelligent meeting insights.

## Features

### 🗂️ Google Drive Integration
- **Search Meeting Transcripts**: Full-text search across all meeting documents in a shared folder
- **Get Meeting Content**: Retrieve complete transcript content from Google Docs
- **List Recent Meetings**: Browse the most recently modified meeting documents
- **Meeting Summaries**: Generate basic summaries of meeting transcripts

### 📅 Google Calendar Integration
- **Upcoming Meetings**: View scheduled meetings with attendee counts and details
- **Meeting Attendees**: Get detailed attendee information for specific meetings
- **Date Range Search**: Find meetings within specific date ranges
- **Historical Analysis**: Access past meeting data for trend analysis

### 🚀 Performance & Security
- **Intelligent Caching**: KV-based caching to minimize API calls and improve response times
- **Read-Only Access**: All operations use read-only Google API scopes for maximum security
- **OAuth 2.0 Authentication**: Secure authentication flow with Google OAuth
- **Error Handling**: Comprehensive error handling with user-friendly messages

## Prerequisites

- Node.js 20 or higher
- Cloudflare Workers account
- Google Cloud Console project with API access
- Google Drive folder with meeting transcripts
- Google Calendar access

## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/meetings-mcp.git
cd meetings-mcp
npm install
```

### 2. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google Drive API
   - Google Calendar API
   - Google Docs API
4. Create OAuth 2.0 credentials:
   - Go to Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs: `https://your-worker-domain.workers.dev/callback`

### 3. Environment Configuration

Update `wrangler.jsonc` with your configuration:

```json
{
  "vars": {
    "GOOGLE_CLIENT_ID": "your-google-client-id",
    "GOOGLE_CLIENT_SECRET": "your-google-client-secret",
    "COOKIE_ENCRYPTION_KEY": "your-32-byte-base64-key",
    "GOOGLE_DRIVE_FOLDER_ID": "your-shared-folder-id",
    "GOOGLE_CALENDAR_ID": "primary"
  }
}
```

### 4. Get Your Google Drive Folder ID

1. Open Google Drive in your browser
2. Navigate to your shared meetings folder
3. The folder ID is the last part of the URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`

### 5. Deploy to Cloudflare Workers

```bash
npm run deploy
```

## Development

### Local Development

```bash
npm run dev
```

The server will be available at `http://localhost:8787`

### Type Checking

```bash
npm run type-check
```

### Project Structure

```
src/
├── index.ts                      # Main MCP server with all tools
├── google-handler.ts             # OAuth authentication handler
├── utils.ts                      # Utility functions
├── workers-oauth-utils.ts        # OAuth helper functions
├── services/
│   ├── google-drive.service.ts   # Google Drive API wrapper
│   ├── google-calendar.service.ts # Google Calendar API wrapper
│   └── cache.service.ts          # KV caching utilities
└── types/
    └── env.d.ts                  # Environment type definitions
```

## Available MCP Tools

### Drive Tools

#### `search_meeting_transcripts`
Search across all meeting documents in the configured folder.

**Parameters:**
- `query` (string): Search query to find in meeting transcripts
- `folderId` (string, optional): Google Drive folder ID to search in

**Example:**
```json
{
  "query": "quarterly goals",
  "folderId": "1A0n63cvNloB_h7c6SQpP0R8kzmZMOL9D"
}
```

#### `get_meeting_transcript`
Retrieve the full content of a specific meeting transcript.

**Parameters:**
- `fileId` (string): Google Drive file ID of the meeting transcript

#### `list_recent_meetings`
List the most recently modified meeting documents.

**Parameters:**
- `folderId` (string, optional): Google Drive folder ID
- `limit` (number, optional): Number of recent meetings to return (default: 10)

### Calendar Tools

#### `get_upcoming_meetings`
Get upcoming meetings with details and attendee counts.

**Parameters:**
- `daysAhead` (number, optional): Number of days ahead to look for meetings (default: 7)
- `calendarId` (string, optional): Google Calendar ID

#### `get_meeting_attendees`
Get detailed attendee information for a specific meeting.

**Parameters:**
- `eventId` (string): Google Calendar event ID
- `calendarId` (string, optional): Google Calendar ID

#### `search_meetings_by_date`
Find meetings within a specific date range.

**Parameters:**
- `startDate` (string): Start date (YYYY-MM-DD)
- `endDate` (string): End date (YYYY-MM-DD)
- `calendarId` (string, optional): Google Calendar ID

## Usage with Claude Desktop

1. Add the MCP server to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "meetings": {
      "command": "node",
      "args": ["path/to/meetings-mcp"],
      "env": {
        "GOOGLE_CLIENT_ID": "your-client-id",
        "GOOGLE_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

2. Restart Claude Desktop
3. The meeting tools will be available in your Claude conversations

## API Rate Limits & Caching

The server implements intelligent caching to minimize API calls:

- **File Lists**: 5 minutes TTL
- **File Content**: 1 hour TTL
- **Calendar Events**: 5 minutes TTL
- **File Metadata**: 10 minutes TTL

## Security Considerations

- All API operations use read-only scopes
- OAuth tokens are securely stored and encrypted
- No ability to modify documents or calendar events
- All API calls are logged for audit purposes

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## Deployment

### Automatic Deployment

The project includes a GitHub Actions workflow that automatically deploys to Cloudflare Workers when you push to the main branch.

**Required GitHub Secrets:**
- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

### Manual Deployment

```bash
npm run deploy
```

## Troubleshooting

### Common Issues

1. **OAuth Redirect URI Mismatch**
   - Ensure your redirect URI in Google Cloud Console matches your worker domain
   - Format: `https://your-worker.workers.dev/callback`

2. **Folder Not Found**
   - Verify your `GOOGLE_DRIVE_FOLDER_ID` is correct
   - Ensure the service account has access to the folder

3. **API Rate Limits**
   - The server implements caching to minimize API calls
   - If you hit rate limits, increase cache TTL values

4. **Authentication Issues**
   - Re-authenticate if you've changed OAuth scopes
   - Check that all required APIs are enabled in Google Cloud Console

### Debug Mode

For local development, you can enable debug logging by setting:

```bash
export DEBUG=meetings-mcp:*
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For questions and support:
- Open an issue on GitHub
- Check the [troubleshooting section](#troubleshooting)
- Review the [Google APIs documentation](https://developers.google.com/docs)

## Acknowledgments

- [Model Context Protocol](https://github.com/modelcontextprotocol/specification)
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Google APIs](https://developers.google.com/apis-explorer)
- [Claude Desktop](https://claude.ai/desktop)