import { Command } from "npm:commander";
import { haikuAction } from "./tristan/actions/haiku.ts";

const program = new Command()
  .version("1.0.0")
  .name("tristan-ai")
  .description(
    [
      `A command line utility in TypeScript against the latest versions of libraries and packages, as of 2024-10-01.`,
      `IMPORTANT: You must have your OPENAI_API_KEY set in your environment for the OpenAI client to function.`,
    ].join("\n"),
  );

program
  .command("test <test>")
  .description("This is a test")
  .action((test) => {
    console.log("This is a test:", test);
  });

program
  .command("haiku [topic]")
  .description("Generate a haiku about the provided topic")
  .action(haikuAction);

if (import.meta.main) {
  program.parse();
}
