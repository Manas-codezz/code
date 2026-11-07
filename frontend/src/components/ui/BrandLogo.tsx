export function BrandLogo({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        aria-hidden="true"
      >
        <path
          d="M16 3L5 7.5V15C5 22.5 9.7 27.8 16 29.5C22.3 27.8 27 22.5 27 15V7.5L16 3Z"
          fill="color-mix(in oklab, var(--color-accent) 12%, transparent)"
        />
        <path
          d="M16 3L5 7.5V15C5 22.5 9.7 27.8 16 29.5C22.3 27.8 27 22.5 27 15V7.5L16 3Z"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M11 16L14.5 19.5L21 12"
          stroke="var(--color-sage)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
