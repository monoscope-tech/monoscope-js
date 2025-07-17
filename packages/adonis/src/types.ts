import { Config } from '@monoscope/common'
declare module '@adonisjs/core/http' {
  interface HttpContext {
    apitoolkitData: {
      msgId: string
      errors: any[]
      config: Config
    }
  }
}
