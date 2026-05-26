---
description: Procedure for picking meals on Just Eat Business (app.business.just-eat.co.uk) via the Playwright MCP browser. Use whenever the user wants to auto-fill upcoming Just Eat Business meal slots from natural-language preferences.
effort: medium
---

# Just Eat Business meal ordering

You drive https://app.business.just-eat.co.uk on the user's behalf using the Playwright MCP tools — primarily `browser_navigate`, `browser_evaluate`, and `browser_take_screenshot`. **Prefer `browser_evaluate('btn.click()')` over `browser_click`** on this site: the latter auto-returns a fresh snapshot every time and rapidly burns tokens.

**Important model of the site.**
Each meal slot's `<app-meal-card>` shows **two `[test-id="eaterOption"]` entries** (two restaurants). They are **alternatives, not both-to-be-filled**. The user picks one restaurant per day; the other is simply left alone and quietly expires past its deadline — you do **not** need to click `markAsAway` on the unused one. Filling both was the single biggest failure mode in past runs; do not do it unless the user explicitly says they want two meals that day.

**Per-eaterOption budget.**
Each chosen eaterOption has its own subsidy cap. The `app-sticky-cart` shows `Subsidised budget remaining` live as you add items — **this is the ground truth**. Default budget is ~£20 per eaterOption (the typical subsidy), but always trust the live remaining-budget line over any hardcoded number. By default, add **one main**; only add sides/dessert/drinks if the user asks and the remaining subsidy allows it.

**Selector resilience.**
Obfuscated CSS classes (`idc0_343 kifjrabp`) drift on every deploy — never rely on them. Prefer (in this order): Angular component tags (`app-meal-card`, `app-single-item`, `app-sticky-cart`, `app-eater-menu`), `test-id` attributes, then visible text via `:has-text(...)`. **`test-id` attributes can drift too, and the per-eaterOption action button changes from `chooseMeal` (label "CHOOSE") to a plain `Add` button after the other slot on the same day is touched.** Always have a text-based fallback ready (see resilience patterns below).

## Procedure

### 1. Open the meals page

`browser_navigate` to `https://app.business.just-eat.co.uk/my-meals`. **Snapshot once here** — this page is small.

- Login form visible → tell the user *"Please log in in the browser window, then reply 'continue'."* Wait. Don't type credentials.
- Dismiss any `[test-id="firstTopupDialog"]` or cookie banner with the obvious accept/close action.

### 2. Enumerate the open days

Run this single `browser_evaluate` to get a structured view of every day's eaterOptions in one shot:

```js
() => Array.from(document.querySelectorAll('[test-id="mealCard"]')).map(c => ({
  date: c.querySelector('[test-id="deliveryDate"]')?.innerText || '',
  day:  c.querySelector('[test-id="deliveryDayOfWeek"]')?.innerText || '',
  opts: Array.from(c.querySelectorAll('[test-id="eaterOption"]')).map(o => ({
    vendor: (o.innerText.split('\n')[0] || '').replace(/ - Order \d+$/, ''),
    orderId: (o.innerText.match(/Order (\d+)/) || ['',''])[1],
    currentDish: o.querySelector('[test-id="mealOrderedItems"]')?.innerText || null,
    status: o.querySelector('[test-id="mealOrderedItems"]')          ? 'ordered'
          : o.querySelector('[test-id="mealNoItemsBeforeDeadline"]') ? 'open'
          : o.querySelector('[test-id="mealNoItemsPastDeadline"]')   ? 'past_deadline'
          : 'unknown',
  })),
}))
```

Apply two filters:
- **Skip "Today".** Today's eaterOptions are always already-filled or past-deadline; nothing to do.
- **Skip days where any eaterOption already has `ordered` status.** If the user has picked one of the two for that day already, the day is done — leave the other one alone.

What remains: days where **both** eaterOptions are still `open` (the typical case). For each such day, pick **the one** that best matches the user's preferences.

If the user gave no day scope, default to every remaining "open" day in the visible week.

