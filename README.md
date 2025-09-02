# ZSCRIPTS - Lightweight personal monorepo configuration

Your own personal monorepo. Got random helper scripts you like to re-use across projects? Throw them in scripts and call them from anywhere.

Idea is, I have random helpers I want to save off and call later. Some examples are provided in scripts, but you should build your own!

# SETUP

Install deno (https://docs.deno.com/runtime/getting_started/installation):
```bash
curl -fsSL https://deno.land/install.sh | sh
```

Run this command from the repo root to register `zscripts` command globally
```bash
deno run install
```

Now, test by listing zscripts:
```bash
zscripts list
```

# SCRIPTS

To add a new script, just add it to the scripts directory, and either write your code as a script like this


```ts title="scripts/hello-world.ts"
console.log("HELLO WORLD")
```

Usage

```bash
zscripts hello-world
```

Or, with an async "run" function if you need to pass in the args from the CLI. Make sure to export it!

```ts title="scripts/bing-search.ts"
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
```


Usage

```bash
zscripts bing-search "Great apple pie recipes"
```
