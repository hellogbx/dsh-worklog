# dsh-worklog

A [DeepSeek Harness](https://github.com/deepseek-ai) bundle that adds a **Work log and todos
(工作总结与待办)** entry to the left sidebar. One page answers two questions:

- **What changed in each project?** — one short highlight per session, taken from the
  assistant's final written outcome. Highlights are grouped per project (newest first, at most
  five shown), and a compact by-day list shows when each session ran.
- **What is left to do?** — one unified todo list shared by every project and every session,
  editable from the page and recordable by the agent in chat.

## Install

From GitHub:

```sh
dsh plugin --profile web add github:hellogbx/dsh-worklog
```

The bundle inserts one `worklog` row into the profile's `cordis.patch.yml`, so it needs no manual
wiring. After a page refresh a **工作总结与待办** icon appears in the sidebar.

To remove it, drop the bundle from the Plugins page (or delete the `worklog` row). The todo file is
left in place.

## What it does

- **Host half** (`index.js`)
  - Registers `GET /plugin-worklog/summary` and `GET|POST /plugin-worklog/todos` on the Harness
    web server. The summary route reads the sessions touched in the range through `sessionQuery`
    and folds each turn into:
    - `gist`: one sentence from the turn's final assistant message, flattened and clipped to about
      56 characters. Markdown headings, code fences, tables, and list markers are removed first.
    - Session metadata: title, turn and request counts, last activity, status.
  - Project entries keep one highlight per session title (newest first, capped at five) and report
    session/turn counts. Results are cached for `cacheSeconds`; `?refresh=1` bypasses the cache.
    No git history, file lists, or line counts are read.
  - Persists the unified todo list to `$DSH_HOME/worklog/todos.json` with atomic, serialized writes.
  - Registers two agent tools:
    - `worklog_summary` — per-project one-line session highlights plus a compact by-day list, so
      the model can narrate at the right level.
    - `worklog_todo` — add/list/update/complete/reopen/remove todos. When you ask the agent to note
      a todo while working in a project, it records it here, defaulting the project to the current
      repository.
- **Client half** (`client.js`) registers the sidebar icon into `sidebar.panellist` and the page
  into `main` under the same id `worklog`.

## Page content

The page is deliberately list-first and high-level:

- **项目改动** — one card per project. Each card shows the project name and path, its session
  count, and a plain list of session highlights: `会话主题：一句话结果`. At most five are shown;
  the rest are reported as a count.
- **按天回顾** — one compact card per day. Every session is a single row with its title, turn
  count, last activity time, and a status badge when its latest turn did not finish normally.

Subagent sessions are excluded so the page reflects your own work. A session whose final outcome
has no text still appears in the by-day list.

## Todos

Todos carry a title, project, priority (`high`/`normal`/`low`), optional note and due date, and
their source (`user` when recorded on the page, `agent` when recorded through the tool). The page
groups them by project and filters by status and project; the same JSON file backs every workspace
and session.

## Data and privacy

- Everything stays on your machine. The plugin makes no outbound network requests.
- Summary data is derived from your local session logs and cached in memory only.
- Todos live in `$DSH_HOME/worklog/todos.json` (default `~/.dsh/worklog/todos.json`).
- The HTTP routes are bound to the loopback listener and have no cookie check; do not expose the
  Harness web port to an untrusted network.

## Configuration

```yaml
- id: worklog
  name: '@hellogbx/dsh-worklog'
  config:
    cacheSeconds: 60
    maxSessions: 200
    # dataDir: ~/.dsh/worklog
```

`maxSessions` caps how many sessions one range reads (newest activity first). `dataDir` relocates
the todo store.

## Requirements

- The Web GUI target (`dsh.client.platform: web`). The page reads the host routes over HTTP, so an
  Electron window that loads its shell from `file://` cannot reach them.
- The `sessionQuery` service (shipped in the default profile) for the summary, and write access to
  `$DSH_HOME/worklog/todos.json` for the todo store.
- DSH `>=0.2.2-rc.1`.

## Development

The package ships plain ESM — no build step. Link it into a profile and edit in place:

```sh
git clone git@github.com:hellogbx/dsh-worklog.git
dsh plugin --profile desktop add link:$PWD
```

Host changes need a DSH restart; client changes only need a browser refresh of the Web GUI.

## License

[MIT](./LICENSE)
