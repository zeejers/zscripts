/**
 * args: string of args from the command line that were passed into the command
 */
export async function run(args: string[]) {
  const searchQuery = args?.[0];
  const url = new URL("https://bing.com");
  if (searchQuery) {
    url.searchParams.append("q", searchQuery);
  }
  const response = await fetch(url.href);
  const text = await response.text();
  console.log(text);
}
