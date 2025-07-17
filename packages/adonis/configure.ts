import ConfigureCommand from '@adonisjs/core/commands/configure'
import { stubsRoot } from './stubs/main.js'

export async function configure(command: ConfigureCommand) {
  const codemods = await command.createCodemods()

  await codemods.makeUsingStub(stubsRoot, 'monoscope.stub', {
    debug: false,
    captureRequestBody: true,
    captureResponseBody: true,
  })
}
