from pathlib import Path

import pandas as pd
import tiktoken

from jennifer.utilities import extract_domain

MAX_TOKENS = 500


# Function to split the text into chunks of a maximum number of tokens
def split_into_many(tokenizer, text, max_tokens=MAX_TOKENS):

    # Split the text into sentences
    sentences = text.split(". ")

    # Get the number of tokens for each sentence
    n_tokens = [len(tokenizer.encode(" " + sentence)) for sentence in sentences]

    chunks = []
    tokens_so_far = 0
    chunk = []

    # Loop through the sentences and tokens joined together in a tuple
    for sentence, token in zip(sentences, n_tokens):

        # If the number of tokens so far plus the number of tokens in the current sentence is greater
        # than the max number of tokens, then add the chunk to the list of chunks and reset
        # the chunk and tokens so far
        if tokens_so_far + token > max_tokens:
            chunks.append(". ".join(chunk) + ".")
            chunk = []
            tokens_so_far = 0

        # If the number of tokens in the current sentence is greater than the max number of
        # tokens, go to the next sentence
        if token > max_tokens:
            continue

        # Otherwise, add the sentence to the chunk and add the number of tokens to the total
        chunk.append(sentence)
        tokens_so_far += token + 1

    return chunks


def tokenize_action(url: str, rebuild: bool):
    domain = extract_domain(url)

    output_path = Path("output")
    processed_domain_path = output_path / "processed" / f"{domain}.csv"
    tokens_path = output_path / "processed" / f"{domain}-tokens.csv"
    if tokens_path.exists() and not rebuild:
        return

    if not processed_domain_path.exists():
        raise FileNotFoundError(
            f"processed domain path for {domain} not found; run process first!"
        )

    # Load the cl100k_base tokenizer which is designed to work with the ada-002 model
    tokenizer = tiktoken.get_encoding("cl100k_base")

    df = pd.read_csv(processed_domain_path, index_col=0)
    df.columns = ["title", "text"]

    # Tokenize the text and save the number of tokens to a new column
    df["n_tokens"] = df.text.apply(lambda x: len(tokenizer.encode(x)))

    shortened = []

    # Loop through the dataframe
    for row in df.iterrows():

        # If the text is None, go to the next row
        if row[1]["text"] is None:
            continue

        # If the number of tokens is greater than the max number of tokens, split the text into chunks
        if row[1]["n_tokens"] > MAX_TOKENS:
            shortened += split_into_many(tokenizer, row[1]["text"])

        # Otherwise, add the text to the list of shortened texts
        else:
            shortened.append(row[1]["text"])

    df = pd.DataFrame(shortened, columns=["text"])
    df["n_tokens"] = df.text.apply(lambda x: len(tokenizer.encode(x)))

    df.to_csv(tokens_path)
