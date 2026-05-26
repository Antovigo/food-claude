---
description: Pick meals on Just Eat Business according to your preferences, commit each day's selection, and present a summary to validate
argument-hint: [preferences in plain English — e.g. "vegetarian, under £15, Tue–Fri"]
effort: medium
---

The user wants you to add meals to their Just Eat Business basket according to these preferences:

$ARGUMENTS

Follow the procedure described in the `just-eat-ordering` skill exactly. The skill will pick **one restaurant per day** (the better of the two `eaterOption`s), add a dish via that day's CONFIRM CHOICE button (which is safe — it commits the selection to the slot but the order remains editable via `Clear Order` until the day's deadline), then move on. After all days are done, present a single summary and ask the user to validate or request changes.

If `$ARGUMENTS` is empty, ask **one** open free-text question — e.g. *"What would you like for dinner this week? Any preferences (cuisine, dietary, budget) or specific days I should order for?"* — and wait for the reply. Do **not** open a structured `AskUserQuestion` form with multiple fields, and do **not** ask a series of follow-up questions. One question, one answer, then proceed with whatever they say (filling in sensible defaults from the skill for anything unspecified).
