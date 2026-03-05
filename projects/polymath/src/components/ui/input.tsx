import * as React from "react"
import { cn } from "../../lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base layout
          "flex h-11 w-full rounded-xl px-3.5 py-2 text-[15px]",
          // Dark glass appearance
          "bg-white/[0.05] border border-white/10",
          "text-white/90 placeholder:text-white/25",
          // Focus — visible ring + background brightens
          "focus:outline-none focus:ring-1 focus:ring-white/40 focus:border-white/40 focus:bg-white/[0.10]",
          // Smooth transitions
          "transition-all duration-200",
          // File inputs
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white/70",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-40",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
