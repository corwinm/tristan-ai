import OpenAI from "npm:openai";
import pl from "npm:nodejs-polars";
import { wait } from "jsr:@denosaurs/wait";
import chalk from "npm:chalk";
import { cosineSimilarity } from "../../utilities/cosineSimilarity.ts";
import { input, select } from "npm:@inquirer/prompts";
import { getEmbedding } from "../embeddings/getEmbedding.ts";
import { defaultDataFileName } from "../training/defaultDataFileName.ts";
import { resolve } from "jsr:@std/path";
import { defaultOutputPath } from "../training/defaultOutputPath.ts";

export async function semanticTextSearchUsingEmbeddings(
  prompt: string,
  dataWithEmbeddingsPath: string,
  openai: OpenAI,
  verbose: boolean,
) {
  const data = pl.readCSV(dataWithEmbeddingsPath, { quoteChar: '"' });

  const matrix: number[][] = data
    .getColumn("embedding")
    .toArray()
    .map((row) => {
      return JSON.parse(String(row));
    });

  const dataWithParsedEmbeddings = data.withColumn(
    pl.Series(matrix).alias("embedding"),
  );

  const spinner = wait("Generating Embedding...").start();
  const promptEmbedding = await getEmbedding(openai, prompt);
  const dfWithSimilarity = dataWithParsedEmbeddings.withColumn(
    pl.Series(
      "similarity",
      dataWithParsedEmbeddings
        .getColumn("embedding")
        .toArray()
        .map((x) =>
          // Force case to number array
          cosineSimilarity(x as unknown as number[], promptEmbedding),
        ),
    ),
  );
  const results = dfWithSimilarity
    .sort("similarity", true)
    .head(3)
    .getColumn("combined")
    .toArray()
    .map((combined) =>
      String(combined).replace("Title: ", "").replace("; Content:", ": "),
    );
  spinner.stop();

  if (verbose) {
    console.log(chalk.bold("\nTop Results:\n"));
    results.forEach((result) => console.log(result, "\n"));
  }
  return results;
}

async function generateBlogPost(
  prompt: string,
  relatedData: string[],
  client: OpenAI,
  verbose: boolean,
) {
  const spinner = wait("Generating Blog Post...").start();
  const context = relatedData.join("\n\n---\n\n");
  const result = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You will be given a list of example blog posts. Given a new blog post title, generate a new blog post for that title in markdown format.",
      },
      {
        role: "user",
        content: `Examples: ${context}\n\n---\n\nBlog Post Title: ${prompt}\nBlog Post:`,
      },
    ],
    temperature: 0,
    max_tokens: 1000,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });
  if (verbose) console.log(result.choices[0].message.content);
  spinner.stop();
  return result.choices[0].message.content;
}

async function savePost(
  fileName: string,
  postContent: string,
  verbose: boolean,
) {
  const blogPostPath = resolve(defaultOutputPath, fileName + ".md");

  const spinner = wait("Saving Blog Post...").start();
  await Deno.writeTextFile(blogPostPath, postContent);
  spinner.stop();
  console.log("New blog post saved! ", verbose ? blogPostPath : "");
  return blogPostPath;
}

async function isCodeInstalled(verbose: boolean) {
  try {
    if (verbose) console.log("Checking for VSCode");

    const process = new Deno.Command("which", { args: ["code"] });

    const { code } = await process.output();

    const codeInstalled = code === 0;

    if (verbose)
      console.log(
        codeInstalled ? "VSCode is installed" : "VSCode is not installed",
      );
    return codeInstalled;
  } catch (error) {
    console.error("Error checking for VSCode:", error);
    return false;
  }
}

async function isNeovimInstalled(verbose: boolean) {
  try {
    if (verbose) console.log("Checking for Neovim");

    const process = new Deno.Command("which", { args: ["nvim"] });

    const { code } = await process.output();

    const neovimInstalled = code === 0;

    if (verbose)
      console.log(
        neovimInstalled ? "Neovim is installed" : "Neovim is not installed",
      );
    return neovimInstalled;
  } catch (error) {
    console.error("Error checking for VSCode:", error);
    return false;
  }
}

async function openInEditor(path: string, verbose: boolean) {
  const hasVSCode = await isCodeInstalled(verbose);
  const hasNeovim = await isNeovimInstalled(verbose);
  const openType = await select({
    message: "How do you want to open your blog post?",
    choices: [
      {
        name: "Neovim",
        value: "nvim",
        disabled: !hasNeovim,
      },
      {
        name: "VSCode",
        value: "code",
        disabled: !hasVSCode,
      },
      { name: "Nah! I'm good", value: "" },
    ],
  });
  if (!openType) {
    console.log(chalk.red("Ok, well it was fun writing about that anyway!"));
    return;
  }
  try {
    if (verbose) console.log("Opening blog post with ", openType);

    const process = new Deno.Command(openType, {
      args: [path],
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    });

    const { code } = await process.output();

    const result = code === 0;

    if (verbose) console.log(result ? "Success" : "Failure");
  } catch (error) {
    console.error("Error opening blog post:", error);
  }
}

export async function blogAction({
  verbose,
  fileName,
}: {
  verbose: boolean;
  fileName: string | undefined;
}) {
  console.log(
    "Sure, I would be happy to help you get started with your new blog post!",
  );
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  const client = new OpenAI({
    apiKey,
  });
  const blogDescription = await input({
    message: "What do you want to write about?",
    default: "My first CLI with Deno 2.0",
  });
  if (!blogDescription) {
    console.log(chalk.red("Ok, maybe next time."));
    return;
  }
  const fileNameOrDefault = fileName || defaultDataFileName;
  const outputFileNameCsv =
    fileNameOrDefault.replace(".csv", "") + "_with_embeddings.csv";
  const path = resolve(defaultOutputPath, outputFileNameCsv);
  const relatedData = await semanticTextSearchUsingEmbeddings(
    blogDescription,
    path,
    client,
    verbose,
  );
  const blogPost = await generateBlogPost(
    blogDescription,
    relatedData,
    client,
    verbose,
  );
  if (!blogPost) {
    console.log(
      chalk.red(
        "Something went wrong and I couldn't get a blog post, must be writers block!",
      ),
    );
    return;
  }
  const blogPostAbsolutePath = await savePost(
    blogDescription,
    blogPost,
    verbose,
  );
  await openInEditor(blogPostAbsolutePath, verbose);
}
