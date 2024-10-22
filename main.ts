import { Command } from "npm:commander";
import { haikuAction } from "./tristan/actions/haiku.ts";
import { embeddingsAction } from "./tristan/actions/embeddings.ts";
import { logo } from "./tristan/logo.ts";
import chalk from "npm:chalk";

const program = new Command()
  .version("1.0.0")
  .name("tristan-ai")
  .description(
    [
      logo,
      "",
      `A command line utility in TypeScript against the latest versions of libraries and packages, as of 2024-10-01.`,
      "",
      chalk.red(`IMPORTANT:`),
      `  You must have your OPENAI_API_KEY set in your environment for the OpenAI client to function.`,
      ,
    ].join("\n"),
  );

program
  .command("haiku [topic]")
  .description("Generate a haiku about the provided topic")
  .action(haikuAction);

program
  .command("embeddings")
  .description("Generate and use embeddings")
  .action(embeddingsAction);

if (import.meta.main) {
  program.parse();
}
