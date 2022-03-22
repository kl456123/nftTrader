import { ethers, Wallet } from 'ethers'
import { Logger, logger as defaultLogger } from './logger'

export class WalletProvider {
  protected walletByAddress: Record<string, Wallet> = {}
  protected logger: Logger
  constructor(public provider: ethers.providers.BaseProvider, logger?: Logger) {
    this.logger = logger || defaultLogger
  }

  public listAccounts() {
    return Object.keys(this.walletByAddress)
  }

  public unlock(passwd: string) {
    const wallet = new Wallet(passwd, this.provider)
    const accountAddress = wallet.address
    if (this.has(accountAddress)) {
      this.logger.warn(`${accountAddress} is unlocked alreadly!`)
      return
    }
    this.walletByAddress[accountAddress.toLowerCase()] = wallet
  }
  public unlockAll(passwds: string[]) {
    passwds.forEach((passwd) => this.unlock(passwd))
  }

  public has(accountAddress: string) {
    return accountAddress.toLowerCase() in this.walletByAddress
  }

  public getSigner(accountAddress: string): Wallet {
    if (!this.has(accountAddress)) {
      throw new Error(`please unlock ${accountAddress} first!`)
    }
    return this.walletByAddress[accountAddress.toLowerCase()]
  }
}
