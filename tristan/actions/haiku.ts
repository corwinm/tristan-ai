import OpenAI from "npm:openai";

export async function haikuAction(topic: string = "recursion in programming") {
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  const openai = new OpenAI({
    apiKey,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: `Write a haiku about ${topic}.` },
      ],
    });

    console.log(completion.choices[0].message?.content);
  } catch (error) {
    console.error("Error generating haiku:", error);
  }
}
