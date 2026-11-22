/**
 * Host half of the "work log" plugin.
 *
 * The work summary is built from the Session logs this Harness owns: for each
 * turn inside the requested range it keeps the user's prompt (the requirement)
 * and the assistant's final written outcome (what got done), then groups those
 * events by day and project. It deliberately reports no code-line statistics.
 *
 * It also owns one durable todo list shared by every workspace and session,
 * plus the small HTTP surface and the agent tools both callers use.
 */
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

/** Prefix of every route the browser half calls. */
const ROUTE_ROOT = '/plugin-worklog'
const SUMMARY_ROUTE = ROUTE_ROOT + '/summary'
const TODOS_ROUTE = ROUTE_ROOT + '/todos'

const DEFAULT_CACHE_SECONDS = 60
const DEFAULT_MAX_SESSIONS = 200
const READ_CONCURRENCY = 3
const MAX_BODY_BYTES = 1024 * 1024
const MAX_TODO_TITLE = 300
const MAX_TODO_NOTE = 4000
const MAX_PROMPT_TEXT = 600
const MAX_RANGE_DAYS = 366
const MAX_PROJECT_HIGHLIGHTS = 5
const MAX_GIST_TEXT = 56

const PRIORITIES = ['high', 'normal', 'low']
const TODO_ACTIONS = ['add', 'update', 'complete', 'reopen', 'remove', 'list']
const FALLBACK_PROJECT = '未分类'

export const inject = ['webServer']

/**
 * Register the summary and todo routes, the shared todo store, and the two
 * agent tools.
 * @param ctx - plugin context.
 * @param config - row config from `cordis.patch.yml`.
 */
export function apply(ctx, config) {
  const options = normalizeOptions(config)
  const store = createTodoStore(options)
  const worklog = createWorklog(ctx, options, store)

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: SUMMARY_ROUTE,
        handler: (request, response) => worklog.serveSummary(request, response),
      }),
    'worklog: summary route',
  )
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: TODOS_ROUTE,
        handler: (request, response) => worklog.serveTodos(request, response),
      }),
    'worklog: todos route',
  )

  const tools = optionalService(ctx, 'tools')
  if (tools !== undefined && typeof tools.register === 'function') {
    ctx.effect(() => tools.register(summaryTool(worklog)), 'worklog: summary tool')
    ctx.effect(() => tools.register(todoTool(worklog)), 'worklog: todo tool')
  }
}

/** Normalize the row config, ignoring anything malformed. */
function normalizeOptions(config) {
  const source = config !== null && typeof config === 'object' ? config : {}
  const seconds =
    typeof source.cacheSeconds === 'number' && Number.isFinite(source.cacheSeconds) && source.cacheSeconds >= 0
      ? source.cacheSeconds
      : DEFAULT_CACHE_SECONDS
  const maxSessions =
    typeof source.maxSessions === 'number' && Number.isFinite(source.maxSessions) && source.maxSessions > 0
      ? Math.min(2000, Math.round(source.maxSessions))
      : DEFAULT_MAX_SESSIONS
  const dataDir = typeof source.dataDir === 'string' && source.dataDir.trim() !== '' ? resolveTilde(source.dataDir.trim()) : ''
  return { cacheMs: Math.round(seconds * 1000), maxSessions, dataDir }
}

/** Read an optional service without failing activation when it is absent. */
function optionalService(ctx, name) {
  try {
    return ctx.get(name)
  } catch {
    return undefined
  }
}

/* ------------------------------------------------------------------ */
/* Todo store                                                          */
/* ------------------------------------------------------------------ */

/**
 * One JSON file under `$DSH_HOME/worklog` (or the configured directory) keeps
 * every project's todos in a single unified list. Writes are serialized and
 * atomic so a crashed save cannot truncate the list.
 */
function createTodoStore(options) {
  const baseDir = options.dataDir !== '' ? options.dataDir : join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'worklog')
  const file = join(baseDir, 'todos.json')

  let state
  let queue = Promise.resolve()

  async function load() {
    if (state !== undefined) return state
    try {
      const text = await readFile(file, 'utf8')
      state = normalizeTodoState(JSON.parse(text))
    } catch {
      state = { version: 1, todos: [] }
    }
    return state
  }

  async function save(next) {
    await mkdir(dirname(file), { recursive: true })
    const temporary = file + '.' + String(process.pid) + '.tmp'
    await writeFile(temporary, JSON.stringify(next, null, 2) + '\n', 'utf8')
    await rename(temporary, file)
  }

  function mutate(change) {
    const run = queue.then(async () => {
      const current = await load()
      const result = change(current)
      await save(current)
      return result
    })
    queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  return {
    file,
    async list() {
      const current = await load()
      return current.todos.map(copyTodo)
    },
    async add(input) {
      return mutate((current) => {
        const now = new Date().toISOString()
        const created = {
          id: randomUUID(),
          title: clampText(input.title, MAX_TODO_TITLE),
          project: clampText(input.project, 120) || FALLBACK_PROJECT,
          status: 'open',
          priority: PRIORITIES.includes(input.priority) ? input.priority : 'normal',
          note: clampText(input.note, MAX_TODO_NOTE),
          dueDate: normalizeDateText(input.dueDate),
          source: input.source === 'agent' ? 'agent' : 'user',
          sessionId: clampText(input.sessionId, 120),
          createdAt: now,
          updatedAt: now,
          completedAt: '',
        }
        current.todos.unshift(created)
        return copyTodo(created)
      })
    },
    async update(id, patch) {
      return mutate((current) => {
        const target = current.todos.find((todo) => todo.id === id)
        if (target === undefined) throw new Error('todo not found: ' + id)
        if (patch.title !== undefined) target.title = clampText(patch.title, MAX_TODO_TITLE)
        if (patch.project !== undefined) target.project = clampText(patch.project, 120) || target.project
        if (patch.priority !== undefined && PRIORITIES.includes(patch.priority)) target.priority = patch.priority
        if (patch.note !== undefined) target.note = clampText(patch.note, MAX_TODO_NOTE)
        if (patch.dueDate !== undefined) target.dueDate = normalizeDateText(patch.dueDate)
        if (patch.status === 'open' || patch.status === 'done') target.status = patch.status
        if (target.status === 'done') {
          target.completedAt = target.completedAt !== '' ? target.completedAt : new Date().toISOString()
        } else {
          target.completedAt = ''
        }
        target.updatedAt = new Date().toISOString()
        return copyTodo(target)
      })
    },
    async remove(id) {
      return mutate((current) => {
        const index = current.todos.findIndex((todo) => todo.id === id)
        if (index === -1) throw new Error('todo not found: ' + id)
        const [removed] = current.todos.splice(index, 1)
        return copyTodo(removed)
      })
    },
  }
}

