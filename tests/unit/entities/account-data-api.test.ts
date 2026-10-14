import { describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api'
import { deletionBlockers } from '@/entities/session'

/** Разбор причин блокировки закрытия из ошибки API (ADR 0059): поле приходит с сервера, форма не доверяется. */

const blocked = (details: Record<string, unknown>) =>
  new ApiError({ httpStatus: 409, code: 'ACCOUNT_DELETION_BLOCKED', details })

describe('deletionBlockers', () => {
  it('достаёт причины из 409 ACCOUNT_DELETION_BLOCKED', () => {
    expect(
      deletionBlockers(
        blocked({
          blockers: [
            { code: 'SOLE_OWNER', organizationName: 'Салон', hasOtherMembers: true },
            { code: 'PLATFORM_ADMIN' },
          ],
        }),
      ),
    ).toEqual([
      { code: 'SOLE_OWNER', organizationName: 'Салон', hasOtherMembers: true },
      { code: 'PLATFORM_ADMIN' },
    ])
  })

  it('для любой другой ошибки список пуст', () => {
    expect(deletionBlockers(null)).toEqual([])
    expect(deletionBlockers(new Error('x'))).toEqual([])
    expect(deletionBlockers(new ApiError({ httpStatus: 409, code: 'CONFLICT' }))).toEqual([])
    expect(
      deletionBlockers(new ApiError({ httpStatus: 403, code: 'INVALID_CURRENT_PASSWORD' })),
    ).toEqual([])
  })

  it('неожиданная форма не ломает разбор: неизвестные коды и типы отбрасываются', () => {
    expect(deletionBlockers(blocked({}))).toEqual([])
    expect(deletionBlockers(blocked({ blockers: 'нет' }))).toEqual([])
    expect(
      deletionBlockers(
        blocked({
          blockers: [
            null,
            'SOLE_OWNER',
            42,
            { code: 'SOMETHING_NEW' },
            { code: 'SOLE_OWNER', organizationName: 7, hasOtherMembers: 'да' },
          ],
        }),
      ),
    ).toEqual([{ code: 'SOLE_OWNER' }])
  })
})
