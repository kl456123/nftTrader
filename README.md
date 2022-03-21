# nftTrader
to trade all kinds of nfts anywhere

## Installation
```bash
yarn
```

## Demo&Test
```bash
# test locally
yarn hardhat node
yarn hardhat run script/deploy.ts --network localhost
yarn hardhat test
```

## Development

### code structure
* trader.ts, trade nft in exchange
* schemas, asset specification to define interfaces of nft
