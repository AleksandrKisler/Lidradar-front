import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ProxyOptions } from 'vite'

export const STAGE_API_ORIGIN = 'https://stage.app-lid-radar.ru'
const SESSION_COOKIE = 'lidradar_session'
const LOCAL_SESSION_COOKIE = 'lidradar_stage_session'

function errorResponse(res: ServerResponse, status: number, code: string, message: string) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify({ error: { code, message } }))
}

// Проверяем локальный origin ДО подстановки origin staging: иначе прокси обходил бы CSRF-защиту.
function isLocalRequest(req: IncomingMessage) {
  let local: URL
  try {
    local = new URL(`http://${req.headers.host}`)
  } catch {
    return false
  }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(local.hostname)) return false
  const site = req.headers['sec-fetch-site']
  if (site && site !== 'same-origin' && site !== 'none') return false
  if (req.headers.origin) return req.headers.origin === local.origin
  return ['GET', 'HEAD', 'OPTIONS'].includes(req.method ?? 'GET')
}

function localSessionCookie(cookie: string) {
  if (!cookie.startsWith(`${SESSION_COOKIE}=`)) return cookie
  // Только ответ loopback dev-сервера: на VPS cookie остаётся Secure, HttpOnly, SameSite=Strict.
  return cookie
    .replace(`${SESSION_COOKIE}=`, `${LOCAL_SESSION_COOKIE}=`)
    .replace(/;\s*Secure\b/gi, '')
    .replace(/;\s*Domain=[^;]*/gi, '')
}

export function createStageProxy(env: Record<string, string>): ProxyOptions {
  const user = env.DEV_STAGE_BASIC_AUTH_USER
  const password = env.DEV_STAGE_BASIC_AUTH_PASSWORD
  if (!user || !password || user.includes(':')) {
    throw new Error(
      'Заполните DEV_STAGE_BASIC_AUTH_USER и DEV_STAGE_BASIC_AUTH_PASSWORD в .env.stage.local. ' +
        'Шаблон: .env.stage.example; логин Basic Auth не должен содержать двоеточие.',
    )
  }
  if (env.VITE_API_ORIGIN) {
    throw new Error('Для dev:stage VITE_API_ORIGIN должен быть пустым: API доступен через /api.')
  }
  const authorization = `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`

  return {
    target: STAGE_API_ORIGIN,
    changeOrigin: true,
    secure: true,
    followRedirects: false,
    ws: false,
    bypass(req, res) {
      if (!res || isLocalRequest(req)) return
      errorResponse(
        res,
        403,
        'ORIGIN_NOT_ALLOWED',
        'Staging-прокси доступен только локальному frontend.',
      )
      // Vite завершает bypass без отправки запроса, если ответ уже закрыт.
      return req.url ?? '/api'
    },
    configure(proxy) {
      proxy.on('proxyReq', (outgoing, req) => {
        outgoing.setHeader('Authorization', authorization)
        outgoing.setHeader('Origin', STAGE_API_ORIGIN)
        // Не отправляем сессию локального backend на staging и наоборот.
        outgoing.removeHeader('Cookie')
        const cookie = req.headers.cookie
          ?.split(';')
          .map((part) => part.trim())
          .find((part) => part.startsWith(`${LOCAL_SESSION_COOKIE}=`))
        if (cookie) {
          outgoing.setHeader(
            'Cookie',
            `${SESSION_COOKIE}=${cookie.slice(LOCAL_SESSION_COOKIE.length + 1)}`,
          )
        }
      })
      proxy.on('proxyRes', (incoming, _req, res) => {
        if (incoming.statusCode === 401 && incoming.headers['www-authenticate']) {
          // Пароль стенда вводится в локальном файле, не в диалоге браузера.
          incoming.resume()
          errorResponse(
            res,
            502,
            'STAGE_PROXY_AUTH_FAILED',
            'Общий вход staging отклонён. Проверьте .env.stage.local и перезапустите npm run dev:stage.',
          )
          return
        }
        const cookies = incoming.headers['set-cookie']
        if (cookies) incoming.headers['set-cookie'] = cookies.map(localSessionCookie)
      })
    },
  }
}
