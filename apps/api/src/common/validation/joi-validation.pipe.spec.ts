import { BadRequestException } from '@nestjs/common';
import { createProductSchema } from './schemas';
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
});
