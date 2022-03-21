import * as dotenv from 'dotenv'

dotenv.config()

export const passwdBook: Record<string, string> = {
  [`${process.env.ALICE_ADDR!.toLowerCase()}`]: process.env.ALICE_PASSWD!,
  [`${process.env.BOB_ADDR!.toLowerCase()}`]: process.env.BOB_PASSWD!,
}
