import OpenAI from "npm:openai";
import pl, { DataFrame } from "npm:nodejs-polars";
import tiktoken from "npm:tiktoken";
import { resolve } from "jsr:@std/path";
import { wait } from "jsr:@denosaurs/wait";
import open from "npm:open";
import chalk from "npm:chalk";

const embeddingEncoding = "cl100k_base";
const defaultDataPath = "./tristan/data/fine_food_reviews_1k.csv";
const defaultEmbeddingsPath =
  "./tristan/output/fine_food_reviews_with_embeddings_1k.csv";

async function getEmbedding(
  client: OpenAI,
  text: string,
  model = "text-embedding-3-small",
  params: OpenAI.EmbeddingCreateParams | null = null,
) {
  const input = text.replace("\n", " ");
  const response = await client.embeddings.create({ input, model, ...params });
  return response.data[0].embedding;
}

function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must be the same length");
  }

  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function norm(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProd = dotProduct(a, b);
  const normA = norm(a);
  const normB = norm(b);

  return dotProd / (normA * normB);
}

function loadAndInspectDataset() {
  const inputDatapath = resolve(defaultDataPath); // to save space, we provide a pre-filtered dataset

  console.log(inputDatapath);
  // Load the dataset
  const df = pl.readCSV(inputDatapath);

  // Select specific columns
  const selectedColumns = df.select(
    "Time",
    "ProductId",
    "UserId",
    "Score",
    "Summary",
    "Text",
  );

  // Drop rows with missing values
  const cleanedDf = selectedColumns.dropNulls();

  // Create a new column 'combined'
  const combinedDf = cleanedDf.withColumn(
    pl
      .format(
        "Title: {}; Content: {}",
        pl.col("Summary").str.strip(),
        pl.col("Text").str.strip(),
      )
      .alias("combined"),
  );

  // Display the first 2 rows of the DataFrame
  console.log(combinedDf.head(2).toString());

  // Constants
  const top_n = 1000;
  const max_tokens = 8000; // You need to set this value according to your requirement

  // Subsample to 1k most recent reviews
  const sortedDf = combinedDf.sort("Time").tail(top_n * 2); // First cut to first 2k entries, assuming less than half will be filtered out

  // Drop the 'Time' column
  const withoutTimeDf = sortedDf.drop("Time");

  // Initialize the encoding
  const encoding = tiktoken.get_encoding(embeddingEncoding);

  // Omit reviews that are too long to embed
  const withNumTokensDf = withoutTimeDf.withColumn(
    pl.Series(
      "n_tokens",
      withoutTimeDf
        .getColumn("combined")
        .toArray()
        .map((str) => encoding.encode(String(str)).length),
    ),
  );

  // Filter out rows where 'n_tokens' is greater than max_tokens
  const finalDf = withNumTokensDf
    .filter(pl.col("n_tokens").lessThanEquals(max_tokens))
    .tail(top_n);

  console.log(`Length of DataFrame: ${finalDf.height}`);

  return finalDf;
}

async function getEmbeddingsAndSaveToCsv(client: OpenAI, df: DataFrame) {
  const embeddingData = await Promise.all(
    df
      .getColumn("combined")
      .toArray()
      .map((str) => getEmbedding(client, String(str))),
  );
  const formattedEmbeddingData = embeddingData.map((data) =>
    JSON.stringify(data),
  );
  const withEmbeddings = df.withColumn(
    pl.Series("embedding", formattedEmbeddingData),
  );
  withEmbeddings.writeCSV(resolve(defaultEmbeddingsPath));
}

function dataSetExists() {
  const info = Deno.lstatSync(resolve(defaultEmbeddingsPath));
  return info;
}

async function obtainDataSet(openai: OpenAI) {
  const hasDataSet = dataSetExists();
  if (hasDataSet) {
    console.log("Existing data set with embeddings found.");
    const regenerateEmbeddings = confirm(
      "Do you want to regenerate the embeddings?",
    );
    if (!regenerateEmbeddings) {
      console.log(chalk.blue("Using existing embeddings."));
      return;
    }
  }
  try {
    const dataSet = loadAndInspectDataset();
    getEmbeddingsAndSaveToCsv(openai, dataSet);

    const embedding = await getEmbedding(openai, "Hi");
    console.log("Embedding for 'Hi':", embedding);
  } catch (error) {
    console.error("Error generating embedding:", error);
  }
}

function visualizingEmbeddings2D() {
  const loadViz = confirm("Do you want to generate the data visualization?");
  if (!loadViz) {
    console.log(chalk.green("Skipping data visualization"));
    return;
  }

  const spinner = wait("Loading embeddings").start();

  const worker = new Worker(
    new URL("./embedding-vis-worker.ts", import.meta.url).href,
    { type: "module" },
  );
  worker.onmessage = async (event) => {
    if (event.data?.data) {
      spinner.text = event.data.data;
    }
    if (event.data.url) {
      await open(event.data.url, { app: { name: "browser" } });

      spinner.stop();
    }
  };
  worker.postMessage({ filename: defaultEmbeddingsPath });
}

async function semanticTextSearchUsingEmbeddings(openai: OpenAI) {
  const data = pl.readCSV(defaultEmbeddingsPath, { quoteChar: '"' });

  const matrix: number[][] = data
    .getColumn("embedding")
    .toArray()
    .map((row) => {
      return JSON.parse(String(row));
    });

  const dataWithParsedEmbeddings = data.withColumn(
    pl.Series(matrix).alias("embedding"),
  );

  const productDescription = prompt(
    "Search product description:",
    "delicious beans",
  );
  if (!productDescription) {
    return;
  }
  const spinner = wait("Generating Embedding...").start();
  const productEmbedding = await getEmbedding(openai, productDescription);
  const dfWithSimilarity = dataWithParsedEmbeddings.withColumn(
    pl.Series(
      "similarity",
      dataWithParsedEmbeddings
        .getColumn("embedding")
        .toArray()
        .map((x) =>
          // Force case to number array
          cosineSimilarity(x as unknown as number[], productEmbedding),
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

  console.log(chalk.bold("\nTop Results:\n"));
  results.forEach((result) => console.log(result, "\n"));
  return results;
}

export async function embeddingsAction() {
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  const openai = new OpenAI({
    apiKey,
  });

  await obtainDataSet(openai);

  visualizingEmbeddings2D();

  semanticTextSearchUsingEmbeddings(openai);
}
