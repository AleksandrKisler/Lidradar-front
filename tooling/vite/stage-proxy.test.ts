// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, type ViteDevServer } from 'vite'
import { createStageProxy, STAGE_API_ORIGIN } from './stage-proxy'

const credentials = {
  DEV_STAGE_BASIC_AUTH_USER: 'stage-test',
  DEV_STAGE_BASIC_AUTH_PASSWORD: 'not-a-real-password',
}
let root: string
let vite: ViteDevServer
let origin: string
let received: IncomingMessage[] = []
let respond: (req: IncomingMessage, res: ServerResponse) => void
const upstream = createHttpServer((req, res) => {
  received.push(req)
  respond(req, res)
})

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'lidradar-stage-proxy-'))
  writeFileSync(join(root, '.env.stage'), 'VITE_APP_ENV=dev\nVITE_API_ORIGIN=\n')
  writeFileSync(
    join(root, '.env.stage.local'),
    Object.entries(credentials)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
  )
  writeFileSync(join(root, 'entry.js'), 'window.appEnv = import.meta.env\n')
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve))
  const target = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`
  vite = await createServer({
    configFile: false,
    root,
    mode: 'stage',
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: true,
      hmr: false,
      watch: null,
      proxy: { '/api': { ...createStageProxy(credentials), target } },
    },
  })
  await vite.listen()
  origin = `http://127.0.0.1:${(vite.httpServer!.address() as AddressInfo).port}`
})

beforeEach(() => {
  received = []
  respond = (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{"ok":true}')
  }
})

afterAll(async () => {
  await vite?.close()
  upstream.closeAllConnections()
  await new Promise<void>((resolve) => upstream.close(() => resolve()))
  if (root) rmSync(root, { recursive: true, force: true })
})

describe('конфигурация staging-прокси', () => {
  it('требует реквизиты и не включает их в ошибку', () => {
    expect(() => createStageProxy({})).toThrow('.env.stage.local')
    expect(() =>
      createStageProxy({ ...credentials, DEV_STAGE_BASIC_AUTH_USER: 'bad:user' }),
    ).toThrow('двоеточие')
    try {
      createStageProxy({ ...credentials, DEV_STAGE_BASIC_AUTH_USER: '' })
    } catch (error) {
      expect(String(error)).not.toContain(credentials.DEV_STAGE_BASIC_AUTH_PASSWORD)
    }
  })

  it('использует только HTTPS staging, проверяет TLS и не следует перенаправлениям', () => {
    const options = createStageProxy({
      ...credentials,
      DEV_API_TARGET: 'https://production.invalid',
    })
    expect(options.target).toBe(STAGE_API_ORIGIN)
    expect(options.secure).toBe(true)
    expect(options.followRedirects).toBe(false)
    expect(() => createStageProxy({ ...credentials, VITE_API_ORIGIN: STAGE_API_ORIGIN })).toThrow(
      'VITE_API_ORIGIN должен быть пустым',
    )
  })
})

