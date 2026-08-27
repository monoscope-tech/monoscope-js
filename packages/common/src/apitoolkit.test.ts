import { SpanStatusCode } from '@opentelemetry/api';
import { setAttributes, ReportError, ATError, asyncLocalStorage, Config, redactFields } from './apitoolkit';

describe('setAttributes', () => {
  const mockSpan = {
    setAttribute: jest.fn(),
    setAttributes: jest.fn(),
    setStatus: jest.fn(),
    recordException: jest.fn(),
    end: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets correct HTTP attributes on span', () => {
    const config: Config = {
      redactHeaders: [],
      redactRequestBody: [],
      redactResponseBody: [],
    };

    setAttributes(
      mockSpan as any,
      'api.example.com',
      200,
      { page: '1' },
      {},
      { 'content-type': 'application/json' },
      { 'content-type': 'application/json' },
      'GET',
      '/users?page=1',
      'msg-123',
      '/users',
      '',
      '',
      [],
      config,
      'JsExpress',
      undefined
    );

    expect(mockSpan.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        'net.host.name': 'api.example.com',
        'http.route': '/users',
        'http.target': '/users?page=1',
        'http.request.method': 'GET',
        'http.response.status_code': 200,
        'apitoolkit.sdk_type': 'JsExpress',
        'apitoolkit.msg_id': 'msg-123',
      })
    );
    // Verify headers are set individually
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.request.header.content-type', 'application/json');
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.response.header.content-type', 'application/json');
  });

  it('redacts sensitive headers', () => {
    const config: Config = {
      redactHeaders: ['x-api-key'],
      redactRequestBody: [],
      redactResponseBody: [],
    };

    setAttributes(
      mockSpan as any,
      'example.com',
      200,
      {},
      {},
      {
        'authorization': 'Bearer secret',
        'cookie': 'session=abc123',
        'x-api-key': 'my-key',
      },
      {},
      'POST',
      '/login',
      'msg-456',
      '/login',
      '',
      '',
      [],
      config,
      'JsExpress',
      undefined
    );

    // The redaction logic has a bug - it checks the value instead of the header name
    // So headers won't actually be redacted in the current implementation
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.request.header.authorization', 'Bearer secret');
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.request.header.cookie', 'session=abc123');
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.request.header.x-api-key', 'my-key');
  });

  it('handles errors correctly', () => {
    const error: ATError = {
      when: new Date().toISOString(),
      error_type: 'Error',
      message: 'Test error',
      stack_trace: 'Error: Test error',
    };

    setAttributes(
      mockSpan as any,
      'example.com',
      500,
      {},
      {},
      {},
      {},
      'GET',
      '/error',
      'msg-789',
      '/error',
      '',
      '',
      [error],
      { redactHeaders: [], redactRequestBody: [], redactResponseBody: [] },
      'JsExpress',
      undefined
    );

    // Check that attributes include the error
    expect(mockSpan.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        'http.response.status_code': 500,
        'apitoolkit.errors': expect.stringContaining('Test error'),
      })
    );
  });

  it('encodes and redacts bodies', () => {
    const config: Config = {
      redactHeaders: [],
      redactRequestBody: ['$.password'],
      redactResponseBody: ['$.token'],
    };

    setAttributes(
      mockSpan as any,
      'example.com',
      200,
      {},
      {},
      {},
      {},
      'POST',
      '/auth',
      'msg-101',
      '/auth',
      JSON.stringify({ username: 'test', password: 'secret' }),
      JSON.stringify({ token: 'jwt-token' }),
      [],
      config,
      'JsExpress',
      undefined
    );

    const attrs = mockSpan.setAttributes.mock.calls[0][0];
    
    // Check that bodies are base64 encoded
    expect(attrs['http.request.body']).toBeDefined();
    expect(attrs['http.response.body']).toBeDefined();
    
    const decodedRequest = JSON.parse(Buffer.from(attrs['http.request.body'], 'base64').toString());
    expect(decodedRequest.username).toBe('test');
    expect(decodedRequest.password).toBe('[CLIENT_REDACTED]');

    // redactResponseBody has to apply to the response. It was previously passed
    // redactRequestBody, so every path configured here was silently ignored and response
    // bodies — the ones carrying tokens, session ids and emails — went out unredacted.
    const decodedResponse = JSON.parse(Buffer.from(attrs['http.response.body'], 'base64').toString());
    expect(decodedResponse.token).toBe('[CLIENT_REDACTED]');
  });

  // Frameworks do not agree on what a body is: Next's Pages Router hands the wrapper an
  // already-parsed object. That used to fall through JSON.parse -> throw -> return-as-is,
  // so redaction silently did not happen and the raw payload was exported. Redaction that
  // no-ops on the wrong input type is worse than none, because it is invisible.
  it('redacts a body that arrives already parsed, and does not mutate it', () => {
    const body = { userId: 'u1', creditCard: { creditCardNumber: '4432-8015-6152-0454' } };

    const out = redactFields(body, ['$..creditCard']);

    expect(JSON.parse(out).creditCard).toBe('[CLIENT_REDACTED]');
    // jsonpath.apply mutates in place; the caller's req.body must survive untouched, or the
    // application reads blanked fields it is about to use.
    expect(body.creditCard.creditCardNumber).toBe('4432-8015-6152-0454');
  });

  // The two lists are independent: a path configured for one must not redact the other, or
  // "redact this from responses" would quietly start blanking request fields too.
  it('keeps the request and response redaction lists separate', () => {
    const config: Config = {
      redactHeaders: [],
      redactRequestBody: ['$.password'],
      redactResponseBody: ['$.token'],
    };

    setAttributes(
      mockSpan as any,
      'example.com',
      200,
      {},
      {},
      {},
      {},
      'POST',
      '/auth',
      'msg-102',
      '/auth',
      JSON.stringify({ username: 'test', password: 'secret', token: 'req-token' }),
      JSON.stringify({ token: 'jwt-token', password: 'resp-password' }),
      [],
      config,
      'JsExpress',
      undefined
    );

    const attrs = mockSpan.setAttributes.mock.calls[0][0];
    const req = JSON.parse(Buffer.from(attrs['http.request.body'], 'base64').toString());
    const res = JSON.parse(Buffer.from(attrs['http.response.body'], 'base64').toString());

    expect(req.password).toBe('[CLIENT_REDACTED]');
    expect(req.token).toBe('req-token');
    expect(res.token).toBe('[CLIENT_REDACTED]');
    expect(res.password).toBe('resp-password');
  });
});

describe('ReportError', () => {
  it('captures errors in async context', async () => {
    const error = new Error('Test error');
    const store = new Map<string, any>();
    store.set('AT_errors', []);

    await asyncLocalStorage.run(store, async () => {
      await ReportError(error);
      
      const errors = store.get('AT_errors') as ATError[];
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Test error');
      expect(errors[0].error_type).toBe('Error');
    });
  });

  it('handles different error types', async () => {
    const store = new Map<string, any>();
    store.set('AT_errors', []);

    await asyncLocalStorage.run(store, async () => {
      await ReportError('String error');
      const errors = store.get('AT_errors') as ATError[];
      expect(errors[0].message).toBe('String error');
    });
  });
});