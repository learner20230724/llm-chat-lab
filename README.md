# llm-chat-lab

<p align="center">
  <strong>A local-first workspace for comparing prompt, model, memory, and workflow decisions side by side.</strong>
</p>

<p align="center">
  This project starts from a simple belief: most chat tools optimize for having a conversation, not for inspecting why one setup behaves differently from another.
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="./package.json"><img src="https://img.shields.io/badge/runtime-Node%2022+-339933?logo=node.js&logoColor=white" alt="Node"></a>
  <a href="./package.json"><img src="https://img.shields.io/badge/status-runnable%20shell-6f42c1" alt="Status"></a>
</p>

![llm-chat-lab hero preview](./docs/hero-preview.svg)

> English | [简体中文](./README.zh-CN.md)

## What this project is

`llm-chat-lab` is a compare-first workspace for testing the same input against different chat setups.

Instead of treating a chat interface as one long thread, it treats each run as something you should be able to inspect: prompt preset, model preset, memory mode, and resulting behavior.

The current version is deliberately small, but it already proves the product shape:
- one shared input
- two side-by-side panels
- independent presets per panel
- visible latency / token / cost snapshots
- mocked local responses so the shell is runnable before provider wiring

## Why this exists

There are already many chat UIs. Most of them optimize for chatting. Much fewer optimize for comparison.

That gap matters if you are:
- building an LLM app
- testing prompt strategies
- comparing memory policies
- evaluating how much extra structure or context actually changes the output
- trying to explain model behavior to a teammate without hand-wavy claims

`llm-chat-lab` is meant to be a clean bench for that kind of work.

## First runnable slice

The first runnable shell focuses on one job: make “same input, different setup” obvious in under a minute.

Current scope:
- local web UI
- compare workspace with two panels
- prompt preset selector
- model preset selector
- memory mode selector
- mock result generation
- lightweight metrics strip
- no backend, no accounts, no provider setup

## Design principles

- **Compare-first** — the core interaction is side-by-side evaluation, not one infinite chat thread
- **Local-first** — the first version should run without remote infrastructure
- **Readable state** — the setup should be visible, not hidden in menus or implied by history
- **Honest scope** — this is not pretending to be a full agent platform on day one

## Quickstart

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:4173
```

## What the current shell demonstrates

- how a compare-first chat workspace should feel
- how the same prompt can be framed under different operator styles
- why visible setup state is part of the product, not just implementation detail
- a UI direction that is already screenshotable and README-friendly

## Roadmap

Near-term priorities:
- add saved compare runs
- support import / export of run snapshots
- add real provider adapters behind the current mock layer
- add screenshot-friendly share states
- widen panel layouts beyond 2-column compare
- track richer metrics and prompt diffs

## Project structure

```text
llm-chat-lab/
  public/
    index.html
    styles.css
    app.js
  docs/
    hero-preview.svg
    positioning.md
    mvp.md
    landscape.md
  server.mjs
  package.json
```

## README notes from strong open-source projects

A few patterns from mature projects are worth borrowing here:
- a clear one-line statement near the top
- badges kept compact instead of noisy
- a strong visual immediately visible on first screen
- a short “what this is” section before the long explanation
- an honest quickstart that gets people running fast
- roadmap and boundaries written plainly instead of using inflated AI language

That is the writing direction for this repo too: product-facing, concise, and credible.

## Documentation

- [Positioning](./docs/positioning.md)
- [MVP](./docs/mvp.md)
- [Landscape](./docs/landscape.md)
- [README Benchmark Notes](./docs/readme-benchmark-notes.md)

## License

MIT
