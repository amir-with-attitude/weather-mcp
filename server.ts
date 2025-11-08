import { createServer } from "http";
import { fetch } from "undici";
import {
  Server as McpServer,
  Tool,
} from "@modelcontextprotocol/sdk/server/index.js";
import {
  StreamableHttpServerTransport,
} from "@modelcontextprotocol/sdk/server/streamable-http.js";

// 1) Define the weather tool
const getWeather: Tool = {
  name: "get_weather",
  description: "Get current temperature (°C) and a short description for a city.",
  inputSchema: {
    type: "object",
    properties: { city: { type: "string", description: "City name" } },
    required: ["city"],
  },
  handler: async ({ city }) => {
    // Geocode
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        city
      )}&count=1`
    ).then((r) => r.json());

    if (!geo.results?.length) {
      return { content: [{ type: "text", text: `City not found: ${city}` }] };
    }
    const { latitude, longitude, name } = geo.results[0];

    // Weather
    const wx = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
    ).then((r) => r.json());

    const cur = wx.current_weather;
    const code = Number(cur.weathercode);
    const mapping: Record<number, string> = {
      0: "clear",
      1: "mainly clear",
      2: "partly cloudy",
      3: "overcast",
      45: "fog",
      48: "rime fog",
      51: "light drizzle",
      61: "light rain",
      63: "rain",
      65: "heavy rain",
      71: "snow",
      80: "rain showers"
      // (trimmed; add more codes as needed)
    };

    const desc = mapping[code] ?? `weather code ${code}`;
    const text = `In ${name}, it is ${cur.temperature}°C and ${desc}.`;

    return { content: [{ type: "text", text }] };
  },
};

// 2) Create the MCP server and register the tool
const mcp = new McpServer(
  { name: "weather-mcp", version: "1.0.0" },
  { tools: { [getWeather.name]: getWeather } }
);

// 3) Bind a single Streamable HTTP endpoint (/mcp)
const httpServer = createServer(async (req, res) => {
  // Basic CORS for browser-based clients
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Only handle the MCP endpoint; everything else 404
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  if (url.pathname !== "/mcp") {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  // Hand off to the MCP Streamable HTTP transport
  const transport = new StreamableHttpServerTransport("/mcp");
  await transport.handleRequest(mcp, req, res);
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`✅ MCP server listening on :${PORT} at /mcp`);
});