If the user asked to skip a whole day, click `[test-id="markAsAway"]` inside that card (use either eaterOption's button).

**Run the per-day loop without pausing.** No questions, no per-day confirmations. Brief status lines fine; explicit prompts not. The user reviews everything in one summary at step 4.

### 3. For each remaining day: pick the better eaterOption, then order from it only

You don't need to fetch both menus to decide. Use prior knowledge of the vendors (cuisine, typical price point) plus any cached menus from earlier days in this run. If you genuinely can't tell which vendor will better match the user's preferences, fetch both menus via `browser_evaluate` (step 3b) — but in most runs, vendor name + cuisine is enough.

**3a. Navigate to the chosen vendor's menu.** Use a vendor-scoped, label-resilient selector:

```js
(vendorName) => {
  const target = Array.from(document.querySelectorAll('[test-id="eaterOption"]'))
    .find(o => o.innerText.includes(vendorName));
  const btn = target.querySelector('[test-id="chooseMeal"]')
           || Array.from(target.querySelectorAll('button'))
                .find(b => /choose|add/i.test(b.innerText));
  btn.click();
}
```

The button label is "CHOOSE" when nothing else on the day has been touched; "ADD" otherwise. Both lead to the vendor's menu.

**3b. Pull the menu via `browser_evaluate` — do NOT snapshot.** Menu page snapshots are 85k+ chars and exceed the 25k-token cap.

```js
() => Array.from(document.querySelectorAll('app-single-item')).map(it => {
  const lines = it.innerText.split('\n').map(s => s.trim()).filter(Boolean);
  const title = lines[1] || '';
  const desc = lines.find(l => l.length > 20 && !l.includes('kcal') && !l.includes('£')) || '';
  const price = (it.innerText.match(/£[\d.]+/) || [''])[0];
  return { title, desc: desc.slice(0, 150), price };
})
```

Notes:
- Dish cards use the Angular tag `app-single-item`. The `test-id` is `"items"` (not `"singleItem"`, which returns nothing).
- `[test-id="dietaries"]` returns empty text (icon glyphs). **Filter dietary requirements from the dish title/description text** — "Vegan Margherita", "vegetarian", etc.
- Many dishes have a Gluten-Free duplicate ("Pizz'n'Love" + "Pizz'n'Love - Gluten Free") and some menus list the same dish in two sections. **Use exact title match (`lines[1] === name`)**, not `includes`.

**Remember the menu.** Keep a `vendorName → [dishes]` map for the rest of this run — the same vendor may recur on another day and the menu won't change.

**3c. Pick the dish(es).** One main per eaterOption is the default. Add sides/dessert/drinks only if the user explicitly asked for them and the remaining subsidy fits. Track:
- Live subsidy: read `Subsidised budget remaining` from `app-sticky-cart innerText`.
- User preferences from the prompt (cuisine, dietary, exclusions).
- Variety across days (don't pick the same dish or same vendor two days running unless preferred).

**3d. Add via `browser_evaluate`, not `browser_click`.** It's much lighter (no auto-snapshot return):

```js
(title) => {
  const item = Array.from(document.querySelectorAll('app-single-item'))
    .find(it => it.innerText.split('\n').map(s => s.trim()).filter(Boolean)[1] === title);
  item.querySelector('[test-id="increment"]').click();
}
```

If a dish has a configurator (`[test-id="itemBundleAddButtons"]` or `[test-id="customItemAddButtons"]`), open it, choose sensible defaults, note non-obvious choices for the summary.

After adding, verify via another `browser_evaluate` that `app-sticky-cart` count incremented and that `Subsidised budget remaining` is still ≥ 0.

**3e. Commit with CONFIRM CHOICE.** The `[test-id="submitButton"]` selector inside `[test-id="stickyCart"]` is **unreliable** — use a text-based locator:

```js
() => Array.from(document.querySelector('app-sticky-cart').querySelectorAll('button'))
  .find(b => /confirm/i.test(b.innerText)).click()
```

The button label is **"CONFIRM CHOICE"**. This is **safe**: it places the dish into the slot but the order remains editable via the `Clear Order` link until the day's deadline. **There is no separate checkout/review page** — after this click the page navigates back to `/my-meals` and **re-mounts**, so any saved DOM references from before are stale. Re-query for the next day.

Do not click any button whose text contains "Place order", "Pay", or "Submit order" — those don't appear in this flow, but the rule stands.

Move on to the next day's chosen eaterOption.

### 4. Final summary and validation

When every selected day has been ordered, return to `/my-meals` (you'll already be there after the last CONFIRM CHOICE) and present a single consolidated summary. Per day:

- Date and day of week
- Vendor picked (and briefly why it beat the alternative)
- Dish(es) with prices
- Live subsidy remaining for that eaterOption (or "fully used" if 0)
- Notes: configurator choices, allergen warnings, skipped days, substitutions

Add a weekly total at the bottom.

Then ask explicitly:

> "All set. Want to change anything? Tell me which day to redo (e.g. *'swap Wednesday for the other vendor'*, *'add a dessert to Thursday'*). Otherwise the choices stand — you can still edit any of them via the `Clear Order` link on `/my-meals` until the day's deadline."

If the user asks to change a day:
- For "swap to the other vendor": click `[test-id="clearOrder"]` on the chosen eaterOption, then repeat step 3 against the *other* eaterOption.
- For "different dish, same vendor": clear it and re-pick.
- For "add a side/dessert": navigate back to the same vendor, add the extra, CONFIRM CHOICE again.

Re-summarize the changed day, ask again. Stop only on explicit confirmation.

## Resilience patterns

### Never index cart REMOVE buttons by position

The `app-sticky-cart` re-orders rows silently between adds. Always scope by dish title:

```js
(dishTitle) => {
  const cart = document.querySelector('app-sticky-cart');
  const row = Array.from(cart.querySelectorAll('app-cart-item, *'))
    .find(el => el.tagName !== 'BUTTON' && el.innerText.trim().startsWith(dishTitle));
  // walk up if needed and click the REMOVE button inside this row's container
}
```

### Re-query the DOM after navigation

CONFIRM CHOICE re-mounts `/my-meals`. Any element references from before that click are invalid — always re-run the structured-state evaluate from step 2 before processing the next day.

### Verify selectors when they return empty

If a `test-id` returns zero elements or empty text, fall back to a `browser_evaluate` lookup by visible text and (for the rest of the run) note the working alternative. Don't keep retrying a selector that the cheat sheet says exists but the page doesn't actually have.

## Edge cases

- **Both eaterOptions on a day are already `ordered`:** skip the day, mention in summary.
- **Both eaterOptions are `past_deadline`:** skip, note in summary.
- **One `ordered`, one `open`:** the user already picked for that day. **Skip the open one.** Don't fill it.
- **User explicitly says "I want two meals on Wednesday":** then and only then, order from both eaterOptions for that day. Treat each one's subsidy as independent.
- **Cookie / first-topup / age modal**: dismiss with the obvious action.
- **Allergen warning** (`[test-id="allergenWarning"]`): note in the summary.
- **Selector returns empty:** verify with a quick `browser_evaluate` and use a text-based locator. Update working selector for the rest of the run.
- **Site error / unexpected layout:** stop, screenshot, describe what you see, ask the user. Don't retry blindly.

## Selector cheat sheet (verify if anything returns empty)

| Purpose | Selector / approach |
|---|---|
| Enumerate days + eaterOptions | structured `browser_evaluate` snippet in step 2 |
| Day card | `<app-meal-card test-id="mealCard">` |
| Date / day | `[test-id="deliveryDate"]`, `[test-id="deliveryDayOfWeek"]` |
| eaterOption (one of two restaurant choices) | `[test-id="eaterOption"]` |
| Vendor (per eaterOption) | `[test-id="vendorName"]` (or first text line of eaterOption) |
| Status — filled | `[test-id="mealOrderedItems"]` present, `Clear Order` link visible |
| Status — open | `[test-id="mealNoItemsBeforeDeadline"]` |
| Status — past deadline | `[test-id="mealNoItemsPastDeadline"]` |
| Open menu for a vendor | resilient selector in step 3a (text fallback for CHOOSE/ADD) |
| Mark whole day as away | `[test-id="markAsAway"]` (rarely needed — leaving unfilled is fine) |
| Clear an existing selection | `[test-id="clearOrder"]` (text: "Clear Order") |
| Menu page root | `<app-eater-menu>` |
| Dish card | `app-single-item` *(NOT `[test-id="singleItem"]`)* |
| Add 1 of a specific dish | `browser_evaluate` snippet in step 3d |
| Sticky cart | `<app-sticky-cart test-id="stickyCart">` |
| Live subsidy remaining | regex over `app-sticky-cart innerText` for `Subsidised budget remaining` line |
| Commit (safe) | text-based `find(b => /confirm/i.test(b.innerText))` inside `app-sticky-cart`. Label: **"CONFIRM CHOICE"** |
| Cart REMOVE row | always scope by dish title — never by index |
| Back to meals | `[test-id="backButton"]` (rarely needed; CONFIRM CHOICE returns automatically) |
