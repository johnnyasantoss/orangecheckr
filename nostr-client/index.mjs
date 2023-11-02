import 'websocket-polyfill'
import { relayInit, finishEvent, generatePrivateKey, getPublicKey } from 'nostr-tools'

const relay = relayInit('ws://127.0.0.1:8008/')
relay.on('connect', () => {
  console.log(`connected to ${relay.url}`)
})
relay.on('error', () => {
  console.log(`failed to connect to ${relay.url}`)
})

await relay.connect()