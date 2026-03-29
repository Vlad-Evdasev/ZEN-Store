---
name: manager-orchestrator
description: Orchestrates every user request by analyzing intent, decomposing work, and delegating to specialist subagents (frontend, backend, reviewer). Use this skill at the start of every request that involves building features, fixing bugs, refactoring code, or reviewing changes. Ensures the subagent system stays active and routes tasks to the right specialists in parallel when possible.
---

# Manager Orchestrator

Activate this skill at the **start of every request**. Its job is to analyze what the user wants, decompose the work, delegate to the correct specialist subagents, and keep the pipeline running until the task is fully complete.

## Activation Rule

Read and apply this skill **before doing any work** on a user request. Do not skip orchestration and respond directly unless the request is purely conversational (e.g. "what does X do?").

## Step 1 — Classify the Request

Determine which domains are involved:

| Signal in request | Delegate to |
|---|---|
| UI, component, page, style, design | `frontend` subagent |
| API, endpoint, model, database, auth, service | `backend` subagent |
| Both UI and API work | `frontend` + `backend` in parallel |
| Any implementation just completed | `frontend-reviewer` and/or `backend-reviewer` |
| Git, scripts, shell commands | `shell` subagent |
| Codebase search, "how does X work?" | `explore` subagent |

## Step 2 — Decompose the Work

Break the request into discrete subtasks. For each subtask, identify:
- Which subagent handles it
- Whether it can run in parallel with other subtasks or must wait
- What inputs (files, context, prior output) it needs

## Step 3 — Launch Subagents

- Launch **independent subtasks in parallel** (single message, multiple Task tool calls).
- Launch **dependent subtasks sequentially** — wait for the prerequisite output first.
- Always pass the full context each subagent needs: user intent, relevant file paths, constraints, and any prior subagent output.

## Step 4 — Chain Reviewers

After any implementation subagent completes:
- Launch `frontend-reviewer` if frontend code was written.
- Launch `backend-reviewer` if backend code was written.
- Pass the reviewer the diff or summary of changes plus the original requirements.

## Step 5 — Consolidate and Report

Once all subagents finish:
1. Merge their outputs into a single coherent response.
2. Surface any conflicts or open decisions requiring user input.
3. List any follow-up tasks the user may want to do next.

## Keeping the Subagent System Running

- Never terminate the pipeline early. If a subagent returns an incomplete result, re-launch it with clarified instructions.
- If two subagents produce conflicting changes, surface the conflict explicitly and ask the user to decide before proceeding.
- If a reviewer flags critical issues, send the task back to the implementation subagent with the reviewer's exact feedback.

## Prompt Template for Subagents

When launching any subagent, always include:

```
Context: [1-2 sentence summary of what the user wants overall]
Your task: [specific subtask for this subagent]
Relevant files: [list any files the subagent should read first]
Constraints: [style guide, libraries allowed, existing patterns to follow]
Return: [exactly what output you need back]
```

## Example Decomposition

**User request:** "Add a product filter sidebar to the catalog page and wire it to a new `/api/products/filter` endpoint."

```
Subtask A → backend subagent
  Task: Create POST /api/products/filter endpoint with query params for category, price range, and stock.
  Relevant files: backend routes, product model, existing filter logic.
  Return: endpoint path, request/response shape, and confirmation it is implemented.

Subtask B → frontend subagent (can run in parallel with A)
  Task: Build FilterSidebar component on CatalogPage. Use mock data first; wire to real endpoint once backend confirms shape.
  Relevant files: frontend/src/pages/Catalog.tsx, existing component patterns.
  Return: component location and props interface.

After A + B complete → backend-reviewer + frontend-reviewer in parallel.
```
