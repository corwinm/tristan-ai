import OpenAI from "npm:openai";
import pl, { DataFrame } from "npm:nodejs-polars";
import { wait } from "jsr:@denosaurs/wait";
import chalk from "npm:chalk";
import { kmeans } from "npm:ml-kmeans";
import { confirm } from "npm:@inquirer/prompts";
import { defaultEmbeddingsPath } from "./defaultDataPath.ts";

const clusters = 4;

function findCludtersUsingKMeans(df: DataFrame) {
  const embeddings = df
    .getColumn("embedding")
    .toArray() as unknown as number[][];

  const kMeans = kmeans(embeddings, clusters, { seed: 42 });

  const withClusters = df.withColumn(pl.Series("Cluster", kMeans.clusters));
  console.log(withClusters.tail(3).toString());

  const scores = withClusters.getColumn("Score").toArray();

  const dfGroupedByCluster = withClusters.groupBy("Cluster").groups();
  const groups = (
    dfGroupedByCluster.getColumn("groups").toArray() as unknown as number[][]
  ).map((group: number[]) => {
    return (
      group.map((index) => Number(scores[index])).reduce((a, b) => a + b, 0) /
      group.length
    );
  });
  const dfSortedByMean = dfGroupedByCluster
    .withColumn(pl.Series("mean", groups))
    .sort("mean");
  const dfSortedForDisplay = dfSortedByMean.drop("groups");
  console.log(dfSortedForDisplay.toString());

  return withClusters;
}

export async function kMeansClustering(openai: OpenAI) {
  const generateSummaryOfClusters = await confirm({
    message: "Generate summary of clusters?",
  });
  if (!generateSummaryOfClusters) {
    console.log(chalk.green("Skipping summary of clusters."));
    return;
  }

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

  const dfWithClusters = findCludtersUsingKMeans(dataWithParsedEmbeddings);

  const rev_per_cluster = 5;

  const dfdf = dfWithClusters;

  for (let i = 0; i < clusters; i++) {
    const clusterData = dfdf.filter(pl.col("Cluster").eq(i));
    const reviews = clusterData
      .getColumn("combined")
      .sample({ n: rev_per_cluster, seed: 42 })
      .toArray()
      .map((text) =>
        String(text).replace("Title: ", "").replace("\n\nContent: ", ": "),
      )
      .join("\n");

    const spinner = wait("Generating Summary...").start();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `What do the following customer reviews have in common?\n\nCustomer reviews:\n"""\n${reviews}\n"""\n\nTheme:`,
        },
      ],
      // temperature: 0,
      // max_tokens: 64,
      // top_p: 1,
      // frequency_penalty: 0,
      // presence_penalty: 0,
    });
    spinner.stop();

    console.log(`Cluster ${i} Theme:`, " ");
    console.log(response.choices[0]?.message?.content?.replace("\n", ""));

    const sample_cluster_rows = clusterData.sample({
      n: rev_per_cluster,
      seed: 42,
    });

    for (let j = 0; j < rev_per_cluster; j++) {
      console.log(
        [
          sample_cluster_rows.getColumn("Score").toArray()[j],
          ", ",
          sample_cluster_rows.getColumn("Summary").toArray()[j],
          ": ",
          String(sample_cluster_rows.getColumn("Text").toArray()[j])?.slice(
            0,
            70,
          ),
        ].join(""),
      );
    }

    console.log("-".repeat(100));
  }

  return;
}
