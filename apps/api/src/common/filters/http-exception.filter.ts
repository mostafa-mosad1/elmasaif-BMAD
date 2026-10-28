import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

export interface StandardErrorEnvelope {
  code: string;
  message: string;
  details?: Record<string, any>;
  requestId: string;
}

const HTTP_STATUS_CODE_MAP: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Resolve or generate Request ID
    let requestId = request?.headers ? (request.headers['x-request-id'] as string) : undefined;
    if (!requestId || requestId.trim().length === 0) {
      requestId = randomUUID();
    }
    if (response?.setHeader) {
      response.setHeader('X-Request-Id', requestId);
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Internal server error';
    let details: Record<string, any> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        code = HTTP_STATUS_CODE_MAP[status] || 'HTTP_ERROR';
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resObj = exceptionResponse as Record<string, any>;

        // Handle class-validator validation error arrays
        if (Array.isArray(resObj.message)) {
          code = resObj.code || 'VALIDATION_ERROR';
          message = resObj.error || 'Validation failed';
          details = resObj.details || { errors: resObj.message };
        } else {
          code = resObj.code || HTTP_STATUS_CODE_MAP[status] || 'HTTP_ERROR';
          message = resObj.message || exception.message || 'An error occurred';
          details = resObj.details || {};
        }
      }
    } else {
      // Unhandled generic Error / 500
      const err = exception as Error;
      this.logger.error(
        `[${requestId}] Unhandled exception: ${err?.message || 'Unknown error'}`,
        err?.stack
      );

      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_SERVER_ERROR';
      message = 'Internal server error';
      details = {};
    }

    const payload: StandardErrorEnvelope = {
      code,
      message,
      details,
      requestId,
    };

    response.status(status).json(payload);
  }
}
