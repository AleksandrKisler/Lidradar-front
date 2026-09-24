/** Форма приглашения: роль и заметка владельца (принимающему не показывается). */
import * as v from 'valibot'
import { INVITATION_NOTE_MAX } from '@/entities/team'

export const inviteMemberSchema = v.object({
  role: v.picklist(['OWNER', 'MANAGER'], 'Выберите роль'),
  note: v.pipe(
    v.string(),
    v.trim(),
    v.maxLength(INVITATION_NOTE_MAX, `Заметка не длиннее ${INVITATION_NOTE_MAX} символов`),
  ),
})

export type InviteMemberValues = v.InferOutput<typeof inviteMemberSchema>
