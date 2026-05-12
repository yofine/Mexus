type BrandLockupProps = {
  subtitle?: string
}

export function BrandLockup({ subtitle = 'Mexus' }: BrandLockupProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1 }}>
        <span
          style={{
            color: 'var(--accent-text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 760,
            letterSpacing: 0,
            whiteSpace: 'nowrap',
          }}
        >
          M.E.X.U.S.
        </span>
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: 10,
            fontWeight: 600,
            marginTop: 3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {subtitle}
        </span>
      </div>
    </div>
  )
}
