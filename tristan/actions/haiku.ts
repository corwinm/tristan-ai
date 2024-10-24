import OpenAI from "npm:openai";
import chalk from "npm:chalk";

export async function haikuAction(topic?: string) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  const openai = new OpenAI({
    apiKey,
  });

  if (!topic) {
    const userInput = prompt("Haiku topic?", "recursion in programming");
    if (!userInput) {
      console.log(chalk.red("No topic! No haiku!"));
      return;
    }
    topic = userInput;
  }

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
