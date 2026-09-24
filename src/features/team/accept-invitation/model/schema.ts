/** Код приглашения: 43 символа base64url; пробелы при вставке отбрасываются. */
import * as v from 'valibot'
import { INVITATION_CODE_PATTERN, normalizeInvitationCode } from '@/entities/team'

export const acceptInvitationSchema = v.object({
  code: v.pipe(
    v.string(),
    v.transform(normalizeInvitationCode),
    v.nonEmpty('Введите код приглашения'),
    v.regex(INVITATION_CODE_PATTERN, 'Код состоит из 43 символов: латиница, цифры, «-» и «_»'),
  ),
})

export type AcceptInvitationValues = v.InferOutput<typeof acceptInvitationSchema>
