<p>
<img src="https://apitoolkit.io/assets/img/logo-full.svg" alt="Monoscope" width="250px" />
</p>

<div align="center">

![Monoscope's Logo](https://github.com/monoscope-tech/.github/blob/main/images/logo-white.svg?raw=true#gh-dark-mode-only)
![Monoscope's Logo](https://github.com/monoscope-tech/.github/blob/main/images/logo-black.svg?raw=true#gh-light-mode-only)

## ExpressJS SDK

[![Monoscope SDK](https://img.shields.io/badge/APItoolkit-SDK-0068ff?logo=express)](https://github.com/topics/monoscope-sdk) [![](https://img.shields.io/npm/v/@monoscopetech/express.svg?logo=npm)](https://npmjs.com/package/@monoscopetech/express) [![](https://img.shields.io/npm/dw/@monoscopetech/express)](https://npmjs.com/package/@monoscopetech/expresss) [![Join Discord Server](https://img.shields.io/badge/Chat-Discord-7289da)](https://apitoolkit.io/discord?utm_campaign=devrel&utm_medium=github&utm_source=sdks_readme) [![APItoolkit Docs](https://img.shields.io/badge/Read-Docs-0068ff)](https://apitoolkit.io/docs/sdks/nodejs/expressjs?utm_campaign=devrel&utm_medium=github&utm_source=sdks_readme)

Monoscope Express Middleware is a middleware that can be used to monitor HTTP requests. It is provides additional functionalities on top of the open telemetry instrumentation which creates a custom span for each request capturing details about the request including request and response bodies.

</div>

### Installation

Run the following command to install the express js package from your projects root:

```sh
npm install --save @monoscopetech/express @opentelemetry/api @opentelemetry/auto-instrumentations-node
```

### Setup Open Telemetry

Setting up open telemetry allows you to send traces, metrics and logs to the Monoscope platform.

```sh
OTEL_EXPORTER_OTLP_ENDPOINT="http://otelcol.apitoolkit.io:4317"
OTEL_SERVICE_NAME="my-service" # Specifies the name of the service.
OTEL_RESOURCE_ATTRIBUTES=at-project-key="<YOUR_API_KEY>" # Adds your API KEY to the resource.
OTEL_EXPORTER_OTLP_PROTOCOL="grpc" #Specifies the protocol to use for the OpenTelemetry exporter.
```

### HTTP Requests Monitoring

You can monitor http requests using Monoscope's express middleware, this allows you to monitor all your http requests. including headers, response time, response status code, request body, response body, etc.

```js
import "dotenv/config";
import "@opentelemetry/auto-instrumentations-node/register";
import * as express from "express";
import { Monoscope } from "./index";
import axios from "axios";

const app = express();
const monoscopeClient = Monoscope.NewClient({
  serviceName: "my-service",
  serviceVersion: "1.0.0",
  tags: ["env:dev"],
  monitorAxios: axios, // optional, if you want to monitor axios requests
});

// add the middleware to for request monitoring
app.use(monoscopeClient.middleware);

app.get("/", async (req, res) => {
  const r = await axios.get("https://jsonplaceholder.typicode.com/todos/1");
  res.json(r.data);
});

// automatically report unhandled errors along with the request data
app.use(monoscopeClient.errorMiddleware);

app.listen(3000, () => {
  console.log("Example app listening on port 3000!");
});
```

#### Quick overview of the configuration parameters

An object with the following optional fields can be passed to the middleware to configure it:

| Option                | Description                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `debug`               | Set to `true` to enable debug mode.                                                               |
| `serviceName`         | A defined string name of your application.                                                        |
| `tags`                | A list of defined tags for your services (used for grouping and filtering data on the dashboard). |
| `serviceVersion`      | A defined string version of your application (used for further debugging on the dashboard).       |
| `redactHeaders`       | A list of HTTP header keys to redact.                                                             |
| `redactResponseBody`  | A list of JSONPaths from the response body to redact.                                             |
| `redactRequestBody`   | A list of JSONPaths from the request body to redact.                                              |
| `captureRequestBody`  | Default `false`, set to `true` if you want to capture the request body.                           |
| `captureResponseBody` | Default `false`, set to `true` if you want to capture the response body.                          |

<br />

> [!IMPORTANT]
>
> To learn more configuration options (redacting fields, error reporting, outgoing requests, etc.) and complete integration guide, please read this [SDK documentation](https://apitoolkit.io/docs/sdks/nodejs/expressjs?utm_campaign=devrel&utm_medium=github&utm_source=sdks_readme).
