import { useState } from 'react'
import {
  connectToPeerHost,
  createLocalTransport,
  createManualGuest,
  createManualHost,
  createPeerHost,
  type ManualHost,
  type PeerHost,
} from '../coop/transport.ts'
import { useCoopStore } from '../state/coopStore.ts'
import type { PlayerRole } from '../state/gameStore.ts'
import './coop-dialog.css'

export function CoopDialog({ onClose }: { onClose: () => void }) {
  const coop = useCoopStore()
  const [tab, setTab] = useState<'host' | 'guest'>('host')
  const [method, setMethod] = useState<'cloud' | 'manual' | 'lokal'>('cloud')
  const [room, setRoom] = useState('')
  const [roomInput, setRoomInput] = useState('')
  const [hostRole, setHostRole] = useState<PlayerRole>('disponent')
  const [peerHost, setPeerHost] = useState<PeerHost | null>(null)
  const [manualHost, setManualHost] = useState<ManualHost | null>(null)
  const [guestAnswer, setGuestAnswer] = useState('')
  const [joinId, setJoinId] = useState('')
  const [offerInput, setOfferInput] = useState('')
  const [answerInput, setAnswerInput] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const startCloudHost = async () => {
    setBusy(true)
    setError('')
    try {
      const host = await createPeerHost()
      setPeerHost(host)
      void host.waitForGuest.then((transport) => {
        useCoopStore.getState().startHost(transport, hostRole)
      })
    } catch (err) {
      setError(`PeerJS-Cloud nicht erreichbar: ${err instanceof Error ? err.message : err}`)
    } finally {
      setBusy(false)
    }
  }

  const joinCloud = async () => {
    setBusy(true)
    setError('')
    try {
      const transport = await connectToPeerHost(joinId.trim())
      useCoopStore.getState().startGuest(transport)
    } catch (err) {
      setError(`Verbindung fehlgeschlagen: ${err instanceof Error ? err.message : err}`)
    } finally {
      setBusy(false)
    }
  }

  const startManualHost = async () => {
    setBusy(true)
    setError('')
    try {
      const host = await createManualHost()
      setManualHost(host)
      useCoopStore.getState().startHost(host.transport, hostRole)
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  const acceptManualAnswer = async () => {
    if (!manualHost) return
    setBusy(true)
    try {
      await manualHost.acceptAnswer(answerInput)
    } catch (err) {
      setError(`Antwort-Code ungültig: ${err instanceof Error ? err.message : err}`)
    } finally {
      setBusy(false)
    }
  }

  const startLocalHost = () => {
    const code = Math.random().toString(36).slice(2, 6).toUpperCase()
    setRoom(code)
    useCoopStore.getState().startHost(createLocalTransport(code, 'host'), hostRole)
  }

  const joinLocal = () => {
    useCoopStore.getState().startGuest(createLocalTransport(roomInput.trim().toUpperCase(), 'guest'))
  }

  const joinManual = async () => {
    setBusy(true)
    setError('')
    try {
      const guest = await createManualGuest(offerInput)
      setGuestAnswer(guest.answerCode)
      useCoopStore.getState().startGuest(guest.transport)
    } catch (err) {
      setError(`Einladungs-Code ungültig: ${err instanceof Error ? err.message : err}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings-overlay" role="dialog" aria-label="Coop">
      <div className="settings-dialog coop-dialog">
        <header className="settings-header">
          <h2>Coop (2 Spieler)</h2>
          <button aria-label="Coop schließen" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="coop-status" data-testid="coop-status">
          {coop.mode === 'off' && 'Nicht verbunden.'}
          {coop.mode === 'host' &&
            (coop.connected ? '✓ Verbunden als Host' : 'Warte auf Mitspieler…')}
          {coop.mode === 'guest' && (coop.connected ? '✓ Verbunden als Gast' : 'Verbinde…')}
        </div>

        {!coop.connected && (
          <>
            <div className="coop-tabs">
              <button className={tab === 'host' ? 'menu-active' : ''} onClick={() => setTab('host')}>
                Spiel hosten
              </button>
              <button className={tab === 'guest' ? 'menu-active' : ''} onClick={() => setTab('guest')}>
                Beitreten
              </button>
              <span className="coop-spacer" />
              <button
                className={method === 'cloud' ? 'menu-active' : ''}
                onClick={() => setMethod('cloud')}
              >
                PeerJS-Cloud
              </button>
              <button
                className={method === 'manual' ? 'menu-active' : ''}
                onClick={() => setMethod('manual')}
              >
                Manueller Code
              </button>
              <button
                className={method === 'lokal' ? 'menu-active' : ''}
                onClick={() => setMethod('lokal')}
                title="Zwei Fenster im selben Browser (z. B. zwei Monitore)"
              >
                Lokal (2 Fenster)
              </button>
            </div>

            {tab === 'host' && (
              <div className="coop-section">
                <label>
                  Meine Rolle:{' '}
                  <select
                    aria-label="Host-Rolle"
                    value={hostRole}
                    onChange={(e) => setHostRole(e.target.value as PlayerRole)}
                  >
                    <option value="disponent">Disponent (Gast wird Calltaker)</option>
                    <option value="calltaker">Calltaker (Gast wird Disponent)</option>
                  </select>
                </label>
                {method === 'lokal' ? (
                  room ? (
                    <p>
                      Raum-Code im zweiten Fenster eingeben:{' '}
                      <code className="coop-code" data-testid="room-code">
                        {room}
                      </code>
                    </p>
                  ) : (
                    <button onClick={startLocalHost}>Host starten (lokal)</button>
                  )
                ) : method === 'cloud' ? (
                  peerHost ? (
                    <p>
                      Spiel-ID an Mitspieler senden:{' '}
                      <code className="coop-code" data-testid="host-id">
                        {peerHost.peerId}
                      </code>
                    </p>
                  ) : (
                    <button disabled={busy} onClick={() => void startCloudHost()}>
                      Host starten (Cloud)
                    </button>
                  )
                ) : manualHost ? (
                  <>
                    <label>
                      1. Einladungs-Code an Mitspieler senden:
                      <textarea
                        aria-label="Einladungs-Code"
                        readOnly
                        value={manualHost.offerCode}
                        data-testid="offer-code"
                      />
                    </label>
                    <label>
                      2. Antwort-Code des Mitspielers einfügen:
                      <textarea
                        aria-label="Antwort-Code einfügen"
                        value={answerInput}
                        onChange={(e) => setAnswerInput(e.target.value)}
                      />
                    </label>
                    <button disabled={busy || !answerInput.trim()} onClick={() => void acceptManualAnswer()}>
                      Verbinden
                    </button>
                  </>
                ) : (
                  <button disabled={busy} onClick={() => void startManualHost()}>
                    Einladungs-Code erzeugen
                  </button>
                )}
              </div>
            )}

            {tab === 'guest' && (
              <div className="coop-section">
                {method === 'lokal' ? (
                  <>
                    <input
                      aria-label="Raum-Code"
                      placeholder="Raum-Code…"
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value)}
                    />
                    <button disabled={!roomInput.trim()} onClick={joinLocal}>
                      Beitreten (lokal)
                    </button>
                  </>
                ) : method === 'cloud' ? (
                  <>
                    <input
                      aria-label="Spiel-ID"
                      placeholder="Spiel-ID des Hosts…"
                      value={joinId}
                      onChange={(e) => setJoinId(e.target.value)}
                    />
                    <button disabled={busy || !joinId.trim()} onClick={() => void joinCloud()}>
                      Beitreten (Cloud)
                    </button>
                  </>
                ) : (
                  <>
                    <label>
                      1. Einladungs-Code des Hosts einfügen:
                      <textarea
                        aria-label="Einladungs-Code einfügen"
                        value={offerInput}
                        onChange={(e) => setOfferInput(e.target.value)}
                      />
                    </label>
                    <button disabled={busy || !offerInput.trim()} onClick={() => void joinManual()}>
                      Antwort-Code erzeugen
                    </button>
                    {guestAnswer && (
                      <label>
                        2. Antwort-Code zurück an den Host:
                        <textarea
                          aria-label="Antwort-Code"
                          readOnly
                          value={guestAnswer}
                          data-testid="answer-code"
                        />
                      </label>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {coop.mode !== 'off' && (
          <button onClick={() => useCoopStore.getState().stop()}>Coop beenden</button>
        )}
        {error && <p className="settings-error">{error}</p>}
        <p className="settings-hint">
          Host-authoritativ: Der Host simuliert, der Gast spielt die zweite Rolle
          (Calltaker ↔ Disponent). Sprachabsprache extern (z. B. Discord).
        </p>
      </div>
    </div>
  )
}
