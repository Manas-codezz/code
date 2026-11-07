// AsciiArt — "lol", made with the 21st ASCII editor and baked
// to its exact rendered output (looping video + poster). Zero dependencies:
// one <video> that fills its parent. Drop it behind or inside your content:
// <div className="relative h-96"><AsciiArt className="absolute inset-0" /></div>
// Remix the source recipe (styles, animation, palette) in the editor:
// https://21st.dev/community/ascii/editor?from=deec7b29-e2fc-4377-89aa-f2c9b8d681f4
export function AsciiArt({ className }: { className?: string }) {
  return (
    <video
      className={className}
      src="https://assets.21st.dev/ascii-recipes/videos/user_3GipwIJrMw3ZdAWF5gPrHE3Xeds/6fca651a-910f-433b-9360-7af71cdf6b12.mp4"
      poster="https://assets.21st.dev/ascii-recipes/thumbnails/user_3GipwIJrMw3ZdAWF5gPrHE3Xeds/678abc69-c39c-4d9a-b8bf-630de02722ca.webp"
      autoPlay
      loop
      muted
      playsInline
      aria-label="lol — animated ASCII art"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />
  )
}