function normalizeTodoState(parsed) {
  const todos = Array.isArray(parsed) ? parsed : parsed !== null && typeof parsed === 'object' && Array.isArray(parsed.todos) ? parsed.todos : []
  const normalized = []
  for (const raw of todos) {
    if (raw === null || typeof raw !== 'object') continue
    const title = clampText(raw.title, MAX_TODO_TITLE)
    if (title === '') continue
    const status = raw.status === 'done' ? 'done' : 'open'
    normalized.push({
      id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : randomUUID(),
      title,
      project: clampText(raw.project, 120) || FALLBACK_PROJECT,
      status,
      priority: PRIORITIES.includes(raw.priority) ? raw.priority : 'normal',
      note: clampText(raw.note, MAX_TODO_NOTE),
      dueDate: normalizeDateText(raw.dueDate),
      source: raw.source === 'agent' ? 'agent' : 'user',
      sessionId: clampText(raw.sessionId, 120),
      createdAt: typeof raw.createdAt === 'string' && raw.createdAt !== '' ? raw.createdAt : new Date().toISOString(),
      updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt !== '' ? raw.updatedAt : new Date().toISOString(),
      completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : '',
    })
  }
  return { version: 1, todos: normalized }
}

function copyTodo(todo) {
  return {
    id: todo.id,
    title: todo.title,
    project: todo.project,
    status: todo.status,
    priority: todo.priority,
    note: todo.note,
    dueDate: todo.dueDate,
    source: todo.source,
    sessionId: todo.sessionId,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
    completedAt: todo.completedAt,
  }
}

function clampText(value, limit) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+$/g, '').slice(0, limit)
}

function normalizeDateText(value) {
  if (typeof value !== 'string') return ''
  const text = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
}

function countsOf(todos) {
  let open = 0
  let done = 0
  for (const todo of todos) {
    if (todo.status === 'done') done += 1
    else open += 1
  }
  return { total: todos.length, open, done }
}

/** The 8-character id prefix shown to the model and accepted as a lookup key. */
function shortTodoId(todo) {
  return typeof todo.id === 'string' ? todo.id.slice(0, 8) : ''
}

function openCountByProject(todos) {
  const result = {}
  for (const todo of todos) {
    if (todo.status === 'done') continue
    result[todo.project] = (result[todo.project] ?? 0) + 1
  }
  return result
}

/* ------------------------------------------------------------------ */
/* Range handling                                                      */
/* ------------------------------------------------------------------ */

/**
 * Resolve the requested range into local-midnight bounds.
 * @param {URLSearchParams} params - `range`, `date`, `start`, `end`.
 * @param {Date} [now] - current time, injectable for tests.
 * @returns the resolved range (throws for an unsupported span).
 */
function resolveRange(params, now = new Date()) {
  const raw = params.get('range')
  const kind = raw === 'week' ? 'week' : raw === 'custom' ? 'custom' : 'day'
  const today = startOfDay(now)
  if (kind === 'week') {
    const anchor = parseLocalDate(params.get('date')) ?? today
    const monday = startOfWeek(anchor)
    return buildRange(kind, monday, addDays(monday, 6))
  }
  if (kind === 'custom') {
    let start = parseLocalDate(params.get('start')) ?? addDays(today, -6)
    let end = parseLocalDate(params.get('end')) ?? today
    if (start.getTime() > end.getTime()) {
      const swap = start
      start = end
      end = swap
    }
    return buildRange(kind, start, end)
  }
  const day = parseLocalDate(params.get('date')) ?? today
  return buildRange('day', day, day)
}

function buildRange(kind, start, end) {
  const startAt = startOfDay(start)
  const endExclusive = addDays(startOfDay(end), 1)
  const days = Math.round((endExclusive.getTime() - startAt.getTime()) / 86400000)
  if (days < 1 || days > MAX_RANGE_DAYS) {
    throw new Error('date range must be between 1 and ' + String(MAX_RANGE_DAYS) + ' days')
  }
  const startDate = formatLocalDate(startAt)
  const endDate = formatLocalDate(addDays(endExclusive, -1))
  return {
    kind,
    start: startDate,
    end: endDate,
    startAt,
    endExclusive,
    label: startDate === endDate ? startDate : startDate + ' ~ ' + endDate,
    days,
  }
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfWeek(date) {
  const day = startOfDay(date)
  const offset = (day.getDay() + 6) % 7
  return addDays(day, -offset)
}

function addDays(date, amount) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setDate(next.getDate() + amount)
  return next
}

function parseLocalDate(text) {
  if (typeof text !== 'string') return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim())
  if (match === null) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined
  return date
}

function formatLocalDate(date) {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}

function resolveTilde(path) {
  const text = path.trim()
  if (text === '~') return homedir()
  if (text.startsWith('~/')) return join(homedir(), text.slice(2))
  return resolve(text)
}

/* ------------------------------------------------------------------ */
/* Worklog: session-derived summary + todo routes                      */
/* ------------------------------------------------------------------ */

