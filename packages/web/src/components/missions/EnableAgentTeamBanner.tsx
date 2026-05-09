import { useState } from 'react'
import { Check, Copy, PlugZap } from 'lucide-react'

export const AGENT_TEAM_INSTALL_COMMAND = 'claude /plugin install mexus-agent-team'

function copyTextFallback(text: string): boolean {
  if (typeof document === 'undefined') return false
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-1000px'
  textarea.style.left = '-1000px'
  document.body.appendChild(textarea)
  textarea.select()
  const success = document.execCommand('copy')
  document.body.removeChild(textarea)
  return success
}

export function EnableAgentTeamBanner() {
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)

  if (dismissed) return null

  const copyInstallCommand = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(AGENT_TEAM_INSTALL_COMMAND)
      } else {
        copyTextFallback(AGENT_TEAM_INSTALL_COMMAND)
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      if (copyTextFallback(AGENT_TEAM_INSTALL_COMMAND)) {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      }
    }
  }

  return (
    <section className="mission-enable-agent-team" aria-label="Enable Agent Team">
      <div className="mission-enable-agent-team-icon" aria-hidden="true">
        <PlugZap className="icon-md" />
      </div>
      <div className="mission-enable-agent-team-body">
        <h3>Enable Agent Team to dispatch Missions</h3>
        <p>
          Install the plugin to give Squad Lead `/mission-create`, `/dispatch`, and related commands.
          You can still create Missions without it, but Squad Lead panes will not have the dispatch command surface.
        </p>
        <div className="mission-enable-agent-team-command">
          <code>{AGENT_TEAM_INSTALL_COMMAND}</code>
          <button type="button" className="pane-action-btn" onClick={copyInstallCommand}>
            {copied ? <Check className="icon-xs" /> : <Copy className="icon-xs" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
        <button
          type="button"
          className="mission-enable-agent-team-dismiss"
          onClick={() => setDismissed(true)}
        >
          Dismiss for this session
        </button>
      </div>
    </section>
  )
}
