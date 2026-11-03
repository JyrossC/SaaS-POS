import { BadRequestException } from '@nestjs/common';
import { createProductSchema, registerTenantSchema } from './schemas';
import { JoiValidationPipe } from './joi-validation.pipe';

describe('JoiValidationPipe', () => {
  const pipe = new JoiValidationPipe(createProductSchema);
  const bodyMetadata = {
    type: 'body',
    metatype: Object,
    data: undefined,
  } as const;

  it('accepts decimal strings and normalizes permitted whitespace', () => {
    const result = pipe.transform(
      {
        sku: ' SKU-1 ',
        name: ' Tea ',
        baseUnit: ' each ',
        sellingPrice: '10.2500',
      },
      bodyMetadata,
    );

    expect(result).toEqual({
      sku: 'SKU-1',
      name: 'Tea',
      baseUnit: 'each',
      sellingPrice: '10.2500',
    });
  });

  it('rejects unknown fields and numeric money values', () => {
    expect(() =>
      pipe.transform(
        {
          sku: 'SKU-1',
          name: 'Tea',
          baseUnit: 'each',
          sellingPrice: 10.25,
          tenantId: 'untrusted-tenant',
        },
        bodyMetadata,
      ),
    ).toThrow(BadRequestException);
  });

  it('accepts and normalizes the documented tenant registration fields', () => {
    const registrationPipe = new JoiValidationPipe(registerTenantSchema);
    const result = registrationPipe.transform(
      {
        tenantName: ' Fezra Stores ',
        tenantSlug: 'Fezra-Stores',
        businessType: 'RETAIL',
        ownerName: ' Fezra Steven ',
        ownerEmail: ' FEZRA@example.com ',
        password: 'FezraPassword123!',
        planCode: 'STARTER',
      },
      bodyMetadata,
    );

    expect(result).toEqual({
      tenantName: 'Fezra Stores',
      tenantSlug: 'fezra-stores',
      businessType: 'RETAIL',
      ownerName: 'Fezra Steven',
      ownerEmail: 'fezra@example.com',
      password: 'FezraPassword123!',
      planCode: 'STARTER',
    });
  });

  it('returns field-specific errors for short registration passwords', () => {
    const registrationPipe = new JoiValidationPipe(registerTenantSchema);
    let exception: BadRequestException | undefined;

    try {
      registrationPipe.transform(
        {
          tenantName: 'Fezra Stores',
          tenantSlug: 'fezra-stores',
          businessType: 'RETAIL',
          ownerName: 'Fezra Steven',
          ownerEmail: 'fezra@example.com',
          password: 'fezra@12345',
          planCode: 'STARTER',
        },
        bodyMetadata,
      );
    } catch (error) {
      if (error instanceof BadRequestException) exception = error;
      else throw error;
    }

    expect(exception?.getResponse()).toEqual(expect.objectContaining({
      code: 'VALIDATION_ERROR',
      message: 'Request data is invalid.',
      details: expect.arrayContaining([
        expect.objectContaining({ field: 'password' }),
      ]),
    }));
  });
});
