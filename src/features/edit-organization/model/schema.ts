/** Схема формы организации: те же ограничения, что и при создании. */
import { organizationFormSchema } from '@/entities/organization'

export const organizationSchema = organizationFormSchema('Введите название компании')
