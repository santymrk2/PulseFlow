import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"
import { cn } from "cn"

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-xs leading-none font-medium text-zinc-400 select-none",
        className
      )}
      {...props}
    />
  )
}

export { Label }
