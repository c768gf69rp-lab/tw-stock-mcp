import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { env } from "cloudflare:workers";

interface Env {
  STOCK_API: Fetcher;
}

function createServer() {
  const server = new McpServer({
    name: "Taiwan Stock Live Quotes",
    version: "1.0.0",
  });

  server.registerTool(
    "get_portfolio",
    {
      description:
        "取得使用者追蹤的台股即時行情。資料直接來自 Cloudflare Worker 與 Fugle，包含南亞科2408、國巨2327、穩懋3105、禾伸堂3026。",
    },
    async () => {
      try {
        const response = await (env as Env).STOCK_API.fetch(
          new Request("https://internal/portfolio", {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          })
        );

        if (!response.ok) {
          const responseBody = await response.text();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: "Upstream portfolio request failed",
                    status: response.status,
                    statusText: response.statusText,
                    responseBody,
                    fetchedAt: new Date().toISOString(),
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        const data = await response.json();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  source: "Cloudflare Service Binding / Fugle",
                  mcpFetchedAt: new Date().toISOString(),
                  data,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : String(error),
                  fetchedAt: new Date().toISOString(),
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

export default {
  fetch(request: Request, workerEnv: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(
        JSON.stringify(
          {
            name: "Taiwan Stock MCP Server",
            status: "ok",
            mcpEndpoint: "/mcp",
            tools: ["get_portfolio"],
            serviceBinding: "STOCK_API",
          },
          null,
          2
        ),
        {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        }
      );
    }

    if (url.pathname === "/mcp") {
      return createMcpHandler(createServer)(request, workerEnv, ctx);
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
