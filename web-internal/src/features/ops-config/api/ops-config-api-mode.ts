import { OPS_CONFIG_API_BLOCKED_MESSAGE } from "../constants/ops-config.constants.ts";

export class OpsConfigApiBlockedError extends Error {
  readonly code = "API_CONTRACT_BLOCKED";

  constructor() {
    super(OPS_CONFIG_API_BLOCKED_MESSAGE);
    this.name = "OpsConfigApiBlockedError";
  }
}

export function requireOpsConfigMock(isMock: boolean): void {
  if (!isMock) {
    throw new OpsConfigApiBlockedError();
  }
}
