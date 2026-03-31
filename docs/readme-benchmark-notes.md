# README benchmark notes

These are the patterns worth borrowing from strong open-source projects such as Tailwind CSS, LangChain, and shadcn/ui.

## What they do well

### 1. They explain themselves fast

The first screen usually answers three things quickly:
- what the project is
- why it matters
- where to go next

They do not make the reader work to infer the product.

### 2. They use a strong top section

Common top-of-page pattern:
- project name
- one-line positioning statement
- a compact badge row
- a visual or hero asset
- one obvious next action

This creates “project weight” immediately.

### 3. They do not overstuff the first screen

Good big-project READMEs are not necessarily long at the top. They are usually selective.

The opening is often cleaner than smaller projects because they avoid dumping every feature immediately.

### 4. They separate positioning from detail

A strong README tends to move in this order:
- what this is
- why it exists
- quickstart
- docs / ecosystem / roadmap / contribution

That keeps the reader oriented before the deeper material starts.

### 5. They sound confident without sounding fake

The good ones avoid empty phrases like:
- next-generation AI platform
- revolutionary workflow engine
- powerful all-in-one solution

Instead they use concrete wording about scope, constraints, and value.

## What this means for `llm-chat-lab`

The repo should keep this structure:
- strong top statement
- visible hero preview
- short explanation of the compare-first idea
- quickstart that really works
- roadmap written like a product team, not a prompt dump

## Writing rule

If a sentence sounds like marketing copy instead of a serious open-source maintainer explaining a product, cut it or rewrite it.
