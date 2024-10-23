function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must be the same length");
  }

  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function norm(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const dotProd = dotProduct(a, b);
  const normA = norm(a);
  const normB = norm(b);

  return dotProd / (normA * normB);
}
