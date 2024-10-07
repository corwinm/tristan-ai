from pathlib import Path

import pandas as pd
from openai import OpenAI

from jennifer.utilities.domains import extract_domain
from jennifer.utilities.embeddings import create_embedding


def create_embeddings_action(url: str, rebuild: bool):
    client = OpenAI()

    domain = extract_domain(url)
    output_path = Path("output")
    embeddings_path = output_path / "processed" / f"{domain}-embeddings.csv"
    tokens_path = output_path / "processed" / f"{domain}-tokens.csv"
    if embeddings_path.exists() and not rebuild:
        return

    if not tokens_path.exists():
        raise FileNotFoundError(
            f"Tokens file for domain {domain} not found; run tokenize first!"
        )

    df = pd.read_csv(tokens_path)
    print(f"creating embeddings for {len(df)} inputs")
    df["embeddings"] = df.text.apply(lambda x: create_embedding(client, x))

    df.to_csv(embeddings_path)
    df.head()