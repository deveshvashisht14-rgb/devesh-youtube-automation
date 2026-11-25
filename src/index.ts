
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import { env } from "cloudflare:workers";

interface Env {
  YT_CLIENT_ID: string;
  YT_CLIENT_SECRET: string;
  YT_REFRESH_TOKEN: string;
}

async function getYouTubeToken() {
  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: env.YT_CLIENT_ID,
        client_secret: env.YT_CLIENT_SECRET,
        refresh_token: env.YT_REFRESH_TOKEN,
        grant_type: "refresh_token"
      })
    }
  );

  const data = await response.json() as {
    access_token?: string;
    error?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error("YouTube authentication failed: " + (data.error || response.status));
  }

  return data.access_token;
}

function createServer() {
  const server = new McpServer({
    name: "devesh-youtube-automation",
    version: "1.0.0"
  });

  server.registerTool(
    "create_kids_story_brief",
    {
      description: "Create a detailed creative brief for a 3D cartoon YouTube Kids story.",
      inputSchema: {
        theme: z.string().min(2).max(200),
        lesson: z.string().max(200).optional(),
        characters: z.string().max(300).optional()
      }
    },
    async ({ theme, lesson, characters }) => {
      const brief = `
Create an original 3D animated cartoon story for a YouTube Kids channel.

Theme: ${theme}
Moral lesson: ${lesson || "Kindness, friendship and honesty"}
Characters: ${characters || "Create 2 or 3 memorable child-friendly characters"}

Requirements:
- Duration: 3 to 5 minutes.
- Write in simple, child-friendly language.
- Include a catchy opening and a happy ending.
- Divide the story into 8 to 12 scenes.
- For every scene provide narration, dialogue,
  visual description and 3D animation prompt.
- Keep the characters visually consistent.
- Avoid violence, frightening scenes and unsafe challenges.
- Include a title, description and relevant tags.
- Make the story original.
      `;

      return {
        content: [{ type: "text", text: brief }]
      };
    }
  );

  server.registerTool(
    "check_youtube_connection",
    {
      description: "Check whether the connected YouTube account is accessible."
    },
    async () => {
      const token = await getYouTubeToken();

      const response = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json() as {
        items?: Array<{ snippet?: { title?: string } }>;
      };

      if (!response.ok) {
        throw new Error("Could not access the YouTube channel.");
      }

      const channel = data.items?.[0]?.snippet?.title || "Channel connected";

      return {
        content: [{
          type: "text",
          text: `YouTube connection successful. Channel: ${channel}`
        }]
      };
    }
  );

  server.registerTool(
    "upload_youtube_video",
    {
      description: "Upload a publicly accessible MP4 video URL to the connected YouTube channel.",
      inputSchema: {
        video_url: z.string().url(),
        title: z.string().min(1).max(100),
        description: z.string().max(5000).optional(),
        tags: z.array(z.string().max(100)).max(20).optional(),
        privacy: z.enum(["private", "unlisted", "public"]).default("private")
      }
    },
    async ({ video_url, title, description, tags, privacy }) => {
      const parsedUrl = new URL(video_url);

      if (parsedUrl.protocol !== "https:") {
        throw new Error("Video URL must use HTTPS.");
      }

      const token = await getYouTubeToken();

      const videoResponse = await fetch(video_url, {
        redirect: "error"
      });

      if (!videoResponse.ok || !videoResponse.body) {
        throw new Error("Could not download the video from the supplied URL.");
      }

      const contentType =
        videoResponse.headers.get("content-type") || "";

      if (!contentType.startsWith("video/")) {
        throw new Error("The supplied URL must return a video file.");
      }

      const metadata = {
        snippet: {
          title,
          description: description || "",
          tags: tags || [],
          categoryId: "1"
        },
        status: {
          privacyStatus: privacy,
          selfDeclaredMadeForKids: true
        }
      };

      const startUpload = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": contentType
          },
          body: JSON.stringify(metadata)
        }
      );

      if (!startUpload.ok) {
        throw new Error("YouTube upload could not be started.");
      }

      const uploadUrl = startUpload.headers.get("Location");

      if (!uploadUrl) {
        throw new Error("YouTube did not return an upload URL.");
      }

      const uploaded = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": contentType
        },
        body: videoResponse.body
      });

      const result = await uploaded.json() as {
        id?: string;
        error?: { message?: string };
      };

      if (!uploaded.ok || !result.id) {
        throw new Error(
          result.error?.message || "YouTube video upload failed."
        );
      }

      return {
        content: [{
          type: "text",
          text: `Video uploaded successfully. Video ID: ${result.id}\nhttps://www.youtube.com/watch?v=${result.id}`
        }]
      };
    }
  );

  return server;
}

const handler = createMcpHandler(createServer);

export default {
  fetch(request: Request, workerEnv: Env, ctx: ExecutionContext) {
    return handler(request, workerEnv, ctx);
  }
};
