# syntax=docker/dockerfile:1
FROM node:12.18.1

WORKDIR /app

COPY ["package.json", "package-lock.json*", "./"]

RUN npm set registry https://registry.npm.taobao.org/

RUN npm install

COPY . .

RUN npx hardhat compile

CMD npx hardhat run scripts/demo.ts
