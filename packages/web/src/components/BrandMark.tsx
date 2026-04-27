type BrandMarkProps = {
  size?: number
}

type BrandLockupProps = {
  subtitle?: string
}

export function BrandMark({ size = 18 }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" fill="var(--accent-primary)" opacity="0.14" />
      <path
        d="M6.5 17V7H9L12 11.62L15 7H17.5V17H15.5V10.26L12.74 14.46H11.26L8.5 10.26V17H6.5Z"
        fill="var(--accent-primary)"
      />
    </svg>
  )
}

export function BrandLockup({ subtitle = 'Mexus' }: BrandLockupProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <BrandMark size={22} />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1 }}>
        <span
          style={{
            color: 'var(--text-primary)',
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
