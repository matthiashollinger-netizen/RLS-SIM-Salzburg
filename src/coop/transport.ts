/**
 * Coop transports (ARCHITECTURE.md): PeerJS cloud signaling (zero config)
 * OR a fully manual WebRTC offer/answer copy-paste fallback (zero infra).
 */

export interface Transport {
  send(data: unknown): void
  onMessage(cb: (data: unknown) => void): void
  onOpen(cb: () => void): void
  onClose(cb: () => void): void
  close(): void
}

type Handler = (data: unknown) => void

class BaseTransport implements Transport {
  protected messageCb: Handler = () => {}
  protected openCb: () => void = () => {}
  protected closeCb: () => void = () => {}
  send(_data: unknown) {}
  onMessage(cb: Handler) {
    this.messageCb = cb
  }
  onOpen(cb: () => void) {
    this.openCb = cb
  }
  onClose(cb: () => void) {
    this.closeCb = cb
  }
  close() {}
}

// ---- PeerJS (cloud signaling) ----

interface PeerJsConn {
  send(data: unknown): void
  on(event: string, cb: (arg?: unknown) => void): void
  close(): void
}

class PeerTransport extends BaseTransport {
  constructor(private conn: PeerJsConn) {
    super()
    conn.on('data', (d) => this.messageCb(d))
    conn.on('open', () => this.openCb())
    conn.on('close', () => this.closeCb())
  }
  override send(data: unknown) {
    this.conn.send(data)
  }
  override close() {
    this.conn.close()
  }
}

export interface PeerHost {
  peerId: string
  /** resolves with the transport when a guest connects */
  waitForGuest: Promise<Transport>
  destroy(): void
}

export async function createPeerHost(): Promise<PeerHost> {
  const { default: Peer } = await import('peerjs')
  const peer = new Peer()
  const peerId = await new Promise<string>((resolve, reject) => {
    peer.on('open', (id: string) => resolve(id))
    peer.on('error', (err: Error) => reject(err))
  })
  const waitForGuest = new Promise<Transport>((resolve) => {
    peer.on('connection', (conn) => {
      resolve(new PeerTransport(conn as unknown as PeerJsConn))
    })
  })
  return { peerId, waitForGuest, destroy: () => peer.destroy() }
}

export async function connectToPeerHost(hostId: string): Promise<Transport> {
  const { default: Peer } = await import('peerjs')
  const peer = new Peer()
  await new Promise<void>((resolve, reject) => {
    peer.on('open', () => resolve())
    peer.on('error', (err: Error) => reject(err))
  })
  const conn = peer.connect(hostId, { reliable: true })
  return new PeerTransport(conn as unknown as PeerJsConn)
}

// ---- Manual WebRTC (copy-paste offer/answer, zero infrastructure) ----

class RtcTransport extends BaseTransport {
  constructor(
    private pc: RTCPeerConnection,
    channel?: RTCDataChannel,
  ) {
    super()
    if (channel) this.attach(channel)
    else
      pc.ondatachannel = (e) => {
        this.attach(e.channel)
      }
  }
  private channel: RTCDataChannel | null = null
  private attach(channel: RTCDataChannel) {
    this.channel = channel
    channel.onmessage = (e) => {
      try {
        this.messageCb(JSON.parse(e.data as string))
      } catch {
        // ignore malformed
      }
    }
    channel.onopen = () => this.openCb()
    channel.onclose = () => this.closeCb()
    if (channel.readyState === 'open') this.openCb()
  }
  override send(data: unknown) {
    if (this.channel?.readyState === 'open') this.channel.send(JSON.stringify(data))
  }
  override close() {
    this.channel?.close()
    this.pc.close()
  }
}

function waitIceComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check)
        resolve()
      }
    }
    pc.addEventListener('icegatheringstatechange', check)
    // safety timeout — host candidates suffice on LAN
    setTimeout(resolve, 2500)
  })
}

function encodeSdp(desc: RTCSessionDescription | null): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(desc))))
}

function decodeSdp(code: string): RTCSessionDescriptionInit {
  return JSON.parse(decodeURIComponent(escape(atob(code.trim())))) as RTCSessionDescriptionInit
}

export interface ManualHost {
  offerCode: string
  acceptAnswer(answerCode: string): Promise<void>
  transport: Transport
}

export async function createManualHost(): Promise<ManualHost> {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
  const channel = pc.createDataChannel('rls-coop')
  const transport = new RtcTransport(pc, channel)
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  await waitIceComplete(pc)
  return {
    offerCode: encodeSdp(pc.localDescription),
    acceptAnswer: async (answerCode: string) => {
      await pc.setRemoteDescription(decodeSdp(answerCode))
    },
    transport,
  }
}

export interface ManualGuest {
  answerCode: string
  transport: Transport
}

export async function createManualGuest(offerCode: string): Promise<ManualGuest> {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
  const transport = new RtcTransport(pc)
  await pc.setRemoteDescription(decodeSdp(offerCode))
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
  await waitIceComplete(pc)
  return { answerCode: encodeSdp(pc.localDescription), transport }
}

// ---- Local transport (two windows in the SAME browser, BroadcastChannel) ----

class LocalTransport extends BaseTransport {
  private bc: BroadcastChannel
  private opened = false
  private announce: ReturnType<typeof setInterval> | null = null

  constructor(room: string, side: 'host' | 'guest') {
    super()
    this.bc = new BroadcastChannel(`rls-coop-${room}`)
    this.bc.onmessage = (e) => {
      const msg = e.data as { t: string; from: string; data?: unknown }
      if (msg.from === side) return
      if (msg.t === '__presence') {
        this.bc.postMessage({ t: '__presence', from: side })
        this.markOpen()
      } else if (msg.t === '__data') {
        this.markOpen()
        this.messageCb(msg.data)
      }
    }
    this.announce = setInterval(() => {
      if (!this.opened) this.bc.postMessage({ t: '__presence', from: side })
      else this.stopAnnounce()
    }, 300)
    this.bc.postMessage({ t: '__presence', from: side })

    this.sendImpl = (data) => this.bc.postMessage({ t: '__data', from: side, data })
  }

  private sendImpl: (data: unknown) => void

  private markOpen() {
    if (this.opened) return
    this.opened = true
    this.stopAnnounce()
    this.openCb()
  }

  private stopAnnounce() {
    if (this.announce) {
      clearInterval(this.announce)
      this.announce = null
    }
  }

  override send(data: unknown) {
    this.sendImpl(data)
  }

  override close() {
    this.stopAnnounce()
    this.bc.close()
    this.closeCb()
  }
}

/** Same-browser coop (two windows/tabs) — also the deterministic CI path. */
export function createLocalTransport(room: string, side: 'host' | 'guest'): Transport {
  return new LocalTransport(room, side)
}