function createWorklog(ctx, options, store) {
  const cache = { key: '', at: 0, core: undefined, pending: undefined }

  async function summary(range, refresh) {
    const key = range.start + '|' + range.end + '|' + String(options.maxSessions)
    const now = Date.now()
    let core
    if (!refresh && cache.core !== undefined && cache.key === key && now - cache.at < options.cacheMs) {
      core = { ...cache.core, cached: true }
    } else if (!refresh && cache.pending !== undefined) {
      core = await cache.pending
    } else {
      const task = collectSessions(ctx, options, range)
        .then((value) => {
          cache.key = key
          cache.at = Date.now()
          cache.core = value
          return value
        })
        .finally(() => {
          if (cache.pending === task) cache.pending = undefined
        })
      cache.pending = task
      core = await task
    }
    const todos = await store.list()
    const byProject = openCountByProject(todos)
    return {
      ...core,
      projects: core.projects.map((project) => ({
        ...project,
        openTodos: typeof byProject[project.name] === 'number' ? byProject[project.name] : 0,
      })),
      todos: {
        ...countsOf(todos),
        byProject,
      },
    }
  }

  async function serveSummary(request, response) {
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'method not allowed' })
      return
    }
    try {
      const url = new URL(request.url ?? SUMMARY_ROUTE, 'http://localhost')
      const range = resolveRange(url.searchParams)
      const refresh = url.searchParams.get('refresh') === '1'
      sendJson(response, 200, await summary(range, refresh))
    } catch (error) {
      sendJson(response, 400, { error: messageOf(error) })
    }
  }

  async function serveTodos(request, response) {
    try {
      if (request.method === 'GET') {
        const todos = await store.list()
        sendJson(response, 200, { todos, counts: countsOf(todos) })
        return
      }
      if (request.method !== 'POST') {
        sendJson(response, 405, { error: 'method not allowed' })
        return
      }
      const body = await readJsonBody(request)
      const result = await applyTodoAction(body)
      const todos = await store.list()
      sendJson(response, 200, { ...result, todos, counts: countsOf(todos) })
    } catch (error) {
      sendJson(response, 400, { error: messageOf(error) })
    }
  }

  async function resolveTodo(id, title, project) {
    const todos = await store.list()
    if (typeof id === 'string' && id !== '') {
      const exact = todos.find((todo) => todo.id === id)
      if (exact !== undefined) return exact
      const prefixed = todos.filter((todo) => todo.id.startsWith(id))
      if (prefixed.length === 1) return prefixed[0]
      if (prefixed.length > 1) {
        throw new Error('todo id is ambiguous: ' + id + ' (matches ' + prefixed.map((todo) => shortTodoId(todo)).join(', ') + ')')
      }
      throw new Error('todo not found: ' + id)
    }
    if (typeof title === 'string' && title.trim() !== '') {
      const wanted = title.trim()
      const matches = todos.filter(
        (todo) => todo.title === wanted && (typeof project !== 'string' || project === '' || todo.project === project),
      )
      if (matches.length === 1) return matches[0]
      if (matches.length > 1) {
        throw new Error(
          'multiple todos match ' +
            JSON.stringify(wanted) +
            '; pass one id from: ' +
            matches.map((todo) => shortTodoId(todo) + ' (' + todo.project + ')').join(', '),
        )
      }
      throw new Error('todo not found: ' + wanted)
    }
    throw new Error('todo id is required')
  }

  async function applyTodoAction(body) {
    const action = typeof body.action === 'string' ? body.action : ''
    if (!TODO_ACTIONS.includes(action)) {
      throw new Error('unknown todo action: ' + (action === '' ? '(missing)' : action))
    }
    if (action === 'list') {
      return { ok: true, message: 'ok' }
    }
    if (action === 'add') {
      const title = clampText(body.title, MAX_TODO_TITLE)
      if (title === '') throw new Error('todo title must not be empty')
      const todo = await store.add({
        title,
        project: body.project,
        priority: body.priority,
        note: body.note,
        dueDate: body.dueDate,
        source: 'user',
        sessionId: '',
      })
      return { ok: true, message: 'todo added', todo }
    }
    if (action === 'remove') {
      const target = await resolveTodo(body.id, body.title, body.project)
      const todo = await store.remove(target.id)
      return { ok: true, message: 'todo removed', todo }
    }
    if (action === 'complete' || action === 'reopen') {
      const target = await resolveTodo(body.id, body.title, body.project)
      const todo = await store.update(target.id, { status: action === 'complete' ? 'done' : 'open' })
      return { ok: true, message: action === 'complete' ? 'todo completed' : 'todo reopened', todo }
    }
    const target = await resolveTodo(body.id)
    const patch = {}
    if (body.title !== undefined) {
      const title = clampText(body.title, MAX_TODO_TITLE)
      if (title === '') throw new Error('todo title must not be empty')
      patch.title = title
    }
    if (body.project !== undefined) patch.project = body.project
    if (body.priority !== undefined) patch.priority = body.priority
    if (body.note !== undefined) patch.note = body.note
    if (body.dueDate !== undefined) patch.dueDate = body.dueDate
    const todo = await store.update(target.id, patch)
    return { ok: true, message: 'todo updated', todo }
  }

  /** The project name a recorded todo should default to: the agent's repository. */
  function resolveAgentProject(exec) {
    let directory = ''
    try {
      const agent = exec !== undefined ? exec.agent : undefined
      const workingDirectory = optionalService(ctx, 'workingDirectory')
      if (agent !== undefined && agent.session !== undefined && workingDirectory !== undefined) {
        directory = workingDirectory.get(agent.session) ?? ''
      }
    } catch {
      directory = ''
    }
    if (directory === '' && exec !== undefined && exec.agent !== undefined && exec.agent.session !== undefined) {
      try {
        const header = exec.agent.session.header
        if (header !== undefined && typeof header.cwd === 'string') directory = header.cwd
      } catch {
        directory = ''
      }
    }
    if (directory === '') directory = process.cwd()
    return basename(directory)
  }

  return {
    summary,
    serveSummary,
    serveTodos,
    resolveTodo,
    resolveAgentProject,
    async listTodos() {
      return store.list()
    },
    async addTodoForAgent(input) {
      return store.add({ ...input, source: 'agent' })
    },
    async updateTodo(id, patch) {
      return store.update(id, patch)
    },
    async removeTodo(id) {
      return store.remove(id)
    },
  }
}

