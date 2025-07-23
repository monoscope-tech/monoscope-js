The monoscope package `@monoscopetech/adonis` has been successfully configured. Before you begin, please register the middleware inside your `start/kernel.ts` file.

```ts
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
