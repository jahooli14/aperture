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
          // Dark glass appearance
          "bg-white/[0.05] border border-white/10",
          "text-white/90 placeholder:text-white/25",
          // Focus — border lifts, background brightens subtly
          "focus:outline-none focus:ring-0 focus:border-white/30 focus:bg-white/[0.08]",
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
