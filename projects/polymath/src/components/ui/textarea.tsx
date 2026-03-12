import * as React from "react"
import { cn } from "../../lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, style, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          // Base layout
          "flex min-h-[80px] w-full rounded-xl px-4 py-3 text-[15px]",
          // Reset native browser styling that causes white backgrounds on mobile
          "appearance-none",
          // Dark glass appearance
          "bg-white/[0.05]",
          "text-[var(--brand-text-primary)]/90 placeholder:text-[var(--brand-text-primary)]/25",
          // Focus — background brightens subtly
          "focus:outline-none focus:bg-white/[0.08]",
          // Smooth transitions
          "transition-all duration-200",
          // Resize
          "resize-none",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-40",
          className
        )}
        style={{
          color: 'var(--premium-text-primary)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)',
          ...style,
        }}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
