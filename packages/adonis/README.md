<div align="center">

![Monoscope's Logo](https://github.com/monoscope-tech/.github/blob/main/images/logo-white.svg?raw=true#gh-dark-mode-only)
![Monoscope's Logo](https://github.com/monoscope-tech/.github/blob/main/images/logo-black.svg?raw=true#gh-light-mode-only)

## AdonisJS SDK

[![Monoscope SDK](https://img.shields.io/badge/APItoolkit-SDK-0068ff?logo=adonisjs)](https://github.com/topics/monoscope-sdk) [![](https://img.shields.io/npm/v/@monoscopetech/adonis.svg?logo=npm)](https://npmjs.com/package/@monoscopetech/adonis) [![](https://img.shields.io/npm/dw/@monoscopetech/adonis)](https://npmjs.com/package/@monoscopetech/adonis) [![Join Discord Server](https://img.shields.io/badge/Chat-Discord-7289da)](https://apitoolkit.io/discord?utm_campaign=devrel&utm_medium=github&utm_source=sdks_readme) [![Monoscope Docs](https://img.shields.io/badge/Read-Docs-0068ff)](https://apitoolkit.io/docs/sdks/nodejs/adonisjs?utm_campaign=devrel&utm_medium=github&utm_source=sdks_readme)

Monoscope Adonis Middleware is a middleware that can be used to monitor HTTP requests. It is provides additional functionalities on top of the open telemetry instrumentation which creates a custom span for each request capturing details about the request including request and response bodies.

</div>

---

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Contributing and Help](#contributing-and-help)
- [License](#license)

---

## Installation

Run the following command to install the adonis js package from your projects root:

```sh
npm install --save @monoscopetech/adonis @opentelemetry/api @opentelemetry/auto-instrumentations-node
```

### Setup Open Telemetry

Setting up open telemetry allows you to send traces, metrics and logs to the Monoscope platform.
Add the following enviroment variables.

```sh
OTEL_EXPORTER_OTLP_ENDPOINT="http://otelcol.apitoolkit.io:4317"
OTEL_SERVICE_NAME="my-service" # Specifies the name of the service.
OTEL_RESOURCE_ATTRIBUTES=at-project-key="<YOUR_API_KEY>" # Adds your API KEY to the resource.
OTEL_EXPORTER_OTLP_PROTOCOL="grpc" #Specifies the protocol to use for the OpenTelemetry exporter.
```

### HTTP Requests Monitoring

You can monitor http requests using Monoscope's Adonis middleware, this allows you to monitor all your http requests. including headers, response time, response status code, request body, response body, etc.

First configure the `@monoscopetech/adonis` sdk by running the following command:

```sh
node ace configure @monoscopetech/adonis
```

Then, register the middleware by adding the `@monoscopetech/adonis` client to your global middleware list in the `start/kernel.js|ts` file like so:

```js
import '@opentelemetry/auto-instrumentations-node/register'
import server from '@adonisjs/core/services/server'
import Monoscope from '@monoscopetech/adonis'

const client = new Monoscope()

server.use([
  () => import('#middleware/container_bindings_middleware'),
  () => import('#middleware/force_json_response_middleware'),
  () => import('@adonisjs/cors/cors_middleware'),
  () => client.middleware(),
])
```

Then, create an `monoscope.js|ts` file in the `/conf` directory and export the `defineConfig` object with some properties like so:

```js
import { defineConfig } from '@monoscopetech/adonis'

export default defineConfig({
  captureRequestBody: true,
  captureResponseBody: true,
  serviceName: 'my-service',
})
```

<br />

> [!IMPORTANT]
>
> To learn more configuration options (redacting fields, error reporting, outgoing requests, etc.), please read this [SDK documentation](https://apitoolkit.io/docs/sdks/nodejs/adonisjs?utm_campaign=devrel&utm_medium=github&utm_source=sdks_readme).

## Contributing and Help

To contribute to the development of this SDK or request help from the community and our team, kindly do any of the following:

- Read our [Contributors Guide](https://github.com/monoscope-tech/.github/blob/main/CONTRIBUTING.md).
- Join our community [Discord Server](https://apitoolkit.io/discord?utm_campaign=devrel&utm_medium=github&utm_source=sdks_readme).
- Create a [new issue](https://github.com/monoscope-tech/@monoscopetech/adonis/issues/new/choose) in this repository.

## License

This repository is published under the [MIT](LICENSE) license.

---

<div align="center">

<a href="https://apitoolkit.io?utm_campaign=devrel&utm_medium=github&utm_source=sdks_readme" target="_blank" rel="noopener noreferrer"><img src="https://github.com/monoscope-tech/.github/blob/main/images/icon.png?raw=true" width="40" /></a>

</div>
