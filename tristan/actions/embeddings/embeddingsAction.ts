import OpenAI from "npm:openai";
import { obtainDataSet } from "./obtainDataSet.ts";
import { visualizingEmbeddings2D } from "./visualizingEmbeddings2D.ts";
import { semanticTextSearchUsingEmbeddings } from "./semanticTextSearchUsingEmbeddings.ts";
import { kMeansClustering } from "./kMeansClustering.ts";

export async function embeddingsAction() {
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  const openai = new OpenAI({
    apiKey,
  });

  await obtainDataSet(openai);

  visualizingEmbeddings2D();

  semanticTextSearchUsingEmbeddings(openai);

  await kMeansClustering(openai);
}
