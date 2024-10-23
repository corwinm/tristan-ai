import { resolve } from "jsr:@std/path";
import { defaultDataPath, embeddingEncoding } from "./defaultDataPath.ts";
import pl from "npm:nodejs-polars";
import tiktoken from "npm:tiktoken";

export function loadAndInspectDataset() {
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
