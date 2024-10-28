import Crawler from "npm:crawler";
import chalk from "npm:chalk";
import { stringify } from "jsr:@std/csv";
import { resolve } from "jsr:@std/path";
import { input } from "npm:@inquirer/prompts";

const outputPathPrefix = "./tristan/output/";

function removeDuplicates(input: string[]) {
  return [...new Set(input)];
}

function createProfileCrawler() {
  const crawler = new Crawler({
    maxConnections: 10,
  });

  async function crawlProfile(url: string) {
    const res = await crawler.send({
      url,
    });
    const $ = res.$;
    const links = $("a");
    const filteredLinks = removeDuplicates(
      links
        .map(function (this: typeof $) {
          const href = $(this).attr("href");
          return href.includes(url) && href.includes("source") ? href : null;
        })
        .toArray()
        .filter(Boolean),
    );
    console.log(`Found ${filteredLinks.length} links`);
    return filteredLinks;
  }

  async function crawlPost(url?: string) {
    if (!url) {
      return {};
    }
    const res = await crawler.send({ url });
    const $ = res.$;
    const postTitle = $("h1").text();
    const postParagraphs = $("p.pw-post-body-paragraph");
    const postText = postParagraphs.text();

    return { url, title: postTitle, text: postText };
  }
  return { crawler, crawlProfile, crawlPost };
}

export async function crawlerAction({ verbose }: { verbose: boolean }) {
  const { crawlProfile, crawlPost } = createProfileCrawler();

  const blogProfile = await input({
    message: "What profile should I look at?",
    default: "https://medium.com/slalom-build",
  });
  if (!blogProfile) {
    console.log(chalk.red("Oh ok, maybe next time..."));
    return;
  }

  const result = await crawlProfile(blogProfile);
  if (verbose) console.log({ result });

  const postResults = await Promise.all(result.map((post) => crawlPost(post)));
  if (verbose) console.log({ postResults });

  const outputName = await input({
    message:
      "What should I name the output csv? You can use this later for training!",
    default: "blog_data",
  });
  if (!outputName) {
    console.log(
      chalk.red("Oh ok. I guess it was fun to look at all those posts anyway!"),
    );
    return;
  }

  const csv = stringify(postResults, { columns: ["url", "title", "text"] });
  if (verbose) console.log(csv);

  await Deno.writeTextFile(resolve(outputPathPrefix, outputName + ".csv"), csv);

  console.log(chalk.green(`Your file ${outputName} is ready!`));
}
