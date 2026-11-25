
# Devesh YouTube Automation

A Claude MCP server for YouTube Kids content workflows.

## Features

- Create original 3D cartoon story briefs.
- Generate scene-by-scene animation prompts through Claude.
- Check YouTube account connection.
- Upload an existing video using a direct HTTPS video URL.
- Set title, description, tags and privacy.
- Declare uploaded videos as made for kids.

## Deployment

1. Install dependencies using npm install.
2. Deploy using npm run deploy.
3. Configure YouTube OAuth secrets in Cloudflare.
4. Connect the deployed MCP URL to Claude.

## Required Cloudflare Secrets

- YT_CLIENT_ID
- YT_CLIENT_SECRET
- YT_REFRESH_TOKEN

Never put OAuth credentials in GitHub files.

## YouTube API

Enable YouTube Data API v3 in Google Cloud.
Use OAuth 2.0 with the youtube.upload scope.

## Important

The video upload tool requires an existing, publicly accessible
HTTPS video file URL. This project does not itself render MP4
cartoon videos. A video-generation service must produce the
MP4 before it can be uploaded.