/* ------------------------------------------------------------------ */
/* Session collection                                                  */
/* ------------------------------------------------------------------ */

/**
 * Read the sessions touched in the range and fold their turns into a day and
 * project digest. Each kept turn carries the user's prompt and the assistant's
 * final written outcome; code statistics are never computed.
 */
async function collectSessions(ctx, options, range) {
  const startedAt = Date.now()
  const query = optionalService(ctx, 'sessionQuery')
  if (query === undefined || typeof query.listSessions !== 'function' || typeof query.readSession !== 'function') {
    throw new Error('sessionQuery service is unavailable')
  }

  const records = await query.listSessions()
  const freshness = await sessionFreshness(ctx, range)
  const candidates = []
  let skipped = 0

  for (const record of records) {
    if (record === null || typeof record !== 'object') continue
    const header = record.header !== null && typeof record.header === 'object' ? record.header : undefined
    if (header === undefined || typeof header.id !== 'string' || header.id === '') continue
    if (record.formatStatus === 'migration-required') {
      skipped += 1
      continue
    }
    if (header.origin === 'subagent') {
      skipped += 1
      continue
    }
    const createdAt = typeof header.createdAt === 'number' ? header.createdAt : 0
    if (createdAt >= range.endExclusive.getTime()) {
      skipped += 1
      continue
    }
    const freshAt = freshness !== undefined ? freshness.get(header.id) : undefined
    const live = record.live === true
    if (!live && freshAt !== undefined && freshAt < range.startAt.getTime()) {
      skipped += 1
      continue
    }
    candidates.push({ id: header.id, at: Math.max(freshAt ?? 0, createdAt) })
  }

  candidates.sort((left, right) => right.at - left.at)
  const selected = candidates.slice(0, options.maxSessions)
  const snapshots = await mapWithConcurrency(selected, READ_CONCURRENCY, async (candidate) => {
    try {
      return await query.readSession(candidate.id)
    } catch {
      return undefined
    }
  })

  const projects = new Map()
  const days = new Map()
  const sessionIds = new Set()
  const totals = {
    sessions: 0,
    prompts: 0,
    turns: 0,
    outcomes: 0,
    projects: 0,
    scanned: selected.length,
    known: records.length,
    skipped,
    failed: 0,
    lastAt: 0,
  }

  for (const snapshot of snapshots) {
    if (snapshot === null || typeof snapshot !== 'object') {
      totals.failed += 1
      continue
    }
    const folded = foldSession(snapshot, range)
    if (folded === undefined) continue
    sessionIds.add(folded.id)

    const at = new Date(folded.lastAt)
    if (Number.isNaN(at.getTime())) continue
    const dateKey = formatLocalDate(at)
    const projectKey = folded.path !== '' ? folded.path : folded.name

    const project = projects.get(projectKey) ?? {
      name: folded.name,
      path: folded.path,
      sessions: new Set(),
      prompts: 0,
      turns: 0,
      outcomes: 0,
      highlights: [],
      lastAt: 0,
    }
    project.sessions.add(folded.id)
    project.prompts += folded.prompts
    project.turns += folded.turns
    if (folded.gist !== '') project.outcomes += 1
    project.highlights.push({ title: folded.title, at: folded.lastAt, gist: folded.gist })
    project.lastAt = Math.max(project.lastAt, folded.lastAt)
    projects.set(projectKey, project)

    const day =
      days.get(dateKey) ??
      {
        date: dateKey,
        sessions: new Set(),
        prompts: 0,
        turns: 0,
        projects: new Map(),
      }
    day.sessions.add(folded.id)
    day.prompts += folded.prompts
    day.turns += folded.turns
    const dayProject =
      day.projects.get(projectKey) ??
      {
        name: folded.name,
        path: folded.path,
        prompts: 0,
        turns: 0,
        sessions: new Map(),
      }
    dayProject.prompts += folded.prompts
    dayProject.turns += folded.turns
    dayProject.sessions.set(folded.id, {
      id: folded.id,
      title: folded.title,
      lastAt: new Date(folded.lastAt).toISOString(),
      turns: folded.turns,
      prompts: folded.prompts,
      status: folded.status,
    })
    day.projects.set(projectKey, dayProject)
    days.set(dateKey, day)

    totals.prompts += folded.prompts
    totals.turns += folded.turns
    if (folded.gist !== '') totals.outcomes += 1
    totals.lastAt = Math.max(totals.lastAt, folded.lastAt)
  }

  totals.sessions = sessionIds.size
  totals.projects = projects.size

  const dayList = [...days.values()]
    .map((day) => ({
      date: day.date,
      sessions: day.sessions.size,
      prompts: day.prompts,
      turns: day.turns,
      projects: [...day.projects.values()]
        .map((project) => ({
          name: project.name,
          path: project.path,
          prompts: project.prompts,
          turns: project.turns,
          sessions: [...project.sessions.values()]
            .map((session) => ({
              id: session.id,
              title: session.title,
              lastAt: session.lastAt,
              turns: session.turns,
              prompts: session.prompts,
              status: session.status,
            }))
            .sort((left, right) => right.lastAt.localeCompare(left.lastAt)),
        }))
        .sort((left, right) => right.turns - left.turns),
    }))
    .sort((left, right) => right.date.localeCompare(left.date))

  return {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    range: { kind: range.kind, start: range.start, end: range.end, label: range.label, days: range.days },
    totals,
    projects: [...projects.values()]
      .map((project) => {
        const highlights = mergeHighlights(project.highlights)
        return {
          name: project.name,
          path: project.path,
          sessions: project.sessions.size,
          prompts: project.prompts,
          turns: project.turns,
          outcomes: project.outcomes,
          lastAt: project.lastAt > 0 ? new Date(project.lastAt).toISOString() : '',
          highlights: highlights.slice(0, MAX_PROJECT_HIGHLIGHTS),
          highlightTotal: highlights.length,
        }
      })
      .sort((left, right) => right.lastAt.localeCompare(left.lastAt)),
    days: dayList,
    todos: { total: 0, open: 0, done: 0, byProject: {} },
  }
}

