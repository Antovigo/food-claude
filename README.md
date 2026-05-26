# Food Claude

A Claude Code plugin that picks meals on [Just Eat Business](https://app.business.just-eat.co.uk) according to your natural-language preferences, commits each day's selection (which stays editable via *Clear Order* until that day's deadline), and ends with a summary you can validate or amend.

Under the hood: a [Playwright MCP](https://github.com/microsoft/playwright-mcp) server drives a real browser; a skill tells Claude how to navigate the site; a `/order-dinner` slash command is the entry point.

## Requirements

- Claude Code
- Node.js (for `npx`, which launches the Playwright MCP)
- A Just Eat Business account

## Install

Inside a Claude Code session, point it at this repo:

```
/plugin marketplace add Antovigo/food-claude
/plugin install food-claude@food-claude
```

Verify with `/plugin` (should appear under *Installed*) and `/help` (should list `/order-dinner`). If the command doesn't appear immediately, run `/reload-plugins`.

On first activation Claude Code will ask you to approve the bundled Playwright MCP server — accept it. A persistent browser profile is reused on subsequent runs, so you only log in to Just Eat Business once.

### Browser selection

Food Claude auto-detects a system browser at startup, in this order:

1. Google Chrome
2. Microsoft Edge
3. Firefox
4. Chromium

If a system browser is found, it's reused — **no extra download**. If none are found, Food Claude falls back to Playwright's bundled Chromium (one-time ~200 MB download on first launch) and prints a notice.

To force a specific browser, set the `FOOD_CLAUDE_BROWSER` environment variable to one of: `chrome`, `msedge`, `firefox`, `chromium`, `webkit`. For example:

```bash
FOOD_CLAUDE_BROWSER=firefox claude
```

Note that Playwright launches an *isolated* browser profile regardless of which browser you choose — your existing logins, bookmarks, and extensions are not shared with it.

### From a local clone (development)

```bash
git clone https://github.com/Antovigo/food-claude.git
claude --plugin-dir ./food-claude
```

Or, with the repo cloned anywhere on disk, install it as a local marketplace in a Claude Code session:

```
/plugin marketplace add /path/to/food-claude
/plugin install food-claude@food-claude
```

### Uninstall

```
/plugin uninstall food-claude       # remove
/plugin disable food-claude         # keep installed but dormant
```

## Use

```
/order-dinner vegetarian, under £15, vary cuisine, Tuesday through Friday
```

Claude will open the browser, prompt you to log in the first time, then for each upcoming day pick the better of the two available restaurants and commit a dish via *CONFIRM CHOICE*. At the end you'll get a single summary listing each day's pick; reply to swap a vendor, change a dish, or accept. Every selection remains editable on `/my-meals` via *Clear Order* until that day's ordering deadline — nothing is irrevocably placed by the plugin.

## Share

Zip the whole `food-claude/` directory and send it. Recipients install it the same way.

## Notes

- The plugin uses *CONFIRM CHOICE* to commit each day's selection — that's the only commit the site exposes, and selections remain editable via *Clear Order* until the day's deadline. There is no separate "Place order" step on Just Eat Business.
- The skill targets the site via stable `test-id` attributes and text-based fallbacks (Angular component tags, dish/button labels) using `browser_evaluate`. It deliberately avoids full-page snapshots on menu pages — those exceed the per-tool token cap.
- Your login cookies live in the Playwright user-data directory on your machine. They are not bundled with the plugin.
