import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  CLIENT_ERROR_CODES,
  createApiClient,
  filenameFromDisposition,
  unwrapFile,
} from '@/shared/api'
import { safeFilename, saveBlob } from '@/shared/lib'

/** Загрузка файлов выгрузки (ADR 0059): имя из заголовка, безопасное имя на диске, сохранение через ссылку. */

describe('filenameFromDisposition', () => {
  it('читает имя в кавычках и без них', () => {
    expect(filenameFromDisposition('attachment; filename="lidradar-account-20261014.json"')).toBe(
      'lidradar-account-20261014.json',
    )
    expect(filenameFromDisposition('attachment; filename=export.zip')).toBe('export.zip')
    expect(filenameFromDisposition('ATTACHMENT; FILENAME="a.zip"; size=10')).toBe('a.zip')
  })

  it('не принимает пути, скрытые файлы и пустые значения', () => {
    for (const header of [
      null,
      '',
      'inline',
      'attachment; filename=""',
      'attachment; filename="../etc/passwd"',
      'attachment; filename="..\\evil.exe"',
      'attachment; filename="dir/file.zip"',
      'attachment; filename=".hidden"',
    ]) {
      expect(filenameFromDisposition(header), String(header)).toBeNull()
    }
  })
})

describe('safeFilename', () => {
  it('сохраняет буквы, цифры и точки, остальное заменяет подчёркиванием', () => {
    expect(safeFilename('lidradar-org_2026.10.14.zip', 'x')).toBe('lidradar-org_2026.10.14.zip')
    expect(safeFilename('Выгрузка салона.zip', 'x')).toBe('Выгрузка_салона.zip')
    expect(safeFilename('a b<c>d?.json', 'x')).toBe('a_b_c_d_.json')
  })

  it('не отдаёт скрытое имя, пустое и слишком длинное', () => {
    expect(safeFilename('.bashrc', 'fallback.zip')).toBe('bashrc')
    expect(safeFilename('...', 'fallback.zip')).toBe('fallback.zip')
    expect(safeFilename(null, 'fallback.zip')).toBe('fallback.zip')
    expect(safeFilename('', 'fallback.zip')).toBe('fallback.zip')
    expect(safeFilename('я'.repeat(500), 'x')).toHaveLength(120)
  })
})

describe('saveBlob', () => {
  const createObjectURL = vi.fn<(blob: Blob) => string>()
  const revokeObjectURL = vi.fn<(url: string) => void>()
  let clicked: HTMLAnchorElement[]

  beforeEach(() => {
    vi.useFakeTimers()
    clicked = []
    createObjectURL.mockReset().mockReturnValue('blob:lidradar-test')
    revokeObjectURL.mockReset()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this)
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('отдаёт браузеру скрытую ссылку на файл, нажимает её и убирает', () => {
    const blob = new Blob(['{}'], { type: 'application/json' })
    saveBlob(blob, 'lidradar-account.json')
    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(clicked).toHaveLength(1)
    const link = clicked[0]!
    expect(link.download).toBe('lidradar-account.json')
    expect(link.href).toBe('blob:lidradar-test')
    expect(link.rel).toBe('noopener')
    expect(link.style.display).toBe('none')
    expect(document.body.contains(link)).toBe(false)
  })

  it('освобождает адрес объекта после запуска загрузки', () => {
    saveBlob(new Blob(['x']), 'a.zip')
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:lidradar-test')
  })
})

describe('unwrapFile', () => {
  function client(response: () => Promise<Response>) {
    const fetchMock = vi.fn<(request: Request) => Promise<Response>>(response)
    return {
      fetchMock,
      client: createApiClient({
        baseUrl: 'http://api.test',
        fetch: fetchMock,
        context: () => ({ tenantId: () => 'tenant-a' }),
      }),
    }
  }

  it('возвращает тело вложения и имя файла из заголовка', async () => {
    const { client: api, fetchMock } = client(async () =>
      Response.json(
        {},
        {
          status: 200,
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename="lidradar-organization-20261014.zip"',
          },
        },
      ),
    )
    const file = await unwrapFile(
      api.POST('/api/v1/organization/export', {
        params: { header: { 'X-Tenant-ID': 'tenant-a' } },
        parseAs: 'blob',
      }),
    )
    expect(file.filename).toBe('lidradar-organization-20261014.zip')
    expect(file.blob).toBeInstanceOf(Blob)
    const request = fetchMock.mock.calls[0]![0]
    expect(request.method).toBe('POST')
    expect(request.url).toBe('http://api.test/api/v1/organization/export')
    expect(request.headers.get('X-Tenant-ID')).toBe('tenant-a')
  })

  it('ответ без заголовка имени отдаёт файл с filename null', async () => {
    const { client: api } = client(async () => new Response('PK', { status: 200 }))
    const file = await unwrapFile(
      api.POST('/api/v1/organization/export', {
        params: { header: { 'X-Tenant-ID': 'tenant-a' } },
        parseAs: 'blob',
      }),
    )
    expect(file.filename).toBeNull()
  })

  it('ошибка сервера остаётся ApiError с кодом, статусом и сроком повтора', async () => {
    const { client: api } = client(async () =>
      Response.json(
        { error: { code: 'RATE_LIMITED', message: 'x', traceId: 't-1' } },
        { status: 429, headers: { 'Retry-After': '120' } },
      ),
    )
    const failure = await unwrapFile(
      api.POST('/api/v1/organization/export', {
        params: { header: { 'X-Tenant-ID': 'tenant-a' } },
        parseAs: 'blob',
      }),
    ).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(ApiError)
    expect(failure).toMatchObject({
      httpStatus: 429,
      code: 'RATE_LIMITED',
      retryAfterSeconds: 120,
      traceId: 't-1',
    })
  })

  it('сетевой сбой становится ApiError без ответа', async () => {
    const { client: api } = client(async () => {
      throw new TypeError('Failed to fetch')
    })
    const failure = await unwrapFile(
      api.POST('/api/v1/organization/export', {
        params: { header: { 'X-Tenant-ID': 'tenant-a' } },
        parseAs: 'blob',
      }),
    ).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(ApiError)
    expect(failure).toMatchObject({ httpStatus: 0, code: CLIENT_ERROR_CODES.network })
  })

  it('тело, не похожее на конверт ошибки, не показывается пользователю', async () => {
    const { client: api } = client(async () => new Response('<html>boom</html>', { status: 502 }))
    const failure = (await unwrapFile(
      api.POST('/api/v1/organization/export', {
        params: { header: { 'X-Tenant-ID': 'tenant-a' } },
        parseAs: 'blob',
      }),
    ).catch((error: unknown) => error)) as ApiError
    expect(failure.code).toBe(CLIENT_ERROR_CODES.malformed)
    expect(failure.message).not.toContain('boom')
  })
})