/**
 * Fold one Session snapshot into the turns that fall inside the range.
 * Each turn keeps its prompts and one concise gist from its final assistant
 * message; the session gist is the latest completed turn's gist.
 * @returns the session identity, or `undefined` when no turn is in range.
 */
function foldSession(snapshot, range) {
  const header = snapshot.session !== null && typeof snapshot.session === 'object' ? snapshot.session : undefined
  if (header === undefined || typeof header.id !== 'string') return undefined
  const cwd = typeof header.cwd === 'string' ? header.cwd : ''
  const events = Array.isArray(snapshot.events) ? snapshot.events : []

  let title = ''
  const turns = []
  let current

  const flush = () => {
    if (current === undefined) return
    if (current.prompts.length > 0 && current.at >= range.startAt.getTime() && current.at < range.endExclusive.getTime()) {
      turns.push({
        at: current.at,
        prompts: current.prompts,
        status: current.status,
        gist: current.gist,
      })
    }
    current = undefined
  }

  for (const event of events) {
    if (event === null || typeof event !== 'object') continue
    if (event.type === 'session/title') {
      const data = event.data !== null && typeof event.data === 'object' ? event.data : undefined
      const value = data !== undefined && typeof data.title === 'string' ? data.title.trim() : ''
      if (value !== '') title = value
      continue
    }
    if (event.type === 'turn/start') {
      flush()
      current = {
        at: typeof event.time === 'number' ? event.time : Date.now(),
        prompts: [],
        gist: '',
        status: 'running',
      }
      continue
    }
    if (current === undefined) continue
    if (event.type === 'user/message') {
      const data = event.data !== null && typeof event.data === 'object' ? event.data : undefined
      if (data === undefined) continue
      const source = data.source !== null && typeof data.source === 'object' ? data.source : undefined
      if (source === undefined || source.kind !== 'user') continue
      const text = cleanPrompt(textOfMessage(data))
      if (text === '') continue
      if (current.prompts.length > 0 && current.prompts[current.prompts.length - 1].text === text) continue
      current.prompts.push({ text: truncateText(text, MAX_PROMPT_TEXT), at: event.time })
      continue
    }
    if (event.type === 'assistant/message') {
      const data = event.data !== null && typeof event.data === 'object' ? event.data : undefined
      const message = data !== undefined && data.message !== null && typeof data.message === 'object' ? data.message : undefined
      if (message === undefined) continue
      const raw = textOfMessage(message)
      if (raw.trim() === '') continue
      current.gist = gistOf(raw)
      continue
    }
    if (event.type === 'turn/end') {
      const data = event.data !== null && typeof event.data === 'object' ? event.data : undefined
      const reason = data !== undefined && data.reason !== null && typeof data.reason === 'object' ? data.reason : undefined
      current.status = reason !== undefined && typeof reason.kind === 'string' ? reason.kind : 'completed'
      flush()
    }
  }
  flush()

  if (turns.length === 0) return undefined
  if (title === '') {
    const first = turns[0].prompts.length > 0 ? turns[0].prompts[0].text : ''
    title = first === '' ? '未命名会话' : truncateText(first.split('\n')[0], 60)
  }

  let gist = ''
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    if (turns[index].status !== 'running' && turns[index].gist !== '') {
      gist = turns[index].gist
      break
    }
  }
  if (gist === '') {
    for (let index = turns.length - 1; index >= 0; index -= 1) {
      if (turns[index].gist !== '') {
        gist = turns[index].gist
        break
      }
    }
  }

  return {
    id: header.id,
    title,
    path: cwd,
    name: cwd !== '' ? basename(cwd) : '—',
    turns: turns.length,
    prompts: turns.reduce((sum, turn) => sum + turn.prompts.length, 0),
    lastAt: turns.reduce((latest, turn) => Math.max(latest, turn.at), 0),
    status: turns[turns.length - 1].status,
    gist,
  }
}

/** Deduplicate session highlights by title, newest first. */
function mergeHighlights(highlights) {
  const seen = new Map()
  for (const highlight of highlights) {
    const title = typeof highlight.title === 'string' ? highlight.title.trim() : ''
    if (title === '') continue
    const key = title.toLowerCase()
    const previous = seen.get(key)
    if (previous === undefined || previous.at < highlight.at) {
      seen.set(key, { title, at: highlight.at, gist: typeof highlight.gist === 'string' ? highlight.gist : '' })
    }
  }
  return [...seen.values()].sort((left, right) => right.at - left.at)
}

