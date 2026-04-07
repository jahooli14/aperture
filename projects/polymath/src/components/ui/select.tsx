import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            "flex h-10 w-full rounded-lg bg-brand-surface border-2 px-3 py-2 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-brand-primary/50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer transition-all",
            className
          )}
          style={{
            borderColor: 'rgba(var(--brand-primary-rgb), 0.2)'
          }}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--brand-text-muted)] pointer-events-none" />
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select }
