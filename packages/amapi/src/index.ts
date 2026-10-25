// Conector da Android Management API — pronto, testado sem rede e DESLIGADO (CHECKPOINT 6, ADR-0009).
export {
  toAmapiPolicy,
  assertNoAutoEnforcement,
  AUTO_ENFORCED_KEYS,
  UnsafePolicyError,
  NOT_SENT_TO_DEVICE,
  API_LEVEL,
  type AmapiPolicy,
} from './policy.js';
export { toAmapiCommand, AMAPI_COMMAND, type AmapiCommandType } from './commands.js';
export { fromAmapiDevice, type AmapiDevice, type NormalizedDevice } from './device.js';
export { AmapiClient, AmapiError, AMAPI_BASE, type Transport, type HttpRequest } from './client.js';
export {
  AndroidManagementProvider,
  ProviderDisabledError,
  type AndroidManagementConfig,
} from './provider.js';