/** One concise written gist from an assistant message. */
function gistOf(text) {
  const prose = toReadableProse(text)
    .replace(/^\s*(?:[-*+]|\d{1,2}[.)])\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (prose === '') return ''
  const withoutPreamble = prose.replace(/^(?:好的|好|可以|没问题|收到)[，,。.!！:：\s]+/, '')
  const flat = withoutPreamble === '' ? prose : withoutPreamble
  const sentences = flat
    .split(/(?<=[。！？!?])\s*/)
    .flatMap((sentence) => sentence.split(/[；;]\s*/))
    .map((part) => part.trim())
    .filter((part) => part.length >= 8)
  if (sentences.length === 0) return clipGist(flat, MAX_GIST_TEXT)

  // Pick the most outcome-like of the first few sentences or semicolon
  // clauses: a conclusion beats a sentence that is mostly an endpoint, file
  // name, or data dump.
  let chosen = sentences[0]
  let best = Number.NEGATIVE_INFINITY
  for (let index = 0; index < Math.min(sentences.length, 8); index += 1) {
    const sentence = sentences[index]
    let score = 0.5 - index * 0.6
    if (/修复|完成|新增|调整|改为|实现|支持|优化|移除|统一|补充|创建|迁移|生成|通过|结论|原因|问题|发现/.test(sentence)) {
      score += 3
    }
    if (/https?:\/\/|\{[^}]*\}|(?:^|\s)\/[^\s]+/.test(sentence)) score -= 2
    if (/\.(?:csv|json|log|go|vue|tsx?|jsx?|md|py)\b/i.test(sentence)) score -= 1
    if (/[一二三四五六七八九十]+、[^。！？]{0,24}[一二三四五六七八九十]+、/.test(sentence)) score -= 5
    if (index === 0) score += 0.5
    if (score > best) {
      best = score
      chosen = sentence
    }
  }
  return clipGist(chosen, MAX_GIST_TEXT)
}

/** Clip a gist at a natural break, falling back to a hard cut with an ellipsis. */
function clipGist(text, limit) {
  const clean = text.trim()
  if (clean.length <= limit) return clean
  const slice = clean.slice(0, limit)
  const cut = Math.max(
    slice.lastIndexOf('。'),
    slice.lastIndexOf('；'),
    slice.lastIndexOf('，'),
    slice.lastIndexOf(';'),
    slice.lastIndexOf('. '),
    slice.lastIndexOf(' '),
  )
  if (cut >= Math.floor(limit * 0.5)) {
    return slice.slice(0, cut).replace(/[。；;，,、:：\s]+$/g, '') + '…'
  }
  const trimmed = slice.replace(/\s+\S*$/, '')
  return (trimmed.length >= Math.floor(limit * 0.5) ? trimmed : slice) + '…'
}

/** Flatten the text blocks of a user or assistant message. */
function textOfMessage(message) {
  const content = message.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    if (block.type !== 'text' || typeof block.text !== 'string') continue
    if (block.text.trim() === '') continue
    parts.push(block.text)
  }
  return parts.join('\n')
}

/** Trim and collapse prompt whitespace without changing its wording. */
function cleanPrompt(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Turn an assistant answer into readable prose: drop fenced code and Markdown
 * tables, unwrap headings, bold, links, and inline code. Bullet and numbered
 * lists survive because they carry the feature list.
 */
function toReadableProse(text) {
  return text
    .replace(/```[^\n]*\n[\s\S]*?```/g, '')
    .replace(/~~~[^\n]*\n[\s\S]*?~~~/g, '')
    .replace(/^\s*\|.*\|\s*$/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function truncateText(text, limit) {
  const clean = text.trim()
  if (clean.length <= limit) return clean
  return clean.slice(0, limit).replace(/\s+\S*$/, '') + '…'
}

/**
 * Which stored sessions were written inside the range, when the persistence
 * service can report their files. Sessions untouched in the range cannot carry
 * events there, so skipping them avoids replaying the whole corpus.
 * @returns a map from session id to file mtime, or `undefined` when unknown.
 */
async function sessionFreshness(ctx, range) {
  const persistence = optionalService(ctx, 'sessionPersistence')
  if (persistence === undefined || typeof persistence.list !== 'function') return undefined
  let snapshots
  try {
    snapshots = await persistence.list()
  } catch {
    return undefined
  }
  if (!Array.isArray(snapshots)) return undefined

  const fresh = new Map()
  for (const snapshot of snapshots) {
    if (snapshot === null || typeof snapshot !== 'object') continue
    const header = snapshot.header !== null && typeof snapshot.header === 'object' ? snapshot.header : undefined
    if (header === undefined || typeof header.id !== 'string') continue
    const location = snapshot.location !== null && typeof snapshot.location === 'object' ? snapshot.location : undefined
    const path = location !== undefined && typeof location.path === 'string' ? location.path : ''
    if (path === '') continue
    try {
      const info = await stat(path)
      fresh.set(header.id, info.mtimeMs)
    } catch {
      // An unreadable file stays unknown, so the session is still read.
    }
  }
  return fresh.size > 0 ? fresh : undefined
}

/** Run `task` over `items` with a bounded number of concurrent calls. */
async function mapWithConcurrency(items, limit, task) {
  const results = new Array(items.length)
  let cursor = 0
  const workers = []
  const width = Math.max(1, Math.min(limit, items.length))
  for (let index = 0; index < width; index += 1) {
    workers.push(
      (async () => {
        for (;;) {
          const current = cursor
          cursor += 1
          if (current >= items.length) return
          results[current] = await task(items[current])
        }
      })(),
    )
  }
  await Promise.all(workers)
  return results
}

/* ------------------------------------------------------------------ */
/* Agent tools                                                         */
/* ------------------------------------------------------------------ */

function summaryTool(worklog) {
  return {
    name: 'worklog_summary',
    description:
      'Summarize the work done in this workspace for one day, one week, or a custom date range. ' +
      'The result is list-based and concise: for each project it lists one short highlight per session (the ' +
      "session title plus a one-line summary of the assistant's final outcome), then a compact by-day list of " +
      'sessions. Use it when the user asks for a daily or weekly report, a work summary, or what got done in a ' +
      'time range. It never reports code-line statistics. Use worklog_todo to record or change todos.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        range: {
          type: 'string',
          enum: ['day', 'week', 'custom'],
          description: 'day (default), week (Monday to Sunday), or custom (requires start and end).',
        },
        date: {
          type: 'string',
          description: 'Anchor date in YYYY-MM-DD for day or week ranges; defaults to today.',
        },
        start: {
          type: 'string',
          description: 'First day of a custom range, YYYY-MM-DD.',
        },
        end: {
          type: 'string',
          description: 'Last day of a custom range, YYYY-MM-DD.',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          text: { type: 'string' },
          range: { type: 'object' },
          totals: { type: 'object' },
          projects: { type: 'array', items: { type: 'object' } },
          days: { type: 'array', items: { type: 'object' } },
          todos: { type: 'object' },
        },
        required: ['text'],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text:
            value !== null && typeof value === 'object' && typeof value.text === 'string'
              ? value.text
              : 'Work summary unavailable.',
        },
      ],
    },
    async execute(args) {
      const input = args !== null && typeof args === 'object' ? args : {}
      const params = new URLSearchParams()
      params.set('range', typeof input.range === 'string' ? input.range : 'week')
      if (typeof input.date === 'string') params.set('date', input.date)
      if (typeof input.start === 'string') params.set('start', input.start)
      if (typeof input.end === 'string') params.set('end', input.end)
      const range = resolveRange(params)
      const data = await worklog.summary(range, false)
      return {
        text: summarizeForModel(data),
        range: data.range,
        totals: data.totals,
        projects: data.projects,
        todos: data.todos,
      }
    },
  }
}

