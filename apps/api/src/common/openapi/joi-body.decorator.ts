import { ApiBody, SchemaObject } from '@nestjs/swagger';
import Joi from 'joi';

interface JoiDescription {
  type?: string;
  flags?: {
    default?: unknown;
    only?: boolean;
    presence?: string;
    unknown?: boolean;
  };
  allow?: unknown[];
  invalid?: unknown[];
  keys?: Record<string, JoiDescription>;
  items?: JoiDescription[];
  matches?: Array<{ schema?: JoiDescription }>;
  rules?: Array<{ name: string; args?: Record<string, unknown> }>;
  whens?: Array<{
    ref?: { path?: Array<string | number> };
    is?: JoiDescription;
    then?: JoiDescription;
    otherwise?: JoiDescription;
  }>;
}

function isNullOnly(description: JoiDescription): boolean {
  return description.type === 'any'
    && description.flags?.only === true
    && description.allow?.includes(null) === true;
}

function allowedValues(description: JoiDescription): unknown[] {
  return (description.allow ?? []).filter(
    (value) => !(typeof value === 'object' && value !== null && 'override' in value),
  );
}

function conditionalRequirements(
  properties: Record<string, SchemaObject>,
  keys: Record<string, JoiDescription>,
): SchemaObject[] {
  const branches: SchemaObject[] = [];

  for (const [field, description] of Object.entries(keys)) {
    for (const when of description.whens ?? []) {
      const conditionField = when.ref?.path?.[0];
      const matches = allowedValues(when.is ?? {});
      const conditionSchema = typeof conditionField === 'string'
        ? properties[conditionField]
        : undefined;
      const conditionValues = conditionSchema?.enum;
      const requiredWhenMatched = when.then?.flags?.presence === 'required';
      const allowsEmptyOtherwise = allowedValues(when.otherwise ?? {}).includes('');

      if (
        typeof conditionField !== 'string'
        || matches.length === 0
        || !Array.isArray(conditionValues)
        || !requiredWhenMatched
      ) {
        throw new Error(`Unsupported Joi conditional schema for field "${field}".`);
      }

      const otherValues = conditionValues.filter((value) => !matches.includes(value));
      branches.push({
        properties: {
          [conditionField]: { enum: matches },
          ...(allowsEmptyOtherwise ? { [field]: { minLength: 1 } } : {}),
        },
        required: [conditionField, field],
      });

      if (otherValues.length > 0) {
        branches.push({
          properties: {
            [conditionField]: { enum: otherValues },
            ...(allowsEmptyOtherwise ? { [field]: { minLength: 0 } } : {}),
          },
          required: [conditionField],
        });
      }
    }
  }

  return branches;
}

function convert(description: JoiDescription): SchemaObject {
  const schema: SchemaObject = {};
  const values = allowedValues(description);
  const rules = description.rules ?? [];
  const hasNull = values.includes(null) || isNullOnly(description);

  switch (description.type) {
    case 'object': {
      const keys = description.keys ?? {};
      const properties = Object.fromEntries(
        Object.entries(keys).map(([key, child]) => [key, convert(child)]),
      );
      schema.type = 'object';
      schema.properties = properties;
      schema.additionalProperties = true;

      const required = Object.entries(keys)
        .filter(([, child]) => child.flags?.presence === 'required')
        .map(([key]) => key);
      if (required.length > 0) schema.required = required;

      const branches = conditionalRequirements(properties, keys);
      if (branches.length > 0) schema.oneOf = branches;
      break;
    }
    case 'array': {
      schema.type = 'array';
      const items = description.items ?? [];
      if (items.length === 1) {
        schema.items = convert(items[0]);
      } else if (items.length > 1) {
        schema.items = { anyOf: items.map(convert) };
      }
      for (const rule of rules) {
        const limit = rule.args?.limit;
        if (rule.name === 'min' && typeof limit === 'number') schema.minItems = limit;
        if (rule.name === 'max' && typeof limit === 'number') schema.maxItems = limit;
      }
      break;
    }
    case 'alternatives': {
      const matches = (description.matches ?? [])
        .flatMap((match) => match.schema ? [match.schema] : []);
      const nullVariants = matches.filter(isNullOnly);
      const nonNullVariants = matches.filter((variant) => !isNullOnly(variant));
      const converted = nonNullVariants.map(convert);
      if (converted.length === 1 && nullVariants.length > 0) {
        Object.assign(schema, converted[0], { nullable: true });
      } else {
        schema.anyOf = matches.map(convert);
      }
      break;
    }
    case 'string': {
      schema.type = 'string';
      if (hasNull) schema.nullable = true;
      if (description.flags?.only && values.length > 0) schema.enum = values;
      for (const rule of rules) {
        const limit = rule.args?.limit;
        if (rule.name === 'min' && typeof limit === 'number') schema.minLength = limit;
        if (rule.name === 'max' && typeof limit === 'number') schema.maxLength = limit;
        if (rule.name === 'email') schema.format = 'email';
        if (rule.name === 'isoDate') {
          schema.anyOf = [
            { type: 'string', format: 'date' },
            { type: 'string', format: 'date-time' },
          ];
        }
        if (rule.name === 'uri') schema.format = 'uri';
        if (rule.name === 'pattern' && typeof rule.args?.regex === 'string') {
          const regex = /^\/([\s\S]*)\/[dgimsuvy]*$/.exec(rule.args.regex);
          schema.pattern = regex?.[1] ?? rule.args.regex;
        }
      }
      const allowsEmptyOtherwise = (description.whens ?? []).some((when) =>
        allowedValues(when.otherwise ?? {}).includes(''),
      );
      if (allowsEmptyOtherwise) schema.minLength = 0;
      else if (values.includes('')) schema.minLength ??= 0;
      else if (schema.minLength === undefined) schema.minLength = 1;
      break;
    }
    case 'number':
      schema.type = rules.some((rule) => rule.name === 'integer') ? 'integer' : 'number';
      if (description.flags?.only && values.length > 0) schema.enum = values;
      for (const rule of rules) {
        const limit = rule.args?.limit;
        if (rule.name === 'min' && typeof limit === 'number') schema.minimum = limit;
        if (rule.name === 'max' && typeof limit === 'number') schema.maximum = limit;
      }
      break;
    case 'boolean':
      schema.type = 'boolean';
      break;
    case 'any':
      if (description.flags?.only && values.length > 0) schema.enum = values;
      if (hasNull) schema.nullable = true;
      break;
    default:
      throw new Error(`Unsupported Joi schema type "${description.type ?? 'unknown'}".`);
  }

  if (description.flags && Object.prototype.hasOwnProperty.call(description.flags, 'default')) {
    schema.default = description.flags.default;
  }

  const invalid = description.invalid?.filter(
    (value) => !(typeof value === 'object' && value !== null && 'override' in value),
  );
  if (invalid && invalid.length > 0) schema.not = { enum: invalid };

  return schema;
}

export function joiSchemaToOpenApiSchema(schema: Joi.Schema): SchemaObject {
  return convert(schema.describe() as JoiDescription);
}

export function ApiJoiBody(schema: Joi.Schema): MethodDecorator {
  const description = schema.describe() as JoiDescription;
  return ApiBody({
    required: description.flags?.presence === 'required',
    schema: convert(description),
  });
}
