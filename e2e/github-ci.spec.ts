import { readFileSync } from 'node:fs'
import { env } from 'node:process'
import { test, expect, type APIRequestContext } from '@playwright/test'

const CI_WORKFLOW_PATH = '.github/workflows/ci.yml'
const CI_JOB_NAMES = ['lint', 'unit-tests'] as const
const REQUIRED_CHECKS = ['lint', 'unit-tests'] as const
const REQUIRED_PR_EVENT_TYPES = ['opened', 'synchronize', 'reopened', 'ready_for_review'] as const
const ALLOWED_ACTIONS = ['actions/checkout@v4', 'actions/setup-node@v4'] as const

/** 按缩进读取 YAML 段；本用例不引入新的 YAML 依赖。 */
function readYamlSection(source: string, keyPattern: RegExp, indent: number): string {
  const lines = source.split(/\r?\n/)
  const startIndex = lines.findIndex((line) => !line.trimStart().startsWith('#') && keyPattern.test(line))
  if (startIndex < 0) return ''
  const body: string[] = []
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim().length === 0) {
      body.push(line)
      continue
    }
    const currentIndent = line.match(/^\s*/)?.[0].length ?? 0
    if (currentIndent <= indent) break
    body.push(line)
  }
  return body.join('\n')
}

function readWorkflow(): string {
  try {
    return readFileSync(new URL(`../${CI_WORKFLOW_PATH}`, import.meta.url), 'utf8')
  } catch {
    throw new Error(`缺少 CI workflow：${CI_WORKFLOW_PATH}`)
  }
}

function actionReferences(section: string): string[] {
  return [...section.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)\s*$/gm)].map((match) => match[1])
}

type WorkflowRun = {
  id: number
  name: string
  event: string
  path: string
  status: string
  conclusion: string | null
}

type WorkflowJob = {
  name: string
  status: string
  conclusion: string | null
}

