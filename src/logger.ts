import bunyan from 'bunyan'

export const logger = bunyan.createLogger({
  name: 'NFTTrader',
  serializers: bunyan.stdSerializers,
  level: bunyan.DEBUG,
})

export type Logger = bunyan
