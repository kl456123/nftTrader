import { API } from '../src/api'
import { Network, OrderSide } from '../src/types'
import { expect } from 'chai'

describe('API Test', () => {
  const api = new API({ networkName: Network.Main })
  const NFT_CONTRACT_ADDRESS = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d'
  const NFT_TOKEN_ID = 5465
  before('', () => {})

  it('getOrders Test', async () => {
    const orders = await api.getOrders({
      side: OrderSide.Sell,
      token_id: NFT_TOKEN_ID,
      asset_contract_address: NFT_CONTRACT_ADDRESS,
    })
    expect(orders.count).to.be.gt(0)
  })
})
