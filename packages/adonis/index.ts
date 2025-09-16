export { configure } from './configure.js'
import { ReportError, observeAxios as as, AxiosConfig, addAttributesToCurrentSpan } from '@monoscopetech/common'
export { defineConfig } from './src/define_config.js'
import MonoscopeMiddleware from './src/middleware/monoscope_middleware.js'
import { HttpContext } from '@adonisjs/core/http'

export function observeAxios(config: AxiosConfig) {
  config.requestContext = HttpContext
  return as(config)
}

export function reportError(err: any) {
  ReportError(err, HttpContext)
}

export { addAttributesToCurrentSpan }

const Monoscope = MonoscopeMiddleware
export default Monoscope
