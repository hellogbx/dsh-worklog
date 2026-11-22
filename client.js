/**
 * Browser half of the "work log" plugin.
 *
 * It owns two seats under one id: the icon row in the left sidebar
 * (`sidebar.panellist`) and the page the layout renders for that id (`main`).
 * The summary and the unified todo list come from the Host half's
 * `/plugin-worklog/*` routes.
 */
window.__ModuleLoader__.load({
  id: '@hellogbx/dsh-worklog',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const SUMMARY_ENDPOINT = '/plugin-worklog/summary'
    const TODOS_ENDPOINT = '/plugin-worklog/todos'
    const NS = 'worklog'
    const PANEL_ID = 'worklog'
    const POLL_MS = 15000

    const DICTS = {
      zh: {
        nav: '工作总结与待办',
        title: '工作总结与待办',
        subtitle: '按项目列出具体涉及事项，周期内的会话按天归并，待办统一记录在这里',
        tabSummary: '工作总结',
        tabTodos: '待办事项',
        modeDay: '今日',
        modeWeek: '本周',
        modeCustom: '自定义',
        dateLabel: '日期',
        startLabel: '开始',
        endLabel: '结束',
        refresh: '刷新',
        refreshing: '刷新中',
        loading: '正在汇总会话…',
        loadError: '汇总失败',
        retry: '重试',
        emptyTitle: '这个区间还没有会话记录',
        emptyHint: '换个区间再试；待办事项不受影响。',
        metaLine: '{sessions} 个会话 · {prompts} 条需求 · {turns} 轮 · {projects} 个项目 · {todos} 条未完成待办',
        byProject: '项目改动',
        byDay: '按天回顾',
        changesLabel: '涉及事项',
        noChanges: '这个区间没有提取到具体事项',
        moreSessions: '另有 {count} 个会话未展示',
        sessionMeta: '{turns} 轮',
        dayMeta: '{sessions} 个会话 · {prompts} 条需求 · {turns} 轮',
        projectMeta: '{sessions} 个会话',
        lastActivity: '最后活动 {time}',
        statusRunning: '进行中',
        statusAborted: '已中止',
        statusError: '出错',
        statusInterrupted: '已中断',
        statusBlocked: '已阻止',
        statusMaxTokens: '超出长度',
        statusOther: '已结束',
        todoTitle: '待办事项',
        todoHint: '所有项目的待办统一记录、统一展示；也可以直接让我在会话里记录。',
        addPlaceholder: '添加一条待办，例如：补充 K8s 利用率接口的单元测试',
        projectLabel: '项目',
        priorityLabel: '优先级',
        priorityHigh: '高',
        priorityNormal: '普通',
        priorityLow: '低',
        dueLabel: '截止日期',
        add: '添加',
        adding: '添加中…',
        filterAll: '全部',
        filterOpen: '未完成',
        filterDone: '已完成',
        projectAll: '全部项目',
        sourceUser: '手动记录',
        sourceAgent: '会话记录',
        delete: '删除',
        deleteConfirm: '删除待办「{title}」？',
        edit: '编辑',
        save: '保存',
        cancel: '取消',
        created: '创建于 {time}',
        dueAt: '截止 {date}',
        emptyTodos: '还没有待办',
        emptyTodosHint: '在上方输入一条待办，或让我在会话中帮你记录。',
        emptyFiltered: '没有符合筛选条件的待办',
        updatedAt: '更新于 {time}',
        scannedSessions: '已扫描 {count} 个会话',
        todoError: '待办操作失败',
        todoCount: '{count} 条未完成',
        wd0: '周日',
        wd1: '周一',
        wd2: '周二',
        wd3: '周三',
        wd4: '周四',
        wd5: '周五',
        wd6: '周六',
      },
      en: {
        nav: 'Work log and todos',
        title: 'Work log and todos',
        subtitle: 'Concrete work items per project, with sessions grouped by day and one shared todo list',
        tabSummary: 'Summary',
        tabTodos: 'Todos',
        modeDay: 'Day',
        modeWeek: 'Week',
        modeCustom: 'Custom',
        dateLabel: 'Date',
        startLabel: 'From',
        endLabel: 'To',
        refresh: 'Refresh',
        refreshing: 'Refreshing',
        loading: 'Collecting sessions…',
        loadError: 'Could not build the summary',
        retry: 'Retry',
        emptyTitle: 'No sessions in this range',
        emptyHint: 'Pick another range; todos are unaffected.',
        metaLine: '{sessions} sessions · {prompts} requests · {turns} turns · {projects} projects · {todos} open todos',
        byProject: 'Project changes',
        byDay: 'By day',
        changesLabel: 'Work items',
        noChanges: 'No written outcome in this range',
        moreSessions: '{count} more sessions not shown',
        sessionMeta: '{turns} turns',
        dayMeta: '{sessions} sessions · {prompts} requests · {turns} turns',
        projectMeta: '{sessions} sessions',
        lastActivity: 'Last active {time}',
        statusRunning: 'Running',
        statusAborted: 'Aborted',
        statusError: 'Error',
        statusInterrupted: 'Interrupted',
        statusBlocked: 'Blocked',
        statusMaxTokens: 'Max tokens',
        statusOther: 'Ended',
        todoTitle: 'Todos',
        todoHint: 'Every project records into one list; ask me in a session and I will add one too.',
        addPlaceholder: 'Add a todo, for example: cover the utilization endpoint with unit tests',
        projectLabel: 'Project',
        priorityLabel: 'Priority',
        priorityHigh: 'High',
        priorityNormal: 'Normal',
        priorityLow: 'Low',
        dueLabel: 'Due',
        add: 'Add',
        adding: 'Adding…',
        filterAll: 'All',
        filterOpen: 'Open',
        filterDone: 'Done',
        projectAll: 'All projects',
        sourceUser: 'Recorded here',
        sourceAgent: 'Recorded in chat',
        delete: 'Delete',
        deleteConfirm: 'Delete todo “{title}”?',
        edit: 'Edit',
        save: 'Save',
        cancel: 'Cancel',
        created: 'Created {time}',
        dueAt: 'Due {date}',
        emptyTodos: 'No todos yet',
        emptyTodosHint: 'Add one above, or ask me in a session to record it.',
        emptyFiltered: 'No todos match these filters',
        updatedAt: 'Updated {time}',
        scannedSessions: 'Scanned {count} sessions',
        todoError: 'Todo operation failed',
        todoCount: '{count} open',
        wd0: 'Sun',
        wd1: 'Mon',
        wd2: 'Tue',
        wd3: 'Wed',
        wd4: 'Thu',
        wd5: 'Fri',
        wd6: 'Sat',
      },
    }

    const CSS = [
      '.dwl-page{height:100%;overflow:auto;box-sizing:border-box;',
      'padding:calc(var(--dsh-frame-top-clearance, 0px) + 24px) 32px 56px;',
      'color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);}',
      '.dwl-inner{max-width:980px;margin:0 auto;font-size:13px;line-height:1.5;}',
      '.dwl-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;}',
      '.dwl-title{margin:0;font-size:20px;font-weight:600;letter-spacing:-0.01em;}',
      '.dwl-sub{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:13px;}',
      '.dwl-button{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:transparent;',
      'color:inherit;border-radius:8px;padding:6px 12px;font:inherit;font-size:13px;cursor:pointer;',
      'white-space:nowrap;flex:none;}',
      '.dwl-button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);}',
      '.dwl-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;}',
      '.dwl-button:disabled{opacity:.55;cursor:default;}',
      '.dwl-button.is-primary{border-color:transparent;background:var(--dsw-alias-label-primary);',
      'color:var(--dsw-alias-bg-base);}',
      '.dwl-button.is-primary:hover:not(:disabled){background:var(--dsw-alias-label-primary);opacity:.9;}',
      '.dwl-tabs{display:inline-flex;gap:2px;padding:3px;margin-top:20px;border-radius:9px;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);}',
      '.dwl-tab{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);',
      'font:inherit;font-size:13px;padding:5px 14px;border-radius:7px;cursor:pointer;}',
      '.dwl-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}',
      '.dwl-tab.is-active{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-weight:500;}',
      '.dwl-tab-count{display:inline-block;margin-left:6px;font-size:11px;color:var(--dsw-alias-label-secondary);',
      'font-variant-numeric:tabular-nums;}',
      '.dwl-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:16px;}',
      '.dwl-segmented{display:inline-flex;gap:2px;padding:2px;border-radius:8px;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);}',
      '.dwl-seg{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);',
      'font:inherit;font-size:13px;padding:5px 11px;border-radius:6px;cursor:pointer;}',
      '.dwl-seg:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}',
      '.dwl-seg.is-active{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-weight:500;}',
      '.dwl-field{display:inline-flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary);font-size:12px;}',
      '.dwl-input{appearance:none;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;',
      'background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;',
      'padding:6px 10px;box-sizing:border-box;min-height:30px;}',
      '.dwl-input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}',
      '.dwl-input.is-date{font-variant-numeric:tabular-nums;}',
      '.dwl-input.is-grow{flex:1;min-width:200px;}',
      '.dwl-input.is-edit{flex:1;width:auto;min-width:120px;}',
      '.dwl-layout{margin-top:22px;}',
      '.dwl-meta-line{margin:0 0 18px;color:var(--dsw-alias-label-secondary);font-size:12px;',
      'font-variant-numeric:tabular-nums;}',
      '.dwl-section{margin-top:26px;}',
      '.dwl-h2{margin:0 0 10px;font-size:14px;font-weight:600;}',
      '.dwl-project{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:14px 16px;',
      'margin-bottom:12px;background:var(--dsw-alias-bg-layer-1);}',
      '.dwl-project-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;}',
      '.dwl-project-name{font-weight:600;font-size:13px;}',
      '.dwl-project-path{margin-top:2px;font-size:11px;color:var(--dsw-alias-label-secondary);word-break:break-all;}',
      '.dwl-project-meta{color:var(--dsw-alias-label-secondary);font-size:11px;',
      'font-variant-numeric:tabular-nums;white-space:nowrap;}',
      '.dwl-label{margin:12px 0 0;font-size:11px;font-weight:600;letter-spacing:.04em;',
      'color:var(--dsw-alias-label-secondary);}',
      '.dwl-list{margin:6px 0 0;padding:0 0 0 18px;display:flex;flex-direction:column;gap:4px;}',
      '.dwl-list li{font-size:12.5px;line-height:1.55;word-break:break-word;}',
      '.dwl-list li::marker{color:var(--dsw-alias-label-secondary);}',
      '.dwl-item-title{font-weight:600;color:var(--dsw-alias-label-primary);}',
      '.dwl-more{margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:11px;}',
      '.dwl-day{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:14px 16px;',
      'margin-bottom:12px;background:var(--dsw-alias-bg-layer-1);}',
      '.dwl-day-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;}',
      '.dwl-day-date{font-weight:600;font-variant-numeric:tabular-nums;}',
      '.dwl-day-meta{color:var(--dsw-alias-label-secondary);font-size:12px;font-variant-numeric:tabular-nums;}',
      '.dwl-day-project{margin-top:10px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l1);}',
      '.dwl-day-project-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;',
      'font-size:12px;font-weight:500;}',
      '.dwl-day-project-path{color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:400;',
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.dwl-session{margin-top:8px;padding-top:7px;border-top:1px dashed var(--dsw-alias-border-l1);}',
      '.dwl-session-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;}',
      '.dwl-session-title{font-weight:500;font-size:12.5px;word-break:break-word;}',
      '.dwl-session-meta{color:var(--dsw-alias-label-secondary);font-size:11px;white-space:nowrap;',
      'font-variant-numeric:tabular-nums;}',
      '.dwl-session-status{margin-top:4px;}',
      '.dwl-badge.is-status{color:var(--dsw-alias-state-warn-primary);',
      'border-color:var(--dsw-alias-state-warn-primary);}',
      '.dwl-todo-panel{margin-top:18px;}',
      '.dwl-todo-form{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px;',
      'border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);}',
      '.dwl-todo-form-label{display:inline-flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary);font-size:12px;}',
      '.dwl-filters{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:16px;}',
      '.dwl-group{margin-top:16px;}',
      '.dwl-group-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;',
      'padding:0 2px 6px;font-size:12px;color:var(--dsw-alias-label-secondary);}',
      '.dwl-group-name{color:var(--dsw-alias-label-primary);font-weight:600;font-size:13px;}',
      '.dwl-todos{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);',
      'overflow:hidden;}',
      '.dwl-todo{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;',
      'border-bottom:1px solid var(--dsw-alias-border-l1);}',
      '.dwl-todo:last-child{border-bottom:0;}',
      '.dwl-check{appearance:none;width:16px;height:16px;flex:none;margin-top:2px;padding:0;',
      'border-radius:50%;border:1.5px solid var(--dsw-alias-border-l2);background:transparent;cursor:pointer;',
      'position:relative;}',
      '.dwl-check:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;}',
      '.dwl-check.is-done{border-color:var(--dsw-alias-state-success-primary);',
      'background:var(--dsw-alias-state-success-primary);}',
      '.dwl-check.is-done::after{content:"";position:absolute;left:4.5px;top:1.5px;width:4px;height:8px;',
      'border:1.5px solid var(--dsw-alias-bg-base);border-top:0;border-left:0;transform:rotate(45deg);}',
      '.dwl-todo-main{flex:1;min-width:0;}',
      '.dwl-todo-title{display:block;width:100%;text-align:left;appearance:none;border:0;background:transparent;',
      'color:inherit;font:inherit;font-size:13px;padding:0;cursor:text;word-break:break-word;}',
      '.dwl-todo-title.is-done{text-decoration:line-through;color:var(--dsw-alias-label-secondary);}',
      '.dwl-todo-title:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;border-radius:4px;}',
      '.dwl-todo-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px;',
      'color:var(--dsw-alias-label-secondary);font-size:11px;}',
      '.dwl-todo-note{margin-top:5px;color:var(--dsw-alias-label-secondary);font-size:12px;',
      'word-break:break-word;white-space:pre-wrap;}',
      '.dwl-badge{display:inline-flex;align-items:center;border:1px solid var(--dsw-alias-border-l1);',
      'border-radius:999px;padding:0 7px;font-size:10px;line-height:16px;color:var(--dsw-alias-label-secondary);}',
      '.dwl-badge.is-high{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);}',
      '.dwl-badge.is-low{opacity:.8;}',
      '.dwl-icon-button{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);',
      'font:inherit;font-size:16px;line-height:1;padding:2px 5px;border-radius:6px;cursor:pointer;flex:none;}',
      '.dwl-icon-button:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}',
      '.dwl-icon-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}',
      '.dwl-inline-actions{display:flex;align-items:center;gap:6px;width:100%;}',
      '.dwl-notice{margin-top:18px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;',
      'padding:18px;background:var(--dsw-alias-bg-layer-1);}',
      '.dwl-notice-title{margin:0 0 4px;font-size:14px;font-weight:500;}',
      '.dwl-note{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;}',
      '.dwl-error{color:var(--dsw-alias-state-error-primary);font-size:12px;word-break:break-word;margin:0 0 6px;}',
      '.dwl-foot{margin:24px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;',
      'font-variant-numeric:tabular-nums;}',
      '.dwl-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;',
      'clip:rect(0,0,0,0);white-space:nowrap;border:0;}',
    ].join('')

    /** Interpolation fallback when the slot seat's translate is unusable. */
    function ownTranslate(key, params) {
      const template = DICTS.en[key] !== undefined ? DICTS.en[key] : key
      if (params === undefined || params === null) return template
      return template.replace(/\{(\w+)\}/g, (match, name) =>
        params[name] !== undefined ? String(params[name]) : match,
      )
    }

    function messageOf(error) {
      if (error instanceof Error) return error.message
      return String(error)
    }

    function pad2(value) {
      return String(value).padStart(2, '0')
    }

    function formatInputDate(date) {
      return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate())
    }

    function parseInputDate(text) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text ?? '').trim())
      if (match === null) return undefined
      const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      return Number.isNaN(date.getTime()) ? undefined : date
    }

    function addDays(date, amount) {
      const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      next.setDate(next.getDate() + amount)
      return next
    }

    function startOfWeek(date) {
      const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      return addDays(day, -((day.getDay() + 6) % 7))
    }

    function todayInput() {
      return formatInputDate(new Date())
    }

    function formatNumber(value) {
      const number = typeof value === 'number' && Number.isFinite(value) ? value : 0
      return String(Math.round(number)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    }

    function formatTime(iso) {
      if (typeof iso !== 'string' || iso === '') return ''
      const date = new Date(iso)
      if (Number.isNaN(date.getTime())) return ''
      return date.toLocaleTimeString()
    }

    function formatDateTime(iso) {
      if (typeof iso !== 'string' || iso === '') return ''
      const date = new Date(iso)
      if (Number.isNaN(date.getTime())) return ''
      return date.toLocaleString()
    }

    function shortTime(iso) {
      if (typeof iso !== 'string' || iso === '') return ''
      const date = new Date(iso)
      if (Number.isNaN(date.getTime())) return ''
      return pad2(date.getHours()) + ':' + pad2(date.getMinutes())
    }

    function weekdayKey(dateText) {
      const date = parseInputDate(dateText)
      if (date === undefined) return 'wd0'
      return 'wd' + String(date.getDay())
    }

    function countAt(source, path) {
      let cursor = source
      for (const step of path) {
        if (cursor === null || cursor === undefined || typeof cursor !== 'object') return 0
        cursor = cursor[step]
      }
      return typeof cursor === 'number' && Number.isFinite(cursor) ? cursor : 0
    }

    function fetchJson(url, init) {
      const requestInit = init === undefined ? { headers: { accept: 'application/json' } } : init
      return fetch(url, requestInit).then(async (response) => {
        let body
        try {
          body = await response.json()
        } catch {
          body = undefined
        }
        if (!response.ok) {
          const detail = body !== null && typeof body === 'object' && typeof body.error === 'string' ? body.error : ''
          throw new Error(detail !== '' ? detail : 'HTTP ' + String(response.status))
        }
        if (body !== null && typeof body === 'object' && typeof body.error === 'string') {
          throw new Error(body.error)
        }
        return body
      })
    }

    /** Sidebar row icon: a clipboard with a check mark. */
    function WorklogIcon(props) {
      const size =
        props !== null && props !== undefined && typeof props.size === 'number' && props.size > 0 ? props.size : 16
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          'aria-hidden': true,
          focusable: false,
          style: { display: 'block' },
        },
        h('rect', {
          x: 3,
          y: 2.1,
          width: 10,
          height: 12,
          rx: 2,
          stroke: 'currentColor',
          strokeWidth: 1.3,
        }),
        h('rect', { x: 5.7, y: 1.1, width: 4.6, height: 2.2, rx: 1, fill: 'currentColor' }),
        h('path', {
          d: 'M5.5 8.2l1.6 1.6 3.5-3.6',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
        h('path', {
          d: 'M5.5 11.6h5',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinecap: 'round',
          opacity: 0.6,
        }),
      )
    }

    function Segmented(props) {
      return h(
        'div',
        { className: 'dwl-segmented', role: 'group', 'aria-label': props.ariaLabel },
        props.options.map((option) =>
          h(
            'button',
            {
              key: option.value,
              type: 'button',
              className: 'dwl-seg' + (option.value === props.value ? ' is-active' : ''),
              'aria-pressed': option.value === props.value ? 'true' : 'false',
              onClick: () => props.onChange(option.value),
            },
            option.label,
          ),
        ),
      )
    }

    /** Localized label for a turn-end status; completed turns render no badge. */
    function statusLabel(t, status) {
      const keys = {
        running: 'statusRunning',
        aborted: 'statusAborted',
        error: 'statusError',
        interrupted: 'statusInterrupted',
        blocked: 'statusBlocked',
        'max-tokens': 'statusMaxTokens',
      }
      const key = keys[status]
      return key !== undefined ? t(key) : t('statusOther')
    }

    function SessionBlock(props) {
      const t = props.t
      const session = props.session
      return h(
        'div',
        { className: 'dwl-session' },
        h(
          'div',
          { className: 'dwl-session-head' },
          h('span', { className: 'dwl-session-title', title: String(session.title) }, String(session.title)),
          h(
            'span',
            { className: 'dwl-session-meta' },
            t('sessionMeta', {
              turns: formatNumber(session.turns),
            }) +
              ' · ' +
              formatDateTime(session.lastAt),
          ),
        ),
        session.status !== undefined && session.status !== '' && session.status !== 'completed'
          ? h(
              'div',
              { className: 'dwl-session-status' },
              h('span', { className: 'dwl-badge is-status' }, statusLabel(t, String(session.status))),
            )
          : null,
      )
    }

    function DayCard(props) {
      const t = props.t
      const day = props.day
      const projects = Array.isArray(day.projects) ? day.projects : []
      return h(
        'div',
        { className: 'dwl-day' },
        h(
          'div',
          { className: 'dwl-day-head' },
          h(
            'span',
            { className: 'dwl-day-date' },
            String(day.date) + ' ' + t(weekdayKey(String(day.date))),
          ),
          h(
            'span',
            { className: 'dwl-day-meta' },
            t('dayMeta', {
              sessions: formatNumber(day.sessions),
              prompts: formatNumber(day.prompts),
              turns: formatNumber(day.turns),
            }),
          ),
        ),
        projects.map((project) =>
          h(
            'div',
            { className: 'dwl-day-project', key: (String(project.path) || String(project.name)) + '@' + String(day.date) },
            h(
              'div',
              { className: 'dwl-day-project-head' },
              h('span', null, String(project.name)),
              h('span', { className: 'dwl-day-project-path', title: String(project.path) }, String(project.path)),
            ),
            (Array.isArray(project.sessions) ? project.sessions : []).map((session) =>
              h(SessionBlock, { key: String(session.id), session, t }),
            ),
          ),
        ),
      )
    }

    function ProjectCard(props) {
      const t = props.t
      const project = props.project
      const highlights = Array.isArray(project.highlights) ? project.highlights : []
      const highlightTotal = typeof project.highlightTotal === 'number' ? project.highlightTotal : highlights.length
      return h(
        'div',
        { className: 'dwl-project' },
        h(
          'div',
          { className: 'dwl-project-head' },
          h(
            'div',
            null,
            h('div', { className: 'dwl-project-name' }, String(project.name)),
            h('div', { className: 'dwl-project-path', title: String(project.path) }, String(project.path)),
          ),
          h(
            'div',
            { className: 'dwl-project-meta' },
            t('projectMeta', {
              sessions: formatNumber(project.sessions),
            }) +
              (project.lastAt !== '' ? ' · ' + t('lastActivity', { time: formatDateTime(project.lastAt) }) : ''),
          ),
        ),
        h('div', { className: 'dwl-label' }, t('changesLabel')),
        highlights.length > 0
          ? h(
              'ul',
              { className: 'dwl-list' },
              highlights.map((highlight, index) => {
                const title = String(highlight.title)
                const gist = typeof highlight.gist === 'string' ? highlight.gist : ''
                return h(
                  'li',
                  { key: index, title: gist === '' ? title : title + '：' + gist },
                  h('strong', { className: 'dwl-item-title' }, title),
                  gist === '' ? '' : '：' + gist,
                )
              }),
            )
          : h('p', { className: 'dwl-note', style: { marginTop: '6px' } }, t('noChanges')),
        highlightTotal > highlights.length
          ? h('p', { className: 'dwl-more' }, t('moreSessions', { count: formatNumber(highlightTotal - highlights.length) }))
          : null,
      )
    }

    function TodoRow(props) {
      const t = props.t
      const todo = props.todo
      const done = todo.status === 'done'
      const editing = props.editingId === todo.id
      const priority = todo.priority === 'high' ? 'high' : todo.priority === 'low' ? 'low' : 'normal'
      return h(
        'div',
        { className: 'dwl-todo' },
        h('button', {
          type: 'button',
          className: 'dwl-check' + (done ? ' is-done' : ''),
          role: 'checkbox',
          'aria-checked': done ? 'true' : 'false',
          'aria-label': (done ? t('filterOpen') : t('filterDone')) + ': ' + String(todo.title),
          disabled: props.busy,
          onClick: () => props.onToggle(todo),
        }),
        h(
          'div',
          { className: 'dwl-todo-main' },
          editing
            ? h(
                'div',
                { className: 'dwl-inline-actions', style: { width: '100%' } },
                h('input', {
                  className: 'dwl-input is-edit',
                  value: props.editingTitle,
                  autoFocus: true,
                  onChange: (event) => props.onEditingTitle(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') props.onSaveEdit(todo)
                    if (event.key === 'Escape') props.onCancelEdit()
                  },
                }),
                h('button', { type: 'button', className: 'dwl-button', onClick: () => props.onSaveEdit(todo) }, t('save')),
                h('button', { type: 'button', className: 'dwl-button', onClick: props.onCancelEdit }, t('cancel')),
              )
            : [
                h(
                  'button',
                  {
                    key: 'title',
                    type: 'button',
                    className: 'dwl-todo-title' + (done ? ' is-done' : ''),
                    title: t('edit'),
                    onClick: () => props.onStartEdit(todo),
                  },
                  String(todo.title),
                ),
                h(
                  'div',
                  { className: 'dwl-todo-meta', key: 'meta' },
                  done ? null : h('span', { className: 'dwl-badge is-' + priority }, t('priority' + priority[0].toUpperCase() + priority.slice(1))),
                  todo.dueDate !== '' ? h('span', null, t('dueAt', { date: String(todo.dueDate) })) : null,
                  h('span', null, todo.source === 'agent' ? t('sourceAgent') : t('sourceUser')),
                  h('span', null, t('created', { time: formatDateTime(todo.createdAt) })),
                ),
                todo.note !== '' && todo.note !== undefined
                  ? h('div', { className: 'dwl-todo-note', key: 'note' }, String(todo.note))
                  : null,
              ],
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dwl-icon-button',
            title: t('delete'),
            'aria-label': t('delete') + ': ' + String(todo.title),
            disabled: props.busy,
            onClick: () => props.onRemove(todo),
          },
          '×',
        ),
      )
    }

    function WorklogPage(props) {
      const translate =
        props !== null && props !== undefined && typeof props.t === 'function'
          ? props.t
          : props !== null && props !== undefined && typeof props.fallbackT === 'function'
            ? props.fallbackT
            : ownTranslate
      const t = (key, params) => translate(key, params)

      const [tab, setTab] = React.useState('summary')
      const [mode, setMode] = React.useState('day')
      const [anchor, setAnchor] = React.useState(todayInput())
      const [startDate, setStartDate] = React.useState(formatInputDate(addDays(new Date(), -6)))
      const [endDate, setEndDate] = React.useState(todayInput())
      const [summaryVersion, setSummaryVersion] = React.useState(0)
      const forceRefresh = React.useRef(false)
      const [summary, setSummary] = React.useState({ status: 'loading', data: null, error: '', refreshing: false })
      const [todoState, setTodoState] = React.useState({ status: 'loading', list: [], error: '' })
      const [todosUpdatedAt, setTodosUpdatedAt] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [draftTitle, setDraftTitle] = React.useState('')
      const [draftProject, setDraftProject] = React.useState('')
      const [draftPriority, setDraftPriority] = React.useState('normal')
      const [draftDue, setDraftDue] = React.useState('')
      const [filterStatus, setFilterStatus] = React.useState('all')
      const [filterProject, setFilterProject] = React.useState('all')
      const [editingId, setEditingId] = React.useState('')
      const [editingTitle, setEditingTitle] = React.useState('')

      React.useEffect(() => {
        let cancelled = false
        setSummary((previous) => ({ ...previous, refreshing: true, error: '' }))
        const params = new URLSearchParams()
        params.set('range', mode)
        if (mode === 'custom') {
          params.set('start', startDate)
          params.set('end', endDate)
        } else {
          params.set('date', anchor)
        }
        if (summaryVersion > 0 && forceRefresh.current) {
          params.set('refresh', '1')
          forceRefresh.current = false
        }
        fetchJson(SUMMARY_ENDPOINT + '?' + params.toString())
          .then((data) => {
            if (cancelled) return
            setSummary({ status: 'ready', data, error: '', refreshing: false })
          })
          .catch((error) => {
            if (cancelled) return
            setSummary((previous) => ({
              status: previous.data === null ? 'error' : 'ready',
              data: previous.data,
              error: messageOf(error),
              refreshing: false,
            }))
          })
        return () => {
          cancelled = true
        }
      }, [mode, anchor, startDate, endDate, summaryVersion])

      React.useEffect(() => {
        let cancelled = false
        const load = () => {
          fetchJson(TODOS_ENDPOINT)
            .then((body) => {
              if (cancelled) return
              const list = body !== null && typeof body === 'object' && Array.isArray(body.todos) ? body.todos : []
              setTodoState({ status: 'ready', list, error: '' })
              setTodosUpdatedAt(new Date().toISOString())
            })
            .catch((error) => {
              if (cancelled) return
              setTodoState((previous) => ({
                status: previous.list.length === 0 ? 'error' : 'ready',
                list: previous.list,
                error: messageOf(error),
              }))
            })
        }
        load()
        const timer = setInterval(load, POLL_MS)
        return () => {
          cancelled = true
          clearInterval(timer)
        }
      }, [])

      const runTodoAction = React.useCallback((payload) => {
        setBusy(true)
        return fetchJson(TODOS_ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(payload),
        })
          .then((body) => {
            const list = body !== null && typeof body === 'object' && Array.isArray(body.todos) ? body.todos : []
            setTodoState({ status: 'ready', list, error: '' })
            setTodosUpdatedAt(new Date().toISOString())
            return body
          })
          .catch((error) => {
            setTodoState((previous) => ({ ...previous, error: messageOf(error) }))
            throw error
          })
          .finally(() => {
            setBusy(false)
          })
      }, [])

      const data = summary.data
      const projects = data !== null && data !== undefined && Array.isArray(data.projects) ? data.projects : []
      const days = data !== null && data !== undefined && Array.isArray(data.days) ? data.days : []
      const projectOptions = React.useMemo(() => {
        const names = []
        const seen = new Set()
        const add = (name) => {
          if (typeof name !== 'string' || name === '' || seen.has(name)) return
          seen.add(name)
          names.push(name)
        }
        for (const project of projects) add(project.name)
        for (const todo of todoState.list) add(todo.project)
        return names
      }, [projects, todoState.list])

      const projectDefaulted = React.useRef(false)
      React.useEffect(() => {
        if (projectDefaulted.current) return
        if (draftProject !== '' || projectOptions.length === 0) return
        projectDefaulted.current = true
        setDraftProject(projectOptions[0])
      }, [draftProject, projectOptions])

      const todos = todoState.list
      const openTodos = todos.filter((todo) => todo.status !== 'done').length
      const visibleTodos = todos
        .filter((todo) => {
          if (filterStatus === 'open' && todo.status === 'done') return false
          if (filterStatus === 'done' && todo.status !== 'done') return false
          if (filterProject !== 'all' && todo.project !== filterProject) return false
          return true
        })
        .slice()
        .sort((left, right) => (left.status === 'done' ? 1 : 0) - (right.status === 'done' ? 1 : 0))
      const groups = []
      const groupIndex = new Map()
      for (const todo of visibleTodos) {
        const key = typeof todo.project === 'string' && todo.project !== '' ? todo.project : '—'
        let group = groupIndex.get(key)
        if (group === undefined) {
          group = { project: key, todos: [] }
          groupIndex.set(key, group)
          groups.push(group)
        }
        group.todos.push(todo)
      }

      const totals = data !== null && data !== undefined && data.totals !== null && typeof data.totals === 'object' ? data.totals : {}
      const sessions = countAt(totals, ['sessions'])
      const prompts = countAt(totals, ['prompts'])
      const turns = countAt(totals, ['turns'])
      const projectCount = countAt(totals, ['projects'])
      const scannedSessions = countAt(totals, ['scanned'])
      const generatedAt = data !== null && data !== undefined ? data.generatedAt : ''

      const refresh = () => {
        forceRefresh.current = true
        setSummaryVersion((value) => value + 1)
      }

      const submitTodo = (event) => {
        event.preventDefault()
        const title = draftTitle.trim()
        if (title === '' || busy) return
        runTodoAction({
          action: 'add',
          title,
          project: draftProject.trim() === '' ? undefined : draftProject.trim(),
          priority: draftPriority,
          dueDate: draftDue === '' ? undefined : draftDue,
        })
          .then(() => {
            setDraftTitle('')
            setDraftDue('')
          })
          .catch(() => {})
      }

      const toggleTodo = (todo) => {
        runTodoAction({ action: todo.status === 'done' ? 'reopen' : 'complete', id: todo.id }).catch(() => {})
      }

      const removeTodo = (todo) => {
        if (typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm(t('deleteConfirm', { title: todo.title }))) {
          return
        }
        runTodoAction({ action: 'remove', id: todo.id }).catch(() => {})
      }

      const startEdit = (todo) => {
        setEditingId(todo.id)
        setEditingTitle(todo.title)
      }

      const saveEdit = (todo) => {
        const title = editingTitle.trim()
        if (title === '') return
        runTodoAction({ action: 'update', id: todo.id, title })
          .then(() => {
            setEditingId('')
            setEditingTitle('')
          })
          .catch(() => {})
      }

      const body = [h('style', { key: 'dwl-style' }, CSS)]
      body.push(
        h(
          'div',
          { className: 'dwl-head', key: 'head' },
          h(
            'div',
            null,
            h('h1', { className: 'dwl-title' }, t('title')),
            h(
              'p',
              { className: 'dwl-sub' },
              data !== null && data !== undefined && data.range !== undefined
                ? String(data.range.label) + ' · ' + t('subtitle')
                : t('subtitle'),
            ),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dwl-button',
              onClick: refresh,
              disabled: summary.refreshing,
              'aria-busy': summary.refreshing ? 'true' : 'false',
            },
            summary.refreshing ? t('refreshing') : t('refresh'),
          ),
        ),
      )

      body.push(
        h(
          'div',
          { className: 'dwl-tabs', role: 'tablist', key: 'tabs' },
          h(
            'button',
            {
              type: 'button',
              role: 'tab',
              className: 'dwl-tab' + (tab === 'summary' ? ' is-active' : ''),
              'aria-selected': tab === 'summary' ? 'true' : 'false',
              onClick: () => setTab('summary'),
            },
            t('tabSummary'),
          ),
          h(
            'button',
            {
              type: 'button',
              role: 'tab',
              className: 'dwl-tab' + (tab === 'todos' ? ' is-active' : ''),
              'aria-selected': tab === 'todos' ? 'true' : 'false',
              onClick: () => setTab('todos'),
            },
            t('tabTodos'),
            openTodos > 0 ? h('span', { className: 'dwl-tab-count' }, String(openTodos)) : null,
          ),
        ),
      )

      if (tab === 'summary') {
        body.push(
          h(
            'div',
            { className: 'dwl-toolbar', key: 'range' },
            h(Segmented, {
              ariaLabel: t('tabSummary'),
              value: mode,
              options: [
                { value: 'day', label: t('modeDay') },
                { value: 'week', label: t('modeWeek') },
                { value: 'custom', label: t('modeCustom') },
              ],
              onChange: setMode,
            }),
            mode === 'custom'
              ? [
                  h(
                    'label',
                    { className: 'dwl-field', key: 'start' },
                    t('startLabel'),
                    h('input', {
                      className: 'dwl-input is-date',
                      type: 'date',
                      value: startDate,
                      onChange: (event) => setStartDate(event.target.value),
                    }),
                  ),
                  h(
                    'label',
                    { className: 'dwl-field', key: 'end' },
                    t('endLabel'),
                    h('input', {
                      className: 'dwl-input is-date',
                      type: 'date',
                      value: endDate,
                      onChange: (event) => setEndDate(event.target.value),
                    }),
                  ),
                ]
              : h(
                  'label',
                  { className: 'dwl-field', key: 'anchor' },
                  t('dateLabel'),
                  h('input', {
                    className: 'dwl-input is-date',
                    type: 'date',
                    value: anchor,
                    onChange: (event) => setAnchor(event.target.value),
                  }),
                ),
          ),
        )

        if (summary.status === 'loading') {
          body.push(h('p', { className: 'dwl-note', key: 'loading', style: { marginTop: '22px' } }, t('loading')))
        } else if (summary.status === 'error') {
          body.push(
            h(
              'div',
              { className: 'dwl-notice', key: 'error' },
              h('p', { className: 'dwl-error' }, t('loadError') + ': ' + summary.error),
              h('button', { type: 'button', className: 'dwl-button', onClick: refresh }, t('retry')),
            ),
          )
        } else {
          body.push(
            h(
              'div',
              { className: 'dwl-layout', key: 'summary' },
              h(
                'p',
                { className: 'dwl-meta-line' },
                t('metaLine', {
                  sessions: formatNumber(sessions),
                  prompts: formatNumber(prompts),
                  turns: formatNumber(turns),
                  projects: formatNumber(projectCount),
                  todos: formatNumber(openTodos),
                }),
              ),
              projects.length > 0
                ? h(
                    'section',
                    { className: 'dwl-section', key: 'projects' },
                    h('h2', { className: 'dwl-h2' }, t('byProject')),
                    projects.map((project) =>
                      h(ProjectCard, { key: String(project.path) || String(project.name), project, t }),
                    ),
                  )
                : null,
              days.length > 0
                ? h(
                    'section',
                    { className: 'dwl-section', key: 'days' },
                    h('h2', { className: 'dwl-h2' }, t('byDay')),
                    days.map((day) => h(DayCard, { key: String(day.date), day, t })),
                  )
                : null,
              days.length === 0 && projects.length === 0
                ? h(
                    'div',
                    { className: 'dwl-notice', key: 'empty' },
                    h('p', { className: 'dwl-notice-title' }, t('emptyTitle')),
                    h('p', { className: 'dwl-note' }, t('emptyHint')),
                  )
                : null,
            ),
          )
          if (summary.error !== '') {
            body.push(h('p', { className: 'dwl-error', key: 'stale' }, t('loadError') + ': ' + summary.error))
          }
          body.push(
            h(
              'p',
              { className: 'dwl-foot', key: 'foot' },
              [
                t('updatedAt', { time: formatTime(generatedAt) }),
                t('scannedSessions', { count: String(scannedSessions) }),
              ]
                .filter((part) => part !== '')
                .join(' · '),
            ),
          )
        }
      } else {
        body.push(
          h(
            'div',
            { className: 'dwl-todo-panel', key: 'todos' },
            h(
              'form',
              { className: 'dwl-todo-form', onSubmit: submitTodo },
              h('input', {
                className: 'dwl-input is-grow',
                value: draftTitle,
                placeholder: t('addPlaceholder'),
                'aria-label': t('addPlaceholder'),
                onChange: (event) => setDraftTitle(event.target.value),
              }),
              h(
                'label',
                { className: 'dwl-todo-form-label' },
                t('projectLabel'),
                h(
                  'select',
                  {
                    className: 'dwl-input',
                    value: draftProject,
                    onChange: (event) => setDraftProject(event.target.value),
                  },
                  h('option', { value: '' }, '—'),
                  projectOptions.map((name) => h('option', { key: name, value: name }, name)),
                ),
              ),
              h(
                'label',
                { className: 'dwl-todo-form-label' },
                t('priorityLabel'),
                h(
                  'select',
                  {
                    className: 'dwl-input',
                    value: draftPriority,
                    onChange: (event) => setDraftPriority(event.target.value),
                  },
                  h('option', { value: 'high' }, t('priorityHigh')),
                  h('option', { value: 'normal' }, t('priorityNormal')),
                  h('option', { value: 'low' }, t('priorityLow')),
                ),
              ),
              h(
                'label',
                { className: 'dwl-todo-form-label' },
                t('dueLabel'),
                h('input', {
                  className: 'dwl-input is-date',
                  type: 'date',
                  value: draftDue,
                  onChange: (event) => setDraftDue(event.target.value),
                }),
              ),
              h(
                'button',
                { type: 'submit', className: 'dwl-button is-primary', disabled: busy || draftTitle.trim() === '' },
                busy ? t('adding') : t('add'),
              ),
              h(
                'p',
                { className: 'dwl-note', style: { width: '100%', margin: '2px 0 0' } },
                t('todoHint'),
              ),
            ),
            todoState.error !== ''
              ? h('p', { className: 'dwl-error', style: { marginTop: '12px' } }, t('todoError') + ': ' + todoState.error)
              : null,
            h(
              'div',
              { className: 'dwl-filters' },
              h(Segmented, {
                ariaLabel: t('tabTodos'),
                value: filterStatus,
                options: [
                  { value: 'all', label: t('filterAll') },
                  { value: 'open', label: t('filterOpen') },
                  { value: 'done', label: t('filterDone') },
                ],
                onChange: setFilterStatus,
              }),
              h(
                'label',
                { className: 'dwl-field' },
                t('projectLabel'),
                h(
                  'select',
                  {
                    className: 'dwl-input',
                    value: filterProject,
                    onChange: (event) => setFilterProject(event.target.value),
                  },
                  h('option', { value: 'all' }, t('projectAll')),
                  projectOptions.map((name) => h('option', { key: name, value: name }, name)),
                ),
              ),
              h('span', { className: 'dwl-tab-count' }, t('todoCount', { count: formatNumber(openTodos) })),
            ),
            groups.length === 0
              ? h(
                  'div',
                  { className: 'dwl-notice' },
                  h('p', { className: 'dwl-notice-title' }, todos.length === 0 ? t('emptyTodos') : t('emptyFiltered')),
                  todos.length === 0 ? h('p', { className: 'dwl-note' }, t('emptyTodosHint')) : null,
                )
              : groups.map((group) =>
                  h(
                    'div',
                    { className: 'dwl-group', key: group.project },
                    h(
                      'div',
                      { className: 'dwl-group-head' },
                      h('span', { className: 'dwl-group-name' }, group.project),
                      h(
                        'span',
                        null,
                        t('todoCount', { count: formatNumber(group.todos.filter((todo) => todo.status !== 'done').length) }),
                      ),
                    ),
                    h(
                      'div',
                      { className: 'dwl-todos' },
                      group.todos.map((todo) =>
                        h(TodoRow, {
                          key: todo.id,
                          todo,
                          t,
                          busy,
                          editingId,
                          editingTitle,
                          onEditingTitle: setEditingTitle,
                          onStartEdit: startEdit,
                          onSaveEdit: saveEdit,
                          onCancelEdit: () => {
                            setEditingId('')
                            setEditingTitle('')
                          },
                          onToggle: toggleTodo,
                          onRemove: removeTodo,
                        }),
                      ),
                    ),
                  ),
                ),
            h(
              'p',
              { className: 'dwl-foot' },
              [
                t('todoCount', { count: formatNumber(openTodos) }),
                todosUpdatedAt !== '' ? t('updatedAt', { time: formatTime(todosUpdatedAt) }) : '',
              ]
                .filter((part) => part !== '')
                .join(' · '),
            ),
          ),
        )
      }

      return h('div', { className: 'dwl-page' }, h('div', { className: 'dwl-inner' }, body))
    }

    return {
      /**
       * `locale` must be injected, not probed with `ctx.get()`. The locale plugin
       * provides its service from an async apply (it awaits the native language
       * read first), so on the very first apply pass `ctx.get('locale')` is
       * `undefined` — and because this plugin is an immediately-tier client row,
       * that first pass is the one it got. Reading the service without injecting
       * it therefore skipped `register()`, skipped `bind()`, and left the sidebar
       * label and every page string on the English fallbacks. Declaring the
       * dependency makes Cordis hold this apply until the service exists (and
       * re-run it if the service restarts), which is the only ordering that keeps
       * the dictionaries registered.
       */
      inject: ['slots', 'locale'],
      apply(ctx) {
        const locale = ctx.locale
        ctx.effect(() => locale.register(NS, DICTS), 'worklog: dictionary')

        // `bind()` is stable per namespace and reads the active locale at call
        // time, so one reference serves both the sidebar label and the page.
        const translate = locale.bind(NS)
        const fallbackT = (key, params) => translate(key, params)

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 17,
              locale: NS,
              label: () => translate('nav'),
            },
            WorklogIcon,
          ),
        )
        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, (slotProps) =>
            h(WorklogPage, { ...slotProps, fallbackT }),
          ),
        )
      },
    }
  },
})
