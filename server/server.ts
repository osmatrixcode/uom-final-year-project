import "dotenv/config";
import express from "express";
import { createAgent, tool } from "langchain";
import * as z from "zod";

const app = express();
const PORT = 3000;

app.use(express.json());

const getWeather = tool((input) => `It's always sunny in ${input.city}!`, {
  name: "get_weather",
  description: "Get the weather for a given city",
  schema: z.object({
    city: z.string().describe("The city to get the weather for"),
  }),
});

const agent = createAgent({
  model: "openai:gpt-5-mini",
  tools: [getWeather],
});

// Simple GET route for browser testing
app.get("/chat", async (req, res) => {
  // Access data from URL (e.g., /chat?message=Hi)
  const userMessage = req.query.message as string;

  if (!userMessage) {
    return res.status(400).send("Please provide a ?message= query parameter");
  }

  // Set headers for simple text streaming
  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  const stream = await agent.stream(
    { messages: [{ role: "user", content: userMessage }] },
    { streamMode: "messages" },
  );

  for await (const [chunk] of stream) {
    if (chunk.content) res.write(chunk.content);
  }

  res.end();
});

app.listen(PORT, () =>
  console.log(`🚀 Open: http://localhost:${PORT}/chat?message=Hello`),
);