function todoTool(worklog) {
  return {
    name: 'worklog_todo',
    description:
      'Record and manage the unified project todo list shown on the Work log and todos page of the sidebar. ' +
      'When the user asks to note, remember, add, or track a todo (including while working in a specific project), ' +
      'call this tool with action=add. The project defaults to the current repository, and every project\'s todos ' +
      'live in one shared list visible in all sessions. Use action=list to read the list, and update, complete, ' +
      'reopen, or remove to change an existing item. Every rendered todo line carries its 8-character id; those ' +
      'actions accept that id, and complete/reopen/remove also accept the exact title when the id is unknown.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: {
          type: 'string',
          enum: ['add', 'list', 'update', 'complete', 'reopen', 'remove'],
          description: 'What to do with the unified todo list.',
        },
        id: {
          type: 'string',
          description: 'Todo id or its 8-character prefix; required for update, optional for complete/reopen/remove when title is given.',
        },
        title: {
          type: 'string',
          description: 'Todo text. Required for add; the replacement title when updating; or the exact target title for complete/reopen/remove.',
        },
        project: {
          type: 'string',
          description: 'Project or repository the todo belongs to; defaults to the current repository.',
        },
        priority: {
          type: 'string',
          enum: ['high', 'normal', 'low'],
          description: 'Relative priority; defaults to normal.',
        },
        note: {
          type: 'string',
          description: 'Optional detail or context for the todo.',
        },
        dueDate: {
          type: 'string',
          description: 'Optional due date in YYYY-MM-DD.',
        },
        status: {
          type: 'string',
          enum: ['open', 'done'],
          description: 'Optional status when updating a todo.',
        },
        filter: {
          type: 'string',
          enum: ['all', 'open', 'done'],
          description: 'List filter for action=list; defaults to all.',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          ok: { type: 'boolean' },
          message: { type: 'string' },
          todo: { type: 'object' },
          todos: { type: 'array', items: { type: 'object' } },
          counts: { type: 'object' },
        },
        required: ['ok', 'message'],
      },
      render: (_args, value) => [
        { type: 'text', text: renderTodoResult(value) },
      ],
    },
    async execute(args, exec) {
      const input = args !== null && typeof args === 'object' ? args : {}
      const action = typeof input.action === 'string' ? input.action : 'list'
      if (action === 'add') {
        const title = clampText(input.title, MAX_TODO_TITLE)
        if (title === '') throw new Error('todo title must not be empty')
        const project =
          typeof input.project === 'string' && input.project.trim() !== ''
            ? input.project.trim()
            : worklog.resolveAgentProject(exec)
        const todo = await worklog.addTodoForAgent({
          title,
          project,
          priority: PRIORITIES.includes(input.priority) ? input.priority : 'normal',
          note: input.note,
          dueDate: input.dueDate,
          sessionId: exec !== undefined && exec.agent !== undefined ? String(exec.agent.id) : '',
        })
        const todos = await worklog.listTodos()
        return {
          ok: true,
          message: 'Todo added: ' + todo.title + ' (' + todo.project + ') [id: ' + shortTodoId(todo) + ']',
          todo,
          todos,
          counts: countsOf(todos),
        }
      }
      const todos = await worklog.listTodos()
      if (action === 'list') {
        const filter = input.filter === 'open' || input.filter === 'done' ? input.filter : 'all'
        const filtered = filter === 'all' ? todos : todos.filter((todo) => todo.status === filter)
        return {
          ok: true,
          message: describeTodoList(filtered, countsOf(todos)),
          todos: filtered,
          counts: countsOf(todos),
        }
      }
      const id = typeof input.id === 'string' ? input.id : ''
      if (action === 'remove') {
        const target = await worklog.resolveTodo(id, input.title, input.project)
        const removed = await worklog.removeTodo(target.id)
        const next = await worklog.listTodos()
        return {
          ok: true,
          message: 'Todo removed: ' + removed.title + ' [id: ' + shortTodoId(removed) + ']',
          todo: removed,
          todos: next,
          counts: countsOf(next),
        }
      }
      if (action === 'complete' || action === 'reopen') {
        const target = await worklog.resolveTodo(id, input.title, input.project)
        const updated = await worklog.updateTodo(target.id, { status: action === 'complete' ? 'done' : 'open' })
        const next = await worklog.listTodos()
        return {
          ok: true,
          message:
            (action === 'complete' ? 'Todo completed: ' : 'Todo reopened: ') +
            updated.title +
            ' [id: ' +
            shortTodoId(updated) +
            ']',
          todo: updated,
          todos: next,
          counts: countsOf(next),
        }
      }
      const target = await worklog.resolveTodo(id)
      const patch = {}
      if (input.title !== undefined) {
        const title = clampText(input.title, MAX_TODO_TITLE)
        if (title === '') throw new Error('todo title must not be empty')
        patch.title = title
      }
      if (input.project !== undefined) patch.project = input.project
      if (input.priority !== undefined) patch.priority = input.priority
      if (input.note !== undefined) patch.note = input.note
      if (input.dueDate !== undefined) patch.dueDate = input.dueDate
      if (input.status !== undefined) patch.status = input.status
      const updated = await worklog.updateTodo(target.id, patch)
      const next = await worklog.listTodos()
      return {
        ok: true,
        message: 'Todo updated: ' + updated.title + ' [id: ' + shortTodoId(updated) + ']',
        todo: updated,
        todos: next,
        counts: countsOf(next),
      }
    },
  }
}

