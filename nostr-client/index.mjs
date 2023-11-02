import 'websocket-polyfill'
import { relayInit, finishEvent, generatePrivateKey, getPublicKey } from 'nostr-tools'

const relay = relayInit('wss://1337-johnnyasant-satshackora-i5zo9336ya4.ws-us105.gitpod.io')
relay.on('connect', () => {
  console.log(`connected to ${relay.url}`)
})
relay.on('error', () => {
  console.log(`failed to connect to ${relay.url}`)
})

await relay.connect()