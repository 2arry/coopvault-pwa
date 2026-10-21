// Friendly WhatsApp-ready reminder messages for treasurers.
import { money, periodName, shortDate, periodWord, firstName, appUrl } from './format'

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export function memberReminder(member, coopName, currency) {
  const s = member.standing
  const hi = `Hi ${firstName(member.full_name)}, a friendly reminder from ${coopName}:`
  const link = appUrl('/save')
  if (s.state === 'behind') {
    return `${hi} you’re ${s.periods_behind} ${periodWord(s.frequency, s.periods_behind)} behind on contributions. ${money(s.due_now, currency)} brings you up to date. You can pay in a tap here: ${link} 🙏`
  }
  return `${hi} your ${periodName(s.current_period_start, s.frequency)} contribution of ${money(s.due_now, currency)} is due by ${shortDate(s.current_period_end)}. You can pay in a tap here: ${link} 🙏`
}

export function groupUpdate(tracker, coopName, currency) {
  const p = tracker.period
  const owing = tracker.members.filter((m) => ['due', 'behind'].includes(m.standing.state))
  const paid = p.members - owing.length
  const lines = [
    `📋 ${coopName}: ${cap(periodName(p.start, p.frequency))} contributions`,
    `✅ ${paid} of ${p.members} members are up to date (${money(p.collected, currency)} collected)`,
  ]
  if (owing.length) {
    lines.push('', 'Still to pay:')
    for (const m of owing) {
      const extra = m.standing.state === 'behind' ? ` (${m.standing.periods_behind} ${periodWord(m.standing.frequency, m.standing.periods_behind)} behind)` : ''
      lines.push(`• ${m.full_name}: ${money(m.standing.due_now, currency)}${extra}`)
    }
    lines.push('', `Pay in a tap: ${appUrl('/save')}`)
  } else {
    lines.push('', 'Everyone has paid. Thank you all! 🎉')
  }
  return lines.join('\n')
}
