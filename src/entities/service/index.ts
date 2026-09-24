export type {
  ServiceCatalogItem,
  CreateServiceCatalogItemRequest,
  UpdateServiceCatalogItemRequest,
} from './model/types'
export { SERVICE_NAME_MAX_LENGTH } from './model/types'
export { formatPriceRange, priceRangeValid, UNKNOWN_PRICE } from './model/price'
export {
  serviceKeys,
  fetchServices,
  createService,
  updateService,
  deactivateService,
  useServicesQuery,
} from './api/service-api'
