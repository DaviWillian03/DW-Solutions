// Conector do Microsoft Intune (Microsoft Graph) — pronto, testado sem rede e DESLIGADO (ADR-0010).
export {
  GraphClient,
  GraphError,
  GRAPH_BASE,
  DEVICE_ACTIONS,
  type DeviceAction,
  type GraphVersion,
  type Transport,
  type HttpRequest,
} from './client.js';
export { toGraphAction, actionProgress, type DeviceActionResult } from './commands.js';
export {
  fromManagedDevice,
  INTUNE_COMPLIANCE_LABEL,
  NOT_REPORTED_BY_INTUNE,
  type IntuneManagedDevice,
  type NormalizedIntuneDevice,
} from './device.js';
export {
  toIntuneConfiguration,
  assertSafeConfiguration,
  findAutomaticActions,
  UnsafeIntuneConfigError,
  NOT_SENT_TO_INTUNE,
  type IntuneConfiguration,
  type AutomaticActionFinding,
} from './policy.js';
export { IntuneProvider, IntuneDisabledError, type IntuneConfig } from './provider.js';
