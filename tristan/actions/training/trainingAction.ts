import { select } from "npm:@inquirer/prompts";
import pl, { DataFrame } from "npm:nodejs-polars";
import OpenAI from "npm:openai";
import { getEmbedding } from "../embeddings/getEmbedding.ts";
import { resolve } from "jsr:@std/path";
import tiktoken from "npm:tiktoken";
import { embeddingEncoding } from "../embeddings/defaultDataPath.ts";
import { wait } from "jsr:@denosaurs/wait";
import chalk from "npm:chalk";

const defaultOutputPath = "./tristan/output";
const defaultDataFileName = "blog_data";

export function loadAndInspectDataset(dataPath: string, verbose: boolean) {
  const inputDatapath = resolve(dataPath);

  if (verbose) console.log(inputDatapath);

  // Load the dataset
  const df = pl.readCSV(inputDatapath);

  // Select specific columns
  const selectedColumns = df.select("url", "title", "text");

  // Drop rows with missing values
  const cleanedDf = selectedColumns.dropNulls();

  // Create a new column 'combined'
  const combinedDf = cleanedDf.withColumn(
    pl
      .format(
        "Title: {}; Content: {}",
        pl.col("title").str.strip(),
        pl.col("text").str.strip(),
      )
      .alias("combined"),
  );

  // Display the first 2 rows of the DataFrame
  if (verbose) console.log(combinedDf.head(2).toString());

  // Constants
  const top_n = 1000;
  const max_tokens = 8000; // You need to set this value according to your requirement

  // Initialize the encoding
  const encoding = tiktoken.get_encoding(embeddingEncoding);

  // Omit reviews that are too long to embed
  const withNumTokensDf = combinedDf.withColumn(
    pl.Series(
      "n_tokens",
      combinedDf
        .getColumn("combined")
        .toArray()
        .map((str) => encoding.encode(String(str)).length),
    ),
  );

  // Filter out rows where 'n_tokens' is greater than max_tokens
  const finalDf = withNumTokensDf
    .filter(pl.col("n_tokens").lessThanEquals(max_tokens))
    .tail(top_n);

  if (verbose) console.log(`Length of DataFrame: ${finalDf.height}`);

  return finalDf;
}

async function getEmbeddingsAndSaveToCsv(
  client: OpenAI,
  df: DataFrame,
  fileName: string,
  verbose: boolean,
) {
  if (verbose) console.log("Getting embeddings");

  const spinner = wait("Generating embeddings").start();
  const embeddingData = await Promise.all(
    df
      .getColumn("combined")
      .toArray()
      .map((str) => getEmbedding(client, String(str))),
  );
  spinner.text = "Writing embeddings to csv";
  const formattedEmbeddingData = embeddingData.map((data) =>
    JSON.stringify(data),
  );
  const withEmbeddings = df.withColumn(
    pl.Series("embedding", formattedEmbeddingData),
  );
  withEmbeddings.writeCSV(resolve(defaultOutputPath, fileName));
  spinner.stop();
  console.log(chalk.green(`Embeddings written to ${fileName}`));
}

async function generateEmbeddingsForRag(fileName: string, verbose: boolean) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  const client = new OpenAI({
    apiKey,
  });
  const fileNameCsv = fileName.includes(".csv") ? fileName : fileName + ".csv";
  const outputFileNameCsv =
    fileName.replace(".csv", "") + "_with_embeddings.csv";
  const path = resolve(defaultOutputPath, fileNameCsv);
  const data = loadAndInspectDataset(path, verbose);
  await getEmbeddingsAndSaveToCsv(client, data, outputFileNameCsv, verbose);
}

export async function trainingAction({
  verbose,
  fileName,
}: {
  verbose: boolean;
  fileName: string | undefined;
}) {
  const trainingType = await select({
    message: "What kind of training would you like to do?",
    choices: [
      {
        name: "RAG",
        value: "rag",
        description: "Generate embeddings for RAG and save to csv",
      },
      {
        name: "Fine Tuning",
        value: "fineTuning",
        description:
          "Generate Fine Tuned model from csv data (not implemented)",
      },
    ],
  });

  switch (trainingType) {
    case "rag":
      await generateEmbeddingsForRag(fileName || defaultDataFileName, verbose);
      return;
    default:
      console.log("Sorry, that option isn't ready yet");
  }
}
