import { Command } from "npm:commander";
import { haikuAction } from "./tristan/actions/haiku.ts";
import { embeddingsAction } from "./tristan/actions/embeddings/embeddingsAction.ts";
import { logo } from "./tristan/logo.ts";
import chalk from "npm:chalk";
import { crawlerAction } from "./tristan/actions/crawler/crawlerAction.ts";
import { trainingAction } from "./tristan/actions/training/trainingAction.ts";
import { blogAction } from "./tristan/actions/blog/blogAction.ts";

const program = new Command()
  .version("1.0.0")
  .name("tristan")
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

program
  .command("crawl")
  .description("Crawl website and generate csv data")
  .option("-v, --verbose", "Enable verbose output")
  .action(crawlerAction);

program
  .command("train")
  .description(
    "Use crawling data to generate embeddings for RAG or a Fine Tuned model",
  )
  .option("-v, --verbose", "Enable verbose output")
  .option(
    "-f, --file <fileName>",
    "Override source file name. e.g. my_data.csv or just my_data",
  )
  .action(trainingAction);

program
  .command("blog")
  .description("Use prepared training data to generate blog posts using RAG.")
  .option("-v, --verbose", "Enable verbose output")
  .option(
    "-f, --file <fileName>",
    "Override source file name. e.g. my_data.csv or just my_data",
  )
  .action(blogAction);

if (import.meta.main) {
  program.parse();
}
