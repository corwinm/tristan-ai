import type OpenAI from "npm:openai";

export async function getEmbedding(
  client: OpenAI,
  text: string,
  model = "text-embedding-3-small",
  params: OpenAI.EmbeddingCreateParams | null = null,
) {
  const input = text.replace("\n", " ");
  const response = await client.embeddings.create({ input, model, ...params });
  return response.data[0].embedding;
}
