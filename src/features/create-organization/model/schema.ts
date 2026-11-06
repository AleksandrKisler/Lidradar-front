/** Схема формы создания организации по ограничениям контракта. */
import type * as v from 'valibot'
import { organizationFormSchema } from '@/entities/organization'

export const createOrganizationSchema = organizationFormSchema('Введите название компании.')
export type CreateOrganizationValues = v.InferOutput<typeof createOrganizationSchema>
