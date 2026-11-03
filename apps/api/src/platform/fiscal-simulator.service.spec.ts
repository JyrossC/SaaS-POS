import { ServiceUnavailableException } from '@nestjs/common';
import { FiscalSimulatorService } from './fiscal-simulator.service';

describe('FiscalSimulatorService', () => {
  const previousEnvironment = process.env.NODE_ENV;
  const previousFlag = process.env.FISCAL_SIMULATOR_ENABLED;
  const service = new FiscalSimulatorService();

  afterEach(() => {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    if (previousFlag === undefined) delete process.env.FISCAL_SIMULATOR_ENABLED;
    else process.env.FISCAL_SIMULATOR_ENABLED = previousFlag;
  });

  it('returns an unmistakable simulated result without real processing', () => {
    process.env.NODE_ENV = 'test';
    process.env.FISCAL_SIMULATOR_ENABLED = 'true';

    expect(service.simulate({
      jurisdiction: 'MAINLAND_TANZANIA',
      scenario: 'ACCEPTED',
    })).toMatchObject({
      simulationOnly: true,
      officialReceiptIssued: false,
      salesRecordCreated: false,
      taxCalculated: false,
      providerContacted: false,
      jurisdiction: 'MAINLAND_TANZANIA',
      scenario: 'ACCEPTED',
      outcome: 'SIMULATED_ACCEPTED',
    });
  });

  it.each([
    ['development', 'false'],
    ['production', 'true'],
    ['test', 'false'],
  ])('fails closed when NODE_ENV=%s and the simulator flag=%s', (nodeEnvironment, enabled) => {
    process.env.NODE_ENV = nodeEnvironment;
    process.env.FISCAL_SIMULATOR_ENABLED = enabled;

    expect(() => service.simulate({
      jurisdiction: 'ZANZIBAR',
      scenario: 'TIMEOUT',
    })).toThrow(ServiceUnavailableException);
  });

  it('enables add-on test billing only with its explicit non-production flag', () => {
    process.env.NODE_ENV = 'development';
    process.env.FISCAL_ADDON_TEST_BILLING_ENABLED = 'false';
    expect(service.isTestBillingEnabled()).toBe(false);

    process.env.FISCAL_ADDON_TEST_BILLING_ENABLED = 'true';
    expect(service.isTestBillingEnabled()).toBe(true);

    process.env.NODE_ENV = 'production';
    expect(service.isTestBillingEnabled()).toBe(false);
  });
});
