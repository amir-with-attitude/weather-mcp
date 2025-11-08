import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// 1) MCP server with one tool
const mcp = new McpServer(
  { name: "weather-mcp", version: "1.0.0" },
  { capabilities: { logging: {} } }
);

// Register `get_weather(city)`
mcp.registerTool(
  "get_weather",
  {
    title: "Get Weather",
    description: "Returns current temperature (°C) and a short description for a city.",
    inputSchema: { city: z.string().describe("City name") }
  },
  async ({ city }) => {
    // Geocode
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
    ).then(r => r.json());

    if (!geo?.results?.length) {
      return { content: [{ type: "text", text: `City not found: ${city}` }] };
    }
    const { latitude, longitude, name } = geo.results[0];

    // Weather
    const wx = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
    ).then(r => r.json());

    const cur = wx.current_weather;
    const codes = { 0: "clear", 1: "mainly clear", 2: "partly cloudy", 3: "overcast", 61: "light rain", 63: "rain", 65: "heavy rain", 71: "snow", 80: "rain showers" };
    const desc = codes[Number(cur.weathercode)] ?? `weather code ${cur.weathercode}`;
    const text = `In ${name}, it is ${cur.temperature}°C and ${desc}.`;

    return { content: [{ type: "text", text }] };
  }
);

// 2) HTTP endpoint for Streamable HTTP
const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true // no SSE needed
  });
  res.on("close", () => transport.close());
  await mcp.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const port = 3000;
app.listen(port, () => {
  console.log(`✅ Weather MCP running at /mcp on :${port}`);
});
