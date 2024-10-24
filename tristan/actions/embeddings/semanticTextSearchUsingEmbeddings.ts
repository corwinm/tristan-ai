import OpenAI from "npm:openai";
import pl from "npm:nodejs-polars";
import { wait } from "jsr:@denosaurs/wait";
import chalk from "npm:chalk";
import { cosineSimilarity } from "../../utilities/cosineSimilarity.ts";
import { getEmbedding } from "./getEmbedding.ts";
import { defaultEmbeddingsPath } from "./defaultDataPath.ts";

export async function semanticTextSearchUsingEmbeddings(openai: OpenAI) {
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
    console.log(chalk.green("Skipping search product description"));
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
