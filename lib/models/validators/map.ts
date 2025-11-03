import Joi from 'joi';
import { idSchema as levelIdSchema } from './level';

export const nameSchema = () => {
  return Joi.string()
    .normalize()
    .trim()
    .min(1)
    .alphanum()
    .regex(/^names|all$/i, { invert: true })
    .label('Map name');
};

export const pointsSchema = () => {
  return Joi.number().integer().min(1);
};

export const levelsSchema = () => {
  return Joi.array().items(levelIdSchema()).unique().min(1);
};

export const mapSchema = Joi.object({
  name: nameSchema().alter({
    create: (schema) => schema.forbidden(), // take name from the url parameter during creation
    update: (schema) => schema.forbidden(), // do not allow changing name (primary key should not change)
  }),
  random: Joi.number()
    .integer()
    .min(0)
    .alter({
      create: (schema) => schema.optional(),
      update: (schema) => schema.optional(),
    }),
  canUseAI: Joi.boolean().alter({
    create: (schema) => schema.optional(),
    update: (schema) => schema.optional(),
  }),
  easyLevelPoints: pointsSchema().alter({
    create: (schema) => schema.required(),
    update: (schema) => schema.optional(),
  }),
  mediumLevelPoints: pointsSchema().alter({
    create: (schema) => schema.required(),
    update: (schema) => schema.optional(),
  }),
  hardLevelPoints: pointsSchema().alter({
    create: (schema) => schema.required(),
    update: (schema) => schema.optional(),
  }),
  createdAt: Joi.date().strip().optional(),
  updatedAt: Joi.date().strip().optional(),
}).or('random', 'canUseAI', 'easyLevelPoints', 'mediumLevelPoints', 'hardLevelPoints');

