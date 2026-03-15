import type { Server } from 'node:http'
import { WebSocketServer } from 'ws'
import type { ServerConfig } from './config.js'
import { LiveSonicSession } from './liveSonicSession.js'

export function attachLiveSonicRouter(server: Server, config: ServerConfig['nova']): void {
  const webSocketServer = new WebSocketServer({ noServer: true })

  webSocketServer.on('connection', (socket) => {
    const session = new LiveSonicSession(socket, config)

    session.attach()
  })

  server.on('upgrade', (request, socket, head) => {
    if (!request.url) {
      socket.destroy()
      return
    }

    const { pathname } = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`)

    if (pathname !== '/api/live') {
      socket.destroy()
      return
    }

    webSocketServer.handleUpgrade(request, socket, head, (upgradedSocket) => {
      webSocketServer.emit('connection', upgradedSocket, request)
    })
  })
}