type CollectedJobs = {
  event: string
  runId: number
  jobs: WorkflowJob[]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function apiHeaders(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function readJson<T>(request: APIRequestContext, path: string, token: string | undefined): Promise<T> {
  const response = await request.get(`https://api.github.com${path}`, { headers: apiHeaders(token) })
  if (!response.ok()) throw new Error(`GitHub API 请求失败（${response.status()}）：GET ${path}`)
  return await response.json() as T
}

async function waitForCiJobs(
  request: APIRequestContext,
  repository: string,
  headSha: string,
  expectedEvents: readonly string[],
  token: string | undefined,
): Promise<CollectedJobs[]> {
  const deadline = Date.now() + 5 * 60 * 1000
  const intervals = [15_000, 30_000]
  let intervalIndex = 0
  let lastRuns: WorkflowRun[] = []

  while (Date.now() < deadline) {
    const runsPayload = await readJson<{ workflow_runs: WorkflowRun[] }>(
      request,
      `/repos/${repository}/actions/runs?head_sha=${headSha}&per_page=100`,
      token,
    )
    lastRuns = runsPayload.workflow_runs.filter((run) => run.path.endsWith(`/${CI_WORKFLOW_PATH}`))
    const matchedRuns = lastRuns.filter((run) => expectedEvents.includes(run.event))
    const collected: CollectedJobs[] = []
    let allRunsFinished = matchedRuns.length > 0

    for (const run of matchedRuns) {
      const jobsPayload = await readJson<{ jobs: WorkflowJob[] }>(
        request,
        `/repos/${repository}/actions/runs/${run.id}/jobs?per_page=100`,
        token,
      )
      collected.push({ event: run.event, runId: run.id, jobs: jobsPayload.jobs })
      const running = jobsPayload.jobs.length === 0
        || jobsPayload.jobs.some((job) => ['queued', 'in_progress'].includes(job.status))
      if (running) allRunsFinished = false
    }

    if (allRunsFinished) return collected
    await sleep(intervals[Math.min(intervalIndex, intervals.length - 1)])
    intervalIndex += 1
  }

  throw new Error(
    `等待 CI job 超时（5 分钟）；head SHA=${headSha}，已发现 workflow runs=${lastRuns.length}，期望 events=${expectedEvents.join(', ')}`,
  )
}

test.describe('GitHub CI 流水线 - E2E 验收', () => {
  test('TC-001 / REQ-001.1: 任意分支 push 触发包含两项检查的 CI', () => {
    const pushSection = readYamlSection(readWorkflow(), /^on:\s*$/, 0).match(/^\s{2}push:\s*$/m)?.index
    expect(pushSection, 'workflow on 配置必须包含 push 事件').toBeDefined()
    const triggerSection = readYamlSection(readWorkflow(), /^\s{2}push:\s*$/, 2)
    expect(triggerSection, 'push 不得过滤分支，才能覆盖任意分支 push').not.toMatch(/^\s*(?:branches|branches-ignore):/m)
    expect(triggerSection, 'push 不得绑定手动输入替代自动触发').not.toMatch(/^\s*(?:tags|paths|paths-ignore):/m)
  })

  test('TC-002~TC-004 / REQ-001.2~001.3: main PR 生命周期事件触发 CI', () => {
    const triggerSection = readYamlSection(readWorkflow(), /^\s{2}pull_request:\s*$/, 2)
    expect(triggerSection, 'workflow on 配置必须包含 pull_request 事件').not.toBe('')
    const actualTypes = triggerSection.match(/^\s*types:\s*\[([^\]]+)\]/)?.[1]
      ?.split(',').map((value) => value.trim()).filter(Boolean) ?? []
    expect(actualTypes).toEqual([...REQUIRED_PR_EVENT_TYPES])
    expect(triggerSection.match(/^\s*branches:\s*\[([^\]]+)\]/)?.[1] ?? '')
      .toContain('main')
  })

  test('TC-005~TC-008 / REQ-002~REQ-003: lint 与 unit-tests 独立执行配置', () => {
    const workflow = readWorkflow()
    const jobsSection = readYamlSection(workflow, /^jobs:\s*$/, 0)
    expect(jobsSection, 'workflow jobs 配置缺失').not.toBe('')
    const lintJob = readYamlSection(jobsSection, /^\s{2}lint:\s*$/, 2)
    const unitTestsJob = readYamlSection(jobsSection, /^\s{2}unit-tests:\s*$/, 2)
    expect(lintJob, '缺少 lint job').not.toBe('')
    expect(unitTestsJob, '缺少 unit-tests job').not.toBe('')
    expect(lintJob).not.toMatch(/^\s*needs:/m)
    expect(unitTestsJob).not.toMatch(/^\s*needs:/m)

    for (const job of [lintJob, unitTestsJob]) {
      expect(job).toMatch(/^\s*runs-on:\s*ubuntu-latest\s*$/m)
      expect(job).toMatch(/^\s*timeout-minutes:\s*10\s*$/m)
      expect(job).toMatch(/^\s*uses:\s*actions\/checkout@v4\s*$/m)
      const setupNode = job.match(/^\s*uses:\s*actions\/setup-node@v4\s*$/m)
      expect(setupNode, 'job 必须使用 actions/setup-node 固定 Node 环境').not.toBeNull()
      const setupNodeStart = setupNode?.index ?? 0
      const setupNodeSection = job.slice(setupNodeStart, setupNodeStart + 500)
      expect(setupNodeSection).toMatch(/^\s*node-version:\s*20\s*$/m)
      expect(setupNodeSection).toMatch(/^\s*cache:\s*npm\s*$/m)
      expect(job).toMatch(/^\s*(?:-\s+)?run:\s*npm ci\s*$/m)
    }

    expect(lintJob).toMatch(/^\s*(?:-\s+)?run:\s*npm run lint\s*$/m)
    expect(unitTestsJob).toMatch(/^\s*(?:-\s+)?run:\s*npm test\s*$/m)
  })

  test('TC-009~TC-011 / REQ-004.5: 两项检查互不依赖，任一失败时另一项不被跳过', () => {
    const workflow = readWorkflow()
    const jobsSection = readYamlSection(workflow, /^jobs:\s*$/, 0)
    const lintJob = readYamlSection(jobsSection, /^\s{2}lint:\s*$/, 2)
    const unitTestsJob = readYamlSection(jobsSection, /^\s{2}unit-tests:\s*$/, 2)
    expect(lintJob).not.toBe('')
    expect(unitTestsJob).not.toBe('')
    expect(lintJob).not.toMatch(/^\s*needs:/m)
    expect(unitTestsJob).not.toMatch(/^\s*needs:/m)
    expect(lintJob).not.toMatch(/^\s*if:.*failure\(\)/m)
    expect(unitTestsJob).not.toMatch(/^\s*if:.*failure\(\)/m)
    expect(workflow).not.toMatch(/^\s*continue-on-error:\s*true\s*$/m)
  })

  test('TC-012 / REQ-005.1 与 REQ-005.4: 无自动重试且不接入外部通知', () => {
    const workflow = readWorkflow()
    const jobsSection = readYamlSection(workflow, /^jobs:\s*$/, 0)
    const lintJob = readYamlSection(jobsSection, /^\s{2}lint:\s*$/, 2)
    const unitTestsJob = readYamlSection(jobsSection, /^\s{2}unit-tests:\s*$/, 2)
    for (const job of [lintJob, unitTestsJob]) {
      expect(job).not.toBe('')
      expect(job).not.toMatch(/^\s*continue-on-error:\s*true\s*$/m)
    }
    expect(workflow.toLowerCase()).not.toContain('nick-fields/retry')
    expect(workflow.toLowerCase()).not.toContain('retry')
    expect(new Set(actionReferences(workflow))).toEqual(new Set(ALLOWED_ACTIONS))
    expect(workflow).not.toMatch(/secrets\./)
    expect(workflow).not.toMatch(/^\s*(?:-\s+)?name:\s*(?:notify|notification|webhook|slack|lark|feishu)/im)
  })

  test('NFR-001~NFR-006 / NFR-008~NFR-009: 运行环境、权限与触发契约', () => {
    const workflow = readWorkflow()
    expect(workflow).toMatch(/^permissions:\s*$/m)
    expect(workflow).toMatch(/^\s{2}contents:\s*read\s*$/m)
    expect(workflow).not.toMatch(/^\s*(?:pull-requests|issues|checks|statuses|deployments|packages|id-token|pages):\s*/m)
    expect(readYamlSection(workflow, /^\s{2}pull_request:\s*$/, 2)).not.toBe('')
    expect(readYamlSection(workflow, /^\s{2}push:\s*$/, 2)).not.toBe('')
    expect(workflow).not.toMatch(/^\s*cancel-in-progress:\s*true\s*$/m)
  })

  test('TC-001~TC-003 / REQ-001: 当前提交实际产生包含两个 job 的 CI run', async ({ request }) => {
    const repository = env.E2E_GITHUB_REPOSITORY || env.GITHUB_REPOSITORY
    const token = env.E2E_GITHUB_TOKEN || env.GITHUB_TOKEN
    const configuredEvents = env.E2E_GITHUB_EXPECTED_EVENTS
      ?.split(',').map((value) => value.trim()).filter(Boolean)
    const runtimeEvent = env.GITHUB_EVENT_NAME
    const expectedEvents = configuredEvents ?? (runtimeEvent ? [runtimeEvent] : [])
    let headSha = env.E2E_GITHUB_HEAD_SHA || env.GITHUB_SHA

    if (!repository || !headSha || expectedEvents.length === 0) {
      test.skip(true, '缺少 GitHub 仓库、head SHA 或期望事件上下文；静态 workflow 契约已由前置用例覆盖')
    }

    const pullRequestRef = env.GITHUB_REF?.match(/^refs\/pull\/(\d+)\/merge$/)
    if (pullRequestRef) {
      const pullRequest = await readJson<{ head: { sha: string } }>(
        request,
        `/repos/${repository}/pulls/${pullRequestRef[1]}`,
        token,
      )
      headSha = pullRequest.head.sha
    }

    const collectedJobs = await waitForCiJobs(request, repository!, headSha!, expectedEvents, token)
    expect(collectedJobs.map((item) => item.event).sort()).toEqual([...expectedEvents].sort())
    for (const item of collectedJobs) {
      expect(item.jobs.map((job) => job.name)).toEqual(expect.arrayContaining([...CI_JOB_NAMES]))
      for (const job of item.jobs.filter((candidate) => CI_JOB_NAMES.includes(candidate.name as typeof CI_JOB_NAMES[number]))) {
        expect(job.status, `job ${job.name} 必须到达终态`).toBe('completed')
        expect(job.conclusion, `job ${job.name} 不得被跳过`).not.toBe('skipped')
      }
    }
  })

  test('TC-009~TC-010 / REQ-004.1~REQ-004.4: main 必检项包含 lint 与 unit-tests', async ({ request }) => {
    const repository = env.E2E_GITHUB_REPOSITORY || env.GITHUB_REPOSITORY
    const token = env.E2E_GITHUB_TOKEN || env.GITHUB_TOKEN
    const baseRef = env.E2E_GITHUB_BASE_REF || 'main'

    if (!repository || !token) {
      test.skip(true, '读取 branch protection 需要具备权限的 GitHub Token；缺少时无法端到端确认必检门禁')
    }

    const response = await request.get(
      `https://api.github.com/repos/${repository}/branches/${baseRef}/protection`,
      { headers: apiHeaders(token) },
    )
    if ([403, 404].includes(response.status())) {
      test.skip(true, `GitHub Token 无权读取 ${baseRef} branch protection（HTTP ${response.status()}）；请使用维护者权限 Token`)
    }
    expect(response.ok()).toBeTruthy()
    const protection = await response.json() as {
      required_status_checks?: { contexts?: string[] }
    }
    expect(protection.required_status_checks?.contexts ?? [])
      .toEqual(expect.arrayContaining([...REQUIRED_CHECKS]))
  })
})
