import pl from "npm:nodejs-polars";
import { TSNE } from "npm:@keckelt/tsne";
import { resolve } from "jsr:@std/path";

const defaultEmbeddingsPath =
  "./tristan/output/fine_food_reviews_with_embeddings_1k.csv";

const defaultVisHtmlTemplatePath = "./tristan/data/data-vis-template.html";
const defaultVisHtmlPath = "./tristan/output/data-vis.html";

const worker = self as unknown as Worker;

function visualizingEmbeddings2D() {
  worker.postMessage({ data: "Loading embeddings" });
  const data = pl.readCSV(defaultEmbeddingsPath, { quoteChar: '"' });

  worker.postMessage({ data: "Transforming data" });

  // Convert to a list of lists of floats
  const matrix: number[][] = data
    .getColumn("embedding")
    .toArray()
    .map((row) => {
      return JSON.parse(String(row));
    });

  // Create a t-SNE model and transform the data
  const tsne = new TSNE({
    dim: 2,
    perplexity: 15,
    epsilon: 200,
  });

  tsne.initDataRaw(matrix);
  const iterations = 1000;
  for (let i = 0; i < iterations; i++) {
    tsne.step();
  }
  const visDims = tsne.getSolution();

  worker.postMessage({ data: "Outputing transformed data" });

  const template = Deno.readTextFileSync(resolve(defaultVisHtmlTemplatePath));

  const withData = template
    .replace("%DATA%", JSON.stringify(visDims))
    .replace("%SCORES%", JSON.stringify(data.getColumn("Score").toArray()));

  Deno.writeTextFileSync(resolve(defaultVisHtmlPath), withData);

  worker.postMessage({ data: "Opening data visualization in browser" });
  worker.postMessage({ url: resolve(defaultVisHtmlPath) });
  // @ts-ignore: worker.close()
  worker.close();
}

worker.onmessage = visualizingEmbeddings2D;
