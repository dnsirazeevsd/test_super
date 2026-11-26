type DeviceNavigator = Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
export function simpleMotion() {
  const n = navigator as DeviceNavigator;
  return matchMedia('(prefers-reduced-motion: reduce)').matches || !!n.connection?.saveData || (!!n.deviceMemory && n.deviceMemory <= 4) || (!!n.hardwareConcurrency && n.hardwareConcurrency <= 4);
}
