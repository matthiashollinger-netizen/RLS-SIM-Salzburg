/**
 * WebLLM worker (AI_CALLER_TECH §Tier 2): hosts the MLC engine off the main
 * thread. The library's handler answers all engine messages.
 */
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm'

const handler = new WebWorkerMLCEngineHandler()

self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg)
}
