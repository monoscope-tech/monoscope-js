import { observeGrpc } from "./grpc";

// The span the interceptor writes to, captured so each test can assert on what was recorded
// rather than on what was logged.
let attrs: Record<string, any> = {};
let ended = 0;
let status: any = null;

jest.mock("@opentelemetry/api", () => ({
  trace: {
    getTracer: () => ({
      startActiveSpan: (_name: string, fn: (span: any) => any) =>
        fn({
          setAttributes: (a: Record<string, any>) => Object.assign(attrs, a),
          setAttribute: (k: string, v: any) => (attrs[k] = v),
          setStatus: (s: any) => (status = s),
          recordException: () => {},
          end: () => ended++,
        }),
    }),
  },
  SpanStatusCode: { ERROR: 2 },
}));

const decode = (key: string) =>
  JSON.parse(Buffer.from(attrs[key], "base64").toString());

beforeEach(() => {
  attrs = {};
  ended = 0;
  status = null;
});

const METHOD = "/oteldemo.PaymentService/Charge";

test("captures request and response bodies as base64 on a monoscope.http span", done => {
  const handler = (_call: any, cb: any) => cb(null, { transactionId: "txn-1" });
  observeGrpc({ method: METHOD }, handler)({ request: { a: 1 } }, (err, res) => {
    expect(err).toBeNull();
    expect(res).toEqual({ transactionId: "txn-1" });
    expect(decode("http.request.body")).toEqual({ a: 1 });
    expect(decode("http.response.body")).toEqual({ transactionId: "txn-1" });
    expect(attrs["http.route"]).toBe(METHOD);
    expect(attrs["apitoolkit.sdk_type"]).toBe("JsGrpc");
    expect(attrs["rpc.system"]).toBe("grpc");
    expect(attrs["rpc.grpc.status_code"]).toBe(0);
    expect(ended).toBe(1);
    done();
  });
});

// The reason this SDK version exists rather than the hand-rolled one: redaction comes from the
// user's own JSONPath config. A gRPC request arrives already decoded, which is the exact path
// where redaction previously did JSON.parse on an object, threw, and returned it untouched.
test("redacts a decoded request message using the caller's JSONPath config", done => {
  const config = {
    method: METHOD,
    redactRequestBody: ["$.creditCard.creditCardNumber", "$.creditCard.creditCardCvv"],
  };
  const request = {
    amount: { units: 42 },
    creditCard: { creditCardNumber: "4432-8015-6152-0454", creditCardCvv: 672 },
  };
  observeGrpc(config, (_c: any, cb: any) => cb(null, {}))({ request }, () => {
    const body = decode("http.request.body");
    expect(body.creditCard.creditCardNumber).not.toBe("4432-8015-6152-0454");
    expect(body.creditCard.creditCardCvv).not.toBe(672);
    expect(body.amount.units).toBe(42); // non-sensitive fields survive
    done();
  });
});

test("collapses a protobuf Long so it is not captured as {low, high, unsigned}", done => {
  const request = { amount: { units: { low: 42, high: 0, unsigned: false } } };
  observeGrpc({ method: METHOD }, (_c: any, cb: any) => cb(null, {}))({ request }, () => {
    expect(decode("http.request.body")).toEqual({ amount: { units: "42" } });
    done();
  });
});

test("captures the error path and passes the error through unchanged", done => {
  const failure = Object.assign(new Error("card declined"), { code: 7 });
  observeGrpc({ method: METHOD }, (_c: any, cb: any) => cb(failure))({ request: {} }, err => {
    expect(err).toBe(failure); // the caller's own error object, not a wrapper
    expect(decode("http.response.body")).toEqual({ error: "card declined" });
    expect(attrs["http.response.status_code"]).toBe(500);
    expect(attrs["rpc.grpc.status_code"]).toBe(7); // PERMISSION_DENIED, not flattened to 500
    expect(status.code).toBe(2);
    done();
  });
});

test("a handler that throws synchronously still ends the span and reaches the callback", done => {
  const boom = new Error("boom");
  observeGrpc({ method: METHOD }, () => {
    throw boom;
  })({ request: {} }, err => {
    expect(err).toBe(boom);
    expect(ended).toBe(1); // without this the span leaks and the caller hangs
    done();
  });
});

test("an unserialisable request degrades to no body rather than failing the RPC", done => {
  const cyclic: any = { a: 1 };
  cyclic.self = cyclic;
  observeGrpc({ method: METHOD }, (_c: any, cb: any) => cb(null, { ok: true }))(
    { request: cyclic },
    (err, res) => {
      expect(err).toBeNull();
      expect(res).toEqual({ ok: true });
      expect(Buffer.from(attrs["http.request.body"], "base64").toString()).toBe("");
      done();
    }
  );
});
