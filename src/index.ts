import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";

const PORTFOLIO_URL =
  "https://tw-stock-api.9vt2n7nrm4.workers.dev/portfolio";

function createServer() {
  const server = new McpServer({
    name: "Taiwan Stock Live Quotes",
    version: "1.0.0",
  });

  server.registerTool(
    "get_portfolio",
    {
      description:
        "取得使用者追蹤的台股即時行情。資料直接來自使用者的 Cloudflare Worker 與 Fugle。包含南亞科2408、國巨2327、穩懋3105、禾伸堂3026的最新成交價、今日最高最低、漲跌幅、成交量、買賣報價與五檔等資訊。每次呼叫都應重新向上游取得資料，不可把舊資料當成即時行情。",
    },
    async () => {
      try {
        const url = PORTFOLIO_URL;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache, no-store",
            Pragma: "no-cache",
          },
          cf: {
            cacheEverything: false,
            cacheTtl: 0,
          },
        });

        if (!response.ok) {
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
                    requestedUrl: url,
                    responseUrl: response.url,
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
                  source: "Cloudflare Worker / Fugle",
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
  fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(
        JSON.stringify(
          {
            name: "Taiwan Stock MCP Server",
            status: "ok",
            mcpEndpoint: "/mcp",
            tools: ["get_portfolio"],
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
      return createMcpHandler(createServer)(request, env, ctx);
    }

    return new Response("Not Found", { status: 404 });
  },
};
