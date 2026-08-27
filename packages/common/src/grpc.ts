import { trace, SpanStatusCode } from "@opentelemetry/api";
import { setAttributes, Config, ATError } from "./apitoolkit";

/**
 * gRPC payload capture.
 *
 * Every other integration in this SDK is an HTTP middleware, which leaves a gRPC service with
 * no request or response payloads at all. This closes that gap without depending on a gRPC
 * package: a unary handler is just `(call, callback)`, so wrapping one needs no import beyond
 * the OpenTelemetry API this package already uses. It therefore works with `@grpc/grpc-js`,
 * with generated service stubs, and with anything else presenting the same shape.
 */

/**
 * protobuf-js decodes a 64-bit field into a Long — `{low, high, unsigned}` — which
 * JSON.stringify renders verbatim, so an amount would be captured as
 * `{"low":42,"high":0,"unsigned":false}` rather than `"42"`. That reads as broken capture, and
 * it also defeats a JSONPath redaction rule written against the value the user expects.
 */
const isLong = (v: any): boolean =>
  v !== null &&
  typeof v === "object" &&
  typeof v.low === "number" &&
  typeof v.high === "number";

const normalize = (value: any): any => {
  if (isLong(value)) return String(value.high * 2 ** 32 + (value.low >>> 0));
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, normalize(v)])
    );
  }
  return value;
};

// Best-effort by design: capture must never be the reason an RPC fails, so a message that
// cannot be represented (a cycle, an exotic field) degrades to no body rather than to an
// exception thrown on the request path.
const toBodyString = (value: any): string => {
  try {
    return JSON.stringify(normalize(value)) ?? "";
  } catch {
    return "";
  }
};

// A gRPC error carries a numeric `code`; anything else is an unexpected throw. `2` is UNKNOWN,
// which is what gRPC itself reports for a handler that failed without saying how.
const grpcStatusOf = (err: any): number =>
  typeof err?.code === "number" ? err.code : 2;

export interface GrpcConfig extends Config {
  /**
   * The RPC path, e.g. `/oteldemo.PaymentService/Charge`. Recorded as the route, which is what
   * groups calls together in the UI, so it should identify the method rather than the call.
   */
  method: string;
}

// Capture is opt-in, matching every other integration in this SDK and the Go one. It has to be:
// bodies are the expensive part of a span and the thing most likely to carry something the
// operator did not intend to store, so turning them on should be a decision rather than a
// default. Leaving it always-on would also mean the only way to stop capturing is to remove
// the wrapper.

type GrpcCallback = (err: any, response?: any) => void;
type GrpcHandler = (call: { request: any }, callback: GrpcCallback) => void;

/**
 * Wrap a unary gRPC handler so Monoscope captures its request and response payloads.
 *
 * ```ts
 * server.addService(svc, {
 *   charge: observeGrpc({ method: "/oteldemo.PaymentService/Charge",
 *                         redactRequestBody: ["$.creditCard.creditCardNumber"] },
 *                       chargeHandler),
 * });
 * ```
 *
 * The span is a child of whatever gRPC auto-instrumentation already produced rather than a
 * replacement for it, so the trace keeps its usual shape and this only adds payload detail.
 *
 * Streaming RPCs are **not** covered: there is no single request or response message to
 * capture. Wrapping one would silently record nothing, so it is better to know that this
 * applies to unary calls only.
 */
export function observeGrpc(config: GrpcConfig, handler: GrpcHandler): GrpcHandler {
  return (call, callback) =>
    trace.getTracer("monoscope").startActiveSpan("monoscope.http", (span) => {
      // The RPC's own outcome must be unaffected by capture, so every path below hands the
      // handler's (err, response) back untouched.
      const finish = (err: any, response?: any) => {
        try {
          setAttributes(
            span,
            "",
            err ? 500 : 200,
            {},
            {},
            {},
            {},
            "POST",
            config.method,
            "",
            config.method,
            config.captureRequestBody ? toBodyString(call.request) : "",
            config.captureResponseBody
              ? toBodyString(err ? { error: err.message } : response)
              : "",
            [] as ATError[],
            config,
            "JsGrpc",
            undefined,
            {
              // Emitted alongside the HTTP-shaped fields above, not instead of them. The lift
              // that puts bodies in front of the user keys off the HTTP shape, but a gRPC
              // status says more than "ok or not" — NOT_FOUND and RESOURCE_EXHAUSTED both
              // flatten to 500 — so the real one is recorded too.
              "rpc.system": "grpc",
              "rpc.method": config.method,
              "rpc.grpc.status_code": err ? grpcStatusOf(err) : 0,
            }
          );
          if (err) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          }
        } catch {
          // setAttributes ends the span itself; if it threw before doing so the span would
          // leak, and in a long-running server that accumulates per request.
          try {
            span.end();
          } catch {}
        }
        callback(err, response);
      };

      try {
        handler(call, finish);
      } catch (err) {
        // A handler that throws synchronously never reaches its callback, so without this the
        // span would never end and the caller would hang.
        finish(err);
      }
    });
}
