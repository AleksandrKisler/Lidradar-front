/** Команда организации: участники и одноразовые коды приглашений (ADR 0045). */
import type { Schema } from '@/shared/api'

export type Member = Schema<'Member'>
export type Membership = Schema<'Membership'>
export type Invitation = Schema<'Invitation'>
export type IssuedInvitation = Schema<'IssuedInvitation'>
export type InvitationStatus = Schema<'InvitationStatus'>
export type CreateInvitationRequest = Schema<'CreateInvitationRequest'>
export type UpdateMemberRoleRequest = Schema<'UpdateMemberRoleRequest'>
export type AcceptInvitationRequest = Schema<'AcceptInvitationRequest'>
export type AcceptedInvitation = Schema<'AcceptedInvitation'>

export type TeamRole = Member['role']
export type MemberStatus = Member['status']

export const TEAM_ROLES: readonly TeamRole[] = ['OWNER', 'MANAGER']

/** Код приглашения: 256 бит в base64url, ровно 43 символа, показывается один раз. */
export const INVITATION_CODE_LENGTH = 43
export const INVITATION_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/
export const INVITATION_NOTE_MAX = 500
