import Joi from 'joi';
import { joiSchemaToOpenApiSchema } from './joi-body.decorator';

describe('joiSchemaToOpenApiSchema', () => {
  it('converts object fields, required properties, enums, patterns, and arrays', () => {
    const schema = joiSchemaToOpenApiSchema(
      Joi.object({
        status: Joi.string().valid('ACTIVE', 'INACTIVE').required(),
        code: Joi.string().pattern(/^[A-Z]+$/).required(),
        tags: Joi.array().items(Joi.string()).min(1).optional(),
      }).required(),
    );

    expect(schema).toMatchObject({
      type: 'object',
      additionalProperties: true,
      required: ['status', 'code'],
      properties: {
        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
        code: { type: 'string', pattern: '^[A-Z]+$', minLength: 1 },
        tags: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
      },
    });
  });

  it('preserves nullable values and defaults', () => {
    const schema = joiSchemaToOpenApiSchema(
      Joi.object({
        note: Joi.string().allow(null, '').optional(),
        page: Joi.number().integer().min(1).default(1),
      }).required(),
    );

    expect(schema).toMatchObject({
      properties: {
        note: { type: 'string', nullable: true, minLength: 0 },
        page: { type: 'integer', minimum: 1, default: 1 },
      },
    });
  });

  it('represents conditional required fields as discriminated branches', () => {
    const schema = joiSchemaToOpenApiSchema(
      Joi.object({
        status: Joi.string().valid('ACCEPTED', 'REJECTED').required(),
        note: Joi.string().min(1).max(1000).when('status', {
          is: 'REJECTED',
          then: Joi.required(),
          otherwise: Joi.optional().allow(''),
        }),
      }).required(),
    );

    expect(schema).toMatchObject({
      oneOf: [
        {
          properties: {
            status: { enum: ['REJECTED'] },
            note: { minLength: 1 },
          },
          required: ['status', 'note'],
        },
        {
          properties: {
            status: { enum: ['ACCEPTED'] },
            note: { minLength: 0 },
          },
          required: ['status'],
        },
      ],
    });
  });

  it('preserves invalid-value exclusions and ISO date formats', () => {
    const schema = joiSchemaToOpenApiSchema(
      Joi.object({
        quantity: Joi.string().pattern(/^-?\d+$/).invalid('0', '-0').required(),
        date: Joi.string().isoDate().required(),
      }).required(),
    );

    expect(schema).toMatchObject({
      properties: {
        quantity: {
          type: 'string',
          not: { enum: ['0', '-0'] },
        },
        date: {
          anyOf: [
            { type: 'string', format: 'date' },
            { type: 'string', format: 'date-time' },
          ],
        },
      },
    });
  });
});
