import { Config } from '@monoscopetech/common'
import { Span } from '@opentelemetry/api'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    apitoolkitData: {
      msgId: string
      errors: any[]
      config: Config
      span: Span
    }
  }
}
