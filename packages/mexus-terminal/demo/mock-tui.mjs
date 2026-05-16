#!/usr/bin/env node

const rows = [
  'Mexus Terminal Runtime Demo',
  'This process is running inside a real node-pty session.',
  'Use arrow keys, type text, press Ctrl+C or q to exit.',
]

let cursor = 0
let input = ''
let ticks = 0

function write(data) {
  process.stdout.write(data)
}

function render() {
  ticks += 1
  write('\x1b[?25l')
  write('\x1b[2J\x1b[H')
  write('\x1b[38;2;93;221;192m')
  write(`${rows[0]}\r\n`)
  write('\x1b[0m')
  write(`${rows[1]}\r\n`)
  write(`${rows[2]}\r\n\r\n`)
  write('Menu\r\n')
  for (let index = 0; index < 4; index += 1) {
    const active = index === cursor
    write(active ? '\x1b[48;2;42;184;154m\x1b[38;2;15;15;15m' : '\x1b[38;2;180;180;180m')
    write(` ${active ? '>' : ' '} Agent task ${index + 1} `)
    write('\x1b[0m\r\n')
  }
  write('\r\n')
  write(`Typed input: ${input}\r\n`)
  write(`Refresh tick: ${ticks}\r\n`)
  write('\r\n')
  write('\x1b[38;2;130;130;130m')
  write('This screen redraws every second to exercise full-screen TUI rendering.\r\n')
  write('\x1b[0m')
}

function exit() {
  write('\x1b[?25h\x1b[0m\r\n')
  process.exit(0)
}

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true)
}
process.stdin.resume()
process.stdin.setEncoding('utf8')

process.stdin.on('data', (data) => {
  if (data === '\u0003' || data === 'q') {
    exit()
  }
  if (data === '\u001b[A') {
    cursor = Math.max(0, cursor - 1)
    render()
    return
  }
  if (data === '\u001b[B') {
    cursor = Math.min(3, cursor + 1)
    render()
    return
  }
  if (data === '\r') {
    input = ''
    render()
    return
  }
  if (data === '\u007f') {
    input = input.slice(0, -1)
    render()
    return
  }
  if (/^[\x20-\x7e]+$/.test(data)) {
    input += data
    render()
  }
})

render()
setInterval(render, 1000)
