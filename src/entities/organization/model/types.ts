import type { Schema } from '@/shared/api'

export type Organization = Schema<'Organization'>
export type CreateOrganizationRequest = Schema<'CreateOrganizationRequest'>
export type UpdateOrganizationRequest = Schema<'UpdateOrganizationRequest'>
export type OnboardingStatus = Schema<'OnboardingStatus'>
export type OnboardingStep = Schema<'OnboardingStep'>
export type OnboardingStepKey = OnboardingStep['key']
