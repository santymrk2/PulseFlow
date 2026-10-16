import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-8 w-full min-w-0 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[13px] text-zinc-200 transition-colors outline-none placeholder:text-zinc-600 focus-visible:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
