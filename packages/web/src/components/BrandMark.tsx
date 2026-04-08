type BrandMarkProps = {
  size?: number
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
