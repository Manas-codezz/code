export function BrandLogo({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_0_10px_rgba(249,115,22,0.5)]"
      >
        {/* Subtle glowing shield background */}
        <path
          d="M16 3L5 7.5V15C5 22.5 9.7 27.8 16 29.5C22.3 27.8 27 22.5 27 15V7.5L16 3Z"
          fill="rgba(249, 115, 22, 0.08)"
        />
        {/* Shield contour */}
        <path
          d="M16 3L5 7.5V15C5 22.5 9.7 27.8 16 29.5C22.3 27.8 27 22.5 27 15V7.5L16 3Z"
          stroke="url(#shieldGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Inner geometric check / governance mark */}
        <path
          d="M11 16L14.5 19.5L21 12"
          stroke="#ffedd5"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="shieldGrad" x1="5" y1="3" x2="27" y2="29.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f97316" />
            <stop offset="1" stopColor="#ea580c" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}
