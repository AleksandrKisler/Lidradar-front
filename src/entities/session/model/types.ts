/**
 * Типы сессии берутся из контракта OpenAPI: пользователь, его членства и
 * роль в выбранной организации. Ручных DTO нет.
 */
import type { Schema } from '@/shared/api'

export type User = Schema<'User'>
export type MembershipSummary = Schema<'MembershipSummary'>
export type AuthMeResponse = Schema<'AuthMeResponse'>
export type Role = MembershipSummary['role']

/**
 * Жизненный цикл сессии в приложении:
 * - `idle` — `/auth/me` ещё не запрашивался;
 * - `loading` — первый запрос выполняется, показывается нейтральный экран;
 * - `authenticated` — пользователь известен;
 * - `guest` — сессии нет (401 или выход);
 * - `error` — сеть или сервер недоступны; пользователь не считается вышедшим.
 */
export type SessionStatus = 'idle' | 'loading' | 'authenticated' | 'guest' | 'error'

/** Почему пользователь оказался гостем: подсказка для экрана входа. */
export type SignOutReason = 'expired' | 'manual'
