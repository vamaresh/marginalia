export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: "Missing OPENAI_API_KEY environment variable. Add it in your Vercel project settings.",
    });
    return;
  }

  const { model, max_tokens, messages } = req.body || {};

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "gpt-4o-mini",
        max_tokens: max_tokens || 1000,
        messages: messages || [],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      res.status(response.status).json({ error: data.error?.message || "OpenAI request failed" });
      return;
    }

    // Reshape OpenAI's response into the { content: [{ type, text }] } form the client expects.
    const text = data.choices?.[0]?.message?.content ?? "";
    res.status(200).json({ content: [{ type: "text", text }] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
