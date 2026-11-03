import { randomUUID } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  FiscalSimulationRequest,
  FiscalSimulationResult,
} from './platform.types';

const SIMULATED_OUTCOMES: Record<FiscalSimulationRequest['scenario'], {
  outcome: FiscalSimulationResult['outcome'];
  message: string;
}> = {
  ACCEPTED: {
    outcome: 'SIMULATED_ACCEPTED',
    message: 'Simulated provider acceptance only. No official fiscal acknowledgement was received.',
  },
  REJECTED: {
    outcome: 'SIMULATED_REJECTED',
    message: 'Simulated provider rejection. No provider was contacted and no sale was created.',
  },
  TIMEOUT: {
    outcome: 'SIMULATED_TIMEOUT',
    message: 'Simulated provider timeout. This did not wait for or contact a provider.',
  },
  DUPLICATE: {
    outcome: 'SIMULATED_DUPLICATE',
    message: 'Simulated duplicate response. No duplicate-sale or provider-idempotency behavior was exercised.',
  },
  RECOVERED: {
    outcome: 'SIMULATED_RECOVERED',
    message: 'Simulated recovery outcome only. No queued transaction was replayed.',
  },
};

@Injectable()
export class FiscalSimulatorService {
  isEnabled(): boolean {
    return (
      process.env.FISCAL_SIMULATOR_ENABLED === 'true' &&
      (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')
    );
  }

  isTestBillingEnabled(): boolean {
    return (
      process.env.FISCAL_ADDON_TEST_BILLING_ENABLED === 'true' &&
      (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')
    );
  }

  simulate(input: FiscalSimulationRequest): FiscalSimulationResult {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException(
        'The fiscal simulator is unavailable. It is restricted to explicitly enabled development and test environments.',
      );
    }

    return {
      simulationOnly: true,
      officialReceiptIssued: false,
      salesRecordCreated: false,
      taxCalculated: false,
      providerContacted: false,
      jurisdiction: input.jurisdiction,
      scenario: input.scenario,
      ...SIMULATED_OUTCOMES[input.scenario],
      simulationId: randomUUID(),
      simulatedAt: new Date().toISOString(),
    };
  }
}
