import { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from "axios";
import { onResponseError } from "./axios";

it("uses Axios request config after a network error without recording a synthetic exception", async () => {
  const span = {
    setAttributes: jest.fn(),
    setAttribute: jest.fn(),
    recordException: jest.fn(),
    end: jest.fn(),
  };
  const requestConfig = {
    url: "https://api.example.com/orders",
    method: "post",
    headers: AxiosHeaders.from({ "x-request-id": "req-1" }),
    meta: { span },
  } as InternalAxiosRequestConfig;
  const error = new AxiosError("socket hang up", "ECONNRESET", requestConfig, {});

  await expect(onResponseError({ redactHeaders: [], redactRequestBody: [], redactResponseBody: [] }, undefined, undefined, undefined)(error)).rejects.toBe(error);
  expect(span.recordException).not.toHaveBeenCalled();
  expect(span.setAttributes).toHaveBeenCalledWith(expect.objectContaining({
    "http.request.method": "POST",
    "http.target": "/orders",
    "net.host.name": "api.example.com",
  }));
  expect(span.setAttribute).toHaveBeenCalledWith("http.request.header.x-request-id", "req-1");
  expect(span.end).toHaveBeenCalledTimes(1);
});
