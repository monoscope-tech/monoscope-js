import MonoscopeMiddleware from '../src/middleware/monoscope_middleware.js'
export { ReportError as reportError, observeAxios } from '@monoscope/common'
import { configProvider } from '@adonisjs/core'
import { RuntimeException } from '@poppinss/utils'
import type { ApplicationService } from '@adonisjs/core/types'
import { Config } from '@monoscope/common'

declare module '@adonisjs/core/types' {
  export interface ContainerBindings {
    Monoscope: any
  }
}

export default class MonoscopeProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('Monoscope', async () => {
      const appConfigProvider = this.app.config.get('monoscope')
      const config = await configProvider.resolve<Config>(this.app, appConfigProvider)

      if (!config) {
        throw new RuntimeException(
          'Invalid config exported from "config/monoscope.ts" file. Make sure to use the defineConfig method'
        )
      }

      return new MonoscopeMiddleware()
    })
  }
}