describe('настоящие HTTP-запросы через Vite', () => {
  it('добавляет Basic Auth только на upstream и передаёт только сессию staging', async () => {
    const response = await fetch(`${origin}/api/v1/auth/me`, {
      headers: {
        Origin: origin,
        Authorization: 'Basic browser-value',
        Cookie: 'lidradar_session=local; lidradar_stage_session=remote; other=private',
      },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(received[0].headers.authorization).toBe(
      `Basic ${Buffer.from('stage-test:not-a-real-password').toString('base64')}`,
    )
    expect(received[0].headers.origin).toBe(STAGE_API_ORIGIN)
    expect(received[0].headers.cookie).toBe('lidradar_session=remote')
    expect(response.headers.get('Authorization')).toBeNull()
  })

  it('не переносит cookie локального backend на staging', async () => {
    const response = await fetch(`${origin}/api/v1/auth/me`, {
      headers: { Cookie: 'lidradar_session=local' },
    })
    await response.text()
    expect(received[0].headers.cookie).toBeUndefined()
  })

  it('передаёт тело команды после проверки локального Origin', async () => {
    let body = ''
    respond = (req, res) => {
      req.on('data', (part) => {
        body += part.toString()
      })
      req.on('end', () => {
        res.end('{}')
      })
    }
    const response = await fetch(`${origin}/api/v1/auth/login`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: '{"email":"fixture@example.test"}',
    })
    expect(response.status).toBe(200)
    await response.text()
    expect(body).toBe('{"email":"fixture@example.test"}')
  })

  it.each(['GET', 'POST'])('отклоняет чужой Origin до обращения к VPS (%s)', async (method) => {
    const response = await fetch(`${origin}/api/v1/auth/login`, {
      method,
      headers: { Origin: 'https://untrusted.example' },
    })
    expect(response.status).toBe(403)
    expect((await response.json()).error.code).toBe('ORIGIN_NOT_ALLOWED')
    expect(received).toHaveLength(0)
  })

  it('требует Origin для команды и отклоняет cross-site Fetch Metadata', async () => {
    for (const options of [{ method: 'POST' }, { headers: { 'Sec-Fetch-Site': 'cross-site' } }]) {
      const response = await fetch(`${origin}/api/v1/auth/login`, options)
      expect(response.status).toBe(403)
      await response.text()
    }
    expect(received).toHaveLength(0)
  })

  it('отделяет cookie staging, сохраняя HttpOnly, SameSite и удаление сеанса', async () => {
    respond = (_req, res) => {
      res.writeHead(200, {
        'Set-Cookie': [
          'lidradar_session=token; Path=/; Domain=stage.app-lid-radar.ru; HttpOnly; Secure; SameSite=Strict',
          'lidradar_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict',
        ],
      })
      res.end('{}')
    }
    const response = await fetch(`${origin}/api/v1/auth/login`)
    await response.text()
    expect(response.headers.getSetCookie()).toEqual([
      'lidradar_stage_session=token; Path=/; HttpOnly; SameSite=Strict',
      'lidradar_stage_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict',
    ])
  })

  it('объясняет отказ общего входа JSON-ошибкой без browser Basic Auth challenge', async () => {
    respond = (_req, res) => {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="staging"' })
      res.end('Unauthorized')
    }
    const response = await fetch(`${origin}/api/v1/auth/me`)
    expect(response.status).toBe(502)
    expect(response.headers.get('WWW-Authenticate')).toBeNull()
    expect((await response.json()).error.code).toBe('STAGE_PROXY_AUTH_FAILED')
  })

  it('сохраняет обычный API 401 для перехода на вход приложения', async () => {
    respond = (_req, res) => {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end('{"error":{"code":"UNAUTHENTICATED"}}')
    }
    const response = await fetch(`${origin}/api/v1/auth/me`)
    expect(response.status).toBe(401)
    expect((await response.json()).error.code).toBe('UNAUTHENTICATED')
  })

  it('передаёт SSE до закрытия upstream, без буферизации всего ответа', async () => {
    let finish: () => void = () => {}
    respond = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      res.write('event: ready\ndata: {}\n\n')
      finish = () => res.end('event: done\ndata: {}\n\n')
    }
    const response = await fetch(`${origin}/api/v1/events`)
    const reader = response.body!.getReader()
    const first = await reader.read()
    expect(new TextDecoder().decode(first.value)).toContain('event: ready')
    finish()
    while (!(await reader.read()).done) {
      /* drain */
    }
  })

  it('не раздаёт файл реквизитов и не включает серверные секреты в import.meta.env', async () => {
    const secretResponse = await fetch(`${origin}/.env.stage.local`)
    expect([403, 404]).toContain(secretResponse.status)
    expect(await secretResponse.text()).not.toContain(credentials.DEV_STAGE_BASIC_AUTH_PASSWORD)
    const source = await fetch(`${origin}/entry.js`).then((response) => response.text())
    expect(source).toContain('VITE_APP_ENV')
    expect(source).not.toContain('DEV_STAGE_BASIC_AUTH')
    expect(source).not.toContain(credentials.DEV_STAGE_BASIC_AUTH_PASSWORD)
  })
})
