/**
 * Zod Validation Middleware for Express
 *
 * Provides defense-in-depth validation at the route level
 * before requests reach controllers/services.
 *
 * Usage:
 *   router.post('/register', validate(registerSchema), authController.register);
 *   router.post('/messages', validate(createMessageSchema, 'body'), messageController.create);
 */

import type { Request, Response, NextFunction } from 'express';
import type { AnyZodObject, ZodError, ZodEffects } from 'zod';

import { AppError } from '../errors/AppError';
import { logger } from '../logger';

type ValidationSource = 'body' | 'query' | 'params';
type ValidatableSchema = AnyZodObject | ZodEffects<AnyZodObject>;

/**
 * Creates Express middleware that validates request data against a Zod schema
 *
 * @param schema - Zod schema to validate against (can be ZodObject or ZodEffects)
 * @param source - Which part of the request to validate ('body', 'query', or 'params')
 * @returns Express middleware function
 *
 * @example
 * // Validate request body
 * router.post('/register', validate(registerSchema), controller.register);
 *
 * @example
 * // Validate query parameters
 * router.get('/users', validate(listUsersSchema, 'query'), controller.list);
 *
 * @example
 * // Validate route params
 * router.get('/users/:id', validate(userIdSchema, 'params'), controller.getById);
 */
export function validate(schema: ValidatableSchema, source: ValidationSource = 'body') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get the data to validate based on source
      const dataToValidate = req[source];

      // Parse and validate with Zod
      const validated = await schema.parseAsync(dataToValidate);

      // Replace the original data with validated data
      // This ensures all downstream code works with validated, typed data
      req[source] = validated;

      next();
    } catch (error) {
      if ((error as any).name === 'ZodError') {
        const zodError = error as ZodError;

        // Format Zod errors for client consumption
        const formattedErrors = zodError.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        logger.warn('[VALIDATION] Request validation failed', {
          source,
          errors: formattedErrors,
          path: req.path,
          method: req.method,
        });

        // Return 400 Bad Request with detailed error info
        return next(
          new AppError(
            `Validation failed: ${formattedErrors.map((e) => e.message).join(', ')}`,
            400
          )
        );
      }

      // If it's not a Zod error, pass it to the error handler
      next(error);
    }
  };
}

/**
 * Validates multiple sources in a single middleware
 *
 * @example
 * router.post(
 *   '/messages/:conversationId',
 *   validateMultiple({
 *     body: createMessageSchema,
 *     params: conversationIdSchema
 *   }),
 *   controller.create
 * );
 */
export function validateMultiple(schemas: Partial<Record<ValidationSource, ValidatableSchema>>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors: Array<{ source: string; field: string; message: string }> = [];

      // Validate each source
      for (const [source, schema] of Object.entries(schemas)) {
        if (!schema) continue;

        const dataToValidate = req[source as ValidationSource];

        try {
          const validated = await schema.parseAsync(dataToValidate);
          req[source as ValidationSource] = validated;
        } catch (error) {
          if ((error as any).name === 'ZodError') {
            const zodError = error as ZodError;
            zodError.errors.forEach((err) => {
              errors.push({
                source,
                field: err.path.join('.'),
                message: err.message,
              });
            });
          } else {
            throw error;
          }
        }
      }

      // If there are validation errors, return them all
      if (errors.length > 0) {
        logger.warn('[VALIDATION] Multiple source validation failed', {
          errors,
          path: req.path,
          method: req.method,
        });

        return next(
          new AppError(
            `Validation failed: ${errors.map((e) => `${e.source}.${e.field}: ${e.message}`).join(', ')}`,
            400
          )
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Validates file upload constraints
 *
 * @param options - Upload validation options
 * @returns Express middleware function
 *
 * @example
 * router.post(
 *   '/upload',
 *   validateFileUpload({ maxSize: 5 * 1024 * 1024, allowedTypes: ['image/jpeg', 'image/png'] }),
 *   controller.upload
 * );
 */
export function validateFileUpload(options: {
  maxSize?: number;
  allowedTypes?: string[];
  required?: boolean;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const file = (req as any).file;
    const { maxSize, allowedTypes, required = true } = options;

    // Check if file is required
    if (required && !file) {
      return next(new AppError('File upload is required', 400));
    }

    if (!file) {
      return next(); // File is optional and not provided
    }

    // Validate file size
    if (maxSize && file.size > maxSize) {
      return next(new AppError(`File size exceeds maximum allowed size of ${maxSize} bytes`, 400));
    }

    // Validate file type
    if (allowedTypes && !allowedTypes.includes(file.mimetype)) {
      return next(
        new AppError(
          `File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
          400
        )
      );
    }

    next();
  };
}

/**
 * Type guard to check if an error is a Zod error
 */
export function isZodError(error: unknown): error is ZodError {
  return (error as any)?.name === 'ZodError';
}

/**
 * Formats Zod error for consistent API responses
 */
export function formatZodError(error: ZodError): {
  message: string;
  errors: Array<{ field: string; message: string; code: string }>;
} {
  const errors = error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));

  return {
    message: `Validation failed: ${errors.map((e) => e.message).join(', ')}`,
    errors,
  };
}
