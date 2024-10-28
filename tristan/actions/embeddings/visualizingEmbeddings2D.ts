import chalk from "npm:chalk";
import { wait } from "jsr:@denosaurs/wait";
import open from "npm:open";
import { confirm } from "npm:@inquirer/prompts";
import { defaultEmbeddingsPath } from "./defaultDataPath.ts";

export async function visualizingEmbeddings2D() {
  const loadViz = await confirm({
    message: "Do you want to generate the data visualization?",
  });
  if (!loadViz) {
    console.log(chalk.green("Skipping data visualization."));
    return;
  }

  const spinner = wait("Loading embeddings").start();

  const worker = new Worker(
    new URL("./embedding-vis-worker.ts", import.meta.url).href,
    { type: "module" },
  );

  let done: VoidFunction;
  const workerDonePromise = new Promise<void>((resolve) => {
    done = resolve;
  });
  worker.onmessage = async (event) => {
    if (event.data?.data) {
      spinner.text = event.data.data;
    }
    if (event.data.url) {
      await open(event.data.url, { app: { name: "browser" } });

      spinner.stop();
      done();
    }
  };
  worker.postMessage({ filename: defaultEmbeddingsPath });
  await workerDonePromise;
}
