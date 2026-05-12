type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'code'; text: string }

function parseMarkdown(content: string): Block[] {
  const blocks: Block[] = []
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  let paragraph: string[] = []
  let list: string[] = []
  let code: string[] | null = null

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ') })
    paragraph = []
  }

  const flushList = () => {
    if (!list.length) return
    blocks.push({ kind: 'list', items: list })
    list = []
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (code) {
        blocks.push({ kind: 'code', text: code.join('\n') })
        code = null
      } else {
        flushParagraph()
        flushList()
        code = []
      }
      continue
    }

    if (code) {
      code.push(line)
      continue
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      flushParagraph()
      flushList()
      blocks.push({ kind: 'heading', level: heading[1].length as 1 | 2 | 3, text: heading[2] })
      continue
    }

    const listItem = /^\s*[-*]\s+(.+)$/.exec(line)
    if (listItem) {
      flushParagraph()
      list.push(listItem[1])
      continue
    }

    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }

    flushList()
    paragraph.push(line.trim())
  }

  if (code) blocks.push({ kind: 'code', text: code.join('\n') })
  flushParagraph()
  flushList()
  return blocks
}

export function MarkdownPreview({ content }: { content: string }) {
  const blocks = parseMarkdown(content)

  return (
    <div className="markdown-body markdown-body--lite">
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3'
          return <Tag key={index}>{block.text}</Tag>
        }
        if (block.kind === 'list') {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
            </ul>
          )
        }
        if (block.kind === 'code') {
          return <pre key={index} className="plain-code-view">{block.text}</pre>
        }
        return <p key={index}>{block.text}</p>
      })}
    </div>
  )
}
