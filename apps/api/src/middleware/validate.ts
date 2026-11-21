import { Request, Response, NextFunction } from 'express';
import { ZodObject, ZodError } from 'zod';
import { ValidationError } from '../lib/errors';

export const validate = (schema: ZodObject<any>) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      
      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.query !== undefined && parsed.query !== null) req.query = parsed.query as any;
      if (parsed.params !== undefined && parsed.params !== null) req.params = parsed.params as any;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ValidationError(error.issues.map((e) => e.message).join(', ')));
      } else {
        next(error);
      }
    }
  };
};
