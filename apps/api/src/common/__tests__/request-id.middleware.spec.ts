import { RequestIdMiddleware } from '../middleware/request-id.middleware';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      setHeader: jest.fn(),
    };
    mockNext = jest.fn();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should preserve existing X-Request-Id if provided in request headers', () => {
    mockRequest.headers['x-request-id'] = 'existing-client-req-id';

    middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockRequest.headers['x-request-id']).toBe('existing-client-req-id');
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-Id', 'existing-client-req-id');
    expect(mockNext).toHaveBeenCalled();
  });

  it('should generate a new UUID when X-Request-Id header is missing', () => {
    middleware.use(mockRequest, mockResponse, mockNext);

    const generatedId = mockRequest.headers['x-request-id'];
    expect(generatedId).toBeDefined();
    expect(typeof generatedId).toBe('string');
    expect(generatedId.length).toBeGreaterThan(0);
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-Id', generatedId);
    expect(mockNext).toHaveBeenCalled();
  });
});
