import * as React from "react"
import { cn } from "../../lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, style, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base layout
          "flex h-11 w-full rounded-xl px-3.5 py-2 text-[15px]",
          // Reset native browser styling that causes white backgrounds on mobile
          "appearance-none",
          // Dark glass appearance — bg-white/[0.05] works correctly with appearance-none
          "bg-white/[0.05]",
          "text-[var(--brand-text-primary)]/90 placeholder:text-[var(--brand-text-primary)]/25",
          // Focus — ring via box-shadow so it doesn't conflict with inset border
          "focus:outline-none focus:bg-white/[0.08]",
          // Smooth transitions
          "transition-all duration-200",
          // File inputs
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--brand-text-primary)]/70",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-40",
          className
        )}
        style={{
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)',
          ...style,
        }}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