function describeTodoList(todos, counts) {
  if (todos.length === 0) {
    return 'No todos' + (counts.total === 0 ? ' recorded yet.' : ' match this filter.')
  }
  const lines = [
    'Todos: ' + String(counts.open) + ' open, ' + String(counts.done) + ' done, ' + String(counts.total) + ' total.',
  ]
  for (const todo of todos.slice(0, 40)) {
    lines.push(
      (todo.status === 'done' ? '- [x] ' : '- [ ] ') +
        todo.title +
        ' — ' +
        todo.project +
        (todo.dueDate !== '' ? ' (due ' + todo.dueDate + ')' : '') +
        ' [id: ' + shortTodoId(todo) + ']',
    )
  }
  return lines.join('\n')
}

function renderTodoResult(value) {
  if (value === null || typeof value !== 'object') return 'Todo operation finished.'
  const message = typeof value.message === 'string' ? value.message : 'Todo operation finished.'
  const lines = [message]
  const counts = value.counts !== null && typeof value.counts === 'object' ? value.counts : undefined
  if (counts !== undefined && typeof counts.open === 'number' && typeof counts.done === 'number') {
    lines.push(
      'Open: ' +
        String(counts.open) +
        ' · Done: ' +
        String(counts.done) +
        ' · Total: ' +
        String(typeof counts.total === 'number' ? counts.total : counts.open + counts.done),
    )
  }
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* Model-facing digest                                                 */
/* ------------------------------------------------------------------ */

function summarizeForModel(data) {
  const MAX_DIGEST_HIGHLIGHTS = 6
  const MAX_DIGEST_SESSIONS = 40
  const lines = []

  lines.push('# Work summary: ' + data.range.label + ' (' + data.range.kind + ')')
  lines.push('')
  lines.push(
    'Totals: ' +
      count(data.totals.sessions, 'session') +
      ', ' +
      count(data.totals.prompts, 'request') +
      ', ' +
      count(data.totals.turns, 'turn') +
      ' across ' +
      count(data.totals.projects, 'project') +
      '.',
  )

  lines.push('')
  lines.push('## Projects and changes')
  if (data.projects.length === 0) {
    lines.push('No project activity in this range.')
  } else {
    for (const project of data.projects) {
      lines.push('')
      lines.push('### ' + project.name + (project.path !== '' ? ' — ' + project.path : ''))
      lines.push(count(project.sessions, 'session') + ' · last activity ' + shortLocalTime(project.lastAt))
      const highlights = Array.isArray(project.highlights) ? project.highlights : []
      if (highlights.length === 0) {
        lines.push('- No written outcome was recorded for this project.')
      } else {
        for (const highlight of highlights.slice(0, MAX_DIGEST_HIGHLIGHTS)) {
          const gist = typeof highlight.gist === 'string' ? highlight.gist : ''
          lines.push('- ' + highlight.title + (gist !== '' ? '：' + gist : ''))
        }
        const total = typeof project.highlightTotal === 'number' ? project.highlightTotal : highlights.length
        if (total > MAX_DIGEST_HIGHLIGHTS) {
          lines.push('- … ' + String(total - MAX_DIGEST_HIGHLIGHTS) + ' more session(s)')
        }
      }
    }
  }

  lines.push('')
  lines.push('## By day')
  if (data.days.length === 0) {
    lines.push('No session activity was found in this range.')
  } else {
    let budget = MAX_DIGEST_SESSIONS
    for (const day of data.days) {
      if (budget <= 0) break
      lines.push('### ' + day.date)
      for (const project of day.projects) {
        if (budget <= 0) break
        for (const session of project.sessions) {
          if (budget <= 0) break
          lines.push(
            '- ' +
              project.name +
              ' · ' +
              session.title +
              ' — ' +
              count(session.turns, 'turn') +
              (session.status !== 'completed' && session.status !== '' ? ' (' + session.status + ')' : ''),
          )
          budget -= 1
        }
      }
      if (budget <= 0) {
        lines.push('… More sessions are available on the Work log and todos page.')
      }
    }
  }

  lines.push('')
  lines.push('## Todos')
  lines.push(
    String(data.todos.open) + ' open, ' + String(data.todos.done) + ' done, ' + String(data.todos.total) + ' total.',
  )
  return lines.join('\n')
}

function count(value, noun) {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return String(number) + ' ' + noun + (number === 1 ? '' : 's')
}

/** Render an ISO timestamp as `YYYY-MM-DD HH:MM` in local time. */
function shortLocalTime(iso) {
  if (typeof iso !== 'string' || iso === '') return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const pad = (value) => String(value).padStart(2, '0')
  return (
    String(date.getFullYear()) +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    ' ' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes())
  )
}

/* ------------------------------------------------------------------ */
/* HTTP helpers                                                        */
/* ------------------------------------------------------------------ */

function sendJson(response, status, body) {
  const text = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
  })
  response.end(text)
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = []
    let size = 0
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        rejectBody(new Error('request body is too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        const parsed = text.trim() === '' ? {} : JSON.parse(text)
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          rejectBody(new Error('request body must be a JSON object'))
          return
        }
        resolveBody(parsed)
      } catch {
        rejectBody(new Error('request body is not valid JSON'))
      }
    })
    request.on('error', rejectBody)
  })
}

function messageOf(error) {
  if (error instanceof Error) return error.message
  return String(error)
}
