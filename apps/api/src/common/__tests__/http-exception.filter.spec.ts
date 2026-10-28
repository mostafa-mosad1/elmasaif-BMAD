import { ArgumentsHost, BadRequestException, HttpException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { HttpExceptionFilter } from '../filters/http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockSetHeader: jest.Mock;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockImplementation(() => ({ json: mockJson }));
    mockSetHeader = jest.fn();

    mockResponse = {
      status: mockStatus,
      setHeader: mockSetHeader,
    };

    mockRequest = {
      headers: {
        'x-request-id': 'test-request-id-1234',
      },
      url: '/api/v1/test',
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should format NestJS BadRequestException into canonical error envelope', () => {
    const exception = new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Invalid input data',
      details: { field: ['must be a valid string'] },
    });

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith({
      code: 'VALIDATION_ERROR',
      message: 'Invalid input data',
      details: { field: ['must be a valid string'] },
      requestId: 'test-request-id-1234',
    });
  });

  it('should format standard class-validator array messages into VALIDATION_ERROR code and details', () => {
    const exception = new BadRequestException({
      statusCode: 400,
      message: ['email must be an email', 'password is too short'],
      error: 'Bad Request',
    });

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: expect.objectContaining({
          errors: ['email must be an email', 'password is too short'],
        }),
        requestId: 'test-request-id-1234',
      })
    );
  });

  it('should map standard HTTP exceptions (e.g. 404 NotFound) to matching code and status', () => {
    const exception = new HttpException('Resource not found', HttpStatus.NOT_FOUND);

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith({
      code: 'NOT_FOUND',
      message: 'Resource not found',
      details: {},
      requestId: 'test-request-id-1234',
    });
  });

  it('should mask unknown runtime errors into INTERNAL_SERVER_ERROR without leaking raw internals', () => {
    const rawError = new Error('Database connection failed: password authentication failed');

    filter.catch(rawError, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        requestId: 'test-request-id-1234',
      })
    );
  });

  it('should generate a correlation requestId if request has no x-request-id header', () => {
    mockRequest.headers = {};
    const exception = new InternalServerErrorException('Server failure');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const sentData = mockJson.mock.calls[0][0];
    expect(sentData.requestId).toBeDefined();
    expect(typeof sentData.requestId).toBe('string');
    expect(sentData.requestId.length).toBeGreaterThan(0);
    expect(mockSetHeader).toHaveBeenCalledWith('X-Request-Id', sentData.requestId);
  });
});
