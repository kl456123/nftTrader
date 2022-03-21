import { APIConfig, Order, OrderQuery, OrderbookResponse, OrderJSON } from './types'
import { Logger, logger as defaultLogger } from './logger'
import { ORDERBOOK_PATH, API_BASE_MAINNET } from './constants'
import { orderFromJSON } from './utils'

import axios from 'axios'

export class API {
  public pageSize = 20
  public readonly apiBaseUrl: string
  private apiKey?: string
  public logger: Logger

  constructor(config: APIConfig, logger?: Logger) {
    this.apiBaseUrl = config.apiBaseUrl || API_BASE_MAINNET
    this.apiKey = config.apiKey
    this.logger = logger ?? defaultLogger
  }

  public async getOrders(query: OrderQuery, page = 1): Promise<{ orders: Order[]; count: number }> {
    const result = await this.get(`${ORDERBOOK_PATH}/orders/`, {
      limit: this.pageSize,
      offset: (page - 1) * this.pageSize,
      ...query,
    })
    const json = result as OrderbookResponse
    return { orders: json.orders.map((j) => orderFromJSON(j)), count: json.count }
  }

  public async get<T>(apiPath: string, query: object = {}): Promise<T> {
    const finalUrl = this.apiBaseUrl + apiPath
    const response = await axios.get(finalUrl, { params: query })
    const { data, status } = response
    if (status != 200) {
      this.logger.error(`${response}`)
      throw new Error(`Unable to get data from ${finalUrl}`)
    }
    return response.data
  }

  /**
   * Send an order to the orderbook.
   * Throws when the order is invalid.
   * IN NEXT VERSION: change order input to Order type
   * @param order Order JSON to post to the orderbook
   * @param retries Number of times to retry if the service is unavailable for any reason
   */
  public async postOrder(order: OrderJSON, retries = 2): Promise<Order> {
    let json
    json = (await this.post(`${ORDERBOOK_PATH}/orders/post/`, order)) as OrderJSON
    return orderFromJSON(json)
  }

  /**
   * POST JSON data to API, sending auth token in headers
   * @param apiPath Path to URL endpoint under API
   * @param body Data to send. Will be JSON.stringified
   * @param opts RequestInit opts, similar to Fetch API. If it contains
   *  a body, it won't be stringified.
   */
  public async post<T>(apiPath: string, body?: object): Promise<T> {
    const finalUrl = this.apiBaseUrl + apiPath
    const response = await axios.post(finalUrl, body)
    return response.data
  }
}
