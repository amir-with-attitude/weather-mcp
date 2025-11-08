// weather-mcp.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

// Simple MCP spec endpoint
app.get("/", (req, res) => {
  res.json({
    tools: [
      {
        name: "get_weather",
        description: "Get current temperature and weather description for a given city.",
        parameters: {
          type: "object",
          properties: {
            city: { type: "string" }
          },
          required: ["city"]
        }
      }
    ]
  });
});

// Tool endpoint
app.post("/tools/get_weather", async (req, res) => {
  const { city } = req.body.arguments;
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}`
  );
  const geoData = await geoRes.json();

  if (!geoData.results || geoData.results.length === 0) {
    return res.json({ content: [{ type: "text", text: `City not found: ${city}` }] });
  }

  const { latitude, longitude } = geoData.results[0];
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
  );
  const weatherData = await weatherRes.json();
  const w = weatherData.current_weather;

  res.json({
    content: [
      {
        type: "text",
        text: `In ${city}, it is ${w.temperature}°C with ${w.weathercode} (code).`
      }
    ]
  });
});

app.listen(3000, () => console.log("✅ MCP Weather server running on port 3000"));
