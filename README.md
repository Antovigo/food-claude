# Food Claude

A Claude Code plugin that picks meals on [Just Eat Business](https://app.business.just-eat.co.uk) according to your natural-language preferences.

## Install

Install the plugin:

```
/plugin marketplace add Antovigo/food-claude
/plugin install food-claude@food-claude
```
## Use

```
/order-dinner
```

or directly include your preferences:

```
/order-dinner no chicken, add as much desert as possible within budget
```

## Uninstall

```
/plugin uninstall food-claude       # remove
/plugin disable food-claude         # keep installed but dormant
```

## Notes

To force a specific browser, set the `FOOD_CLAUDE_BROWSER` environment variable to one of: `chrome`, `msedge`, `firefox`, `chromium`, `webkit`. For example:

```bash
FOOD_CLAUDE_BROWSER=firefox claude
```

Note that Playwright launches an *isolated* browser profile regardless of which browser you choose — your existing logins, bookmarks, and extensions are not shared with it.
