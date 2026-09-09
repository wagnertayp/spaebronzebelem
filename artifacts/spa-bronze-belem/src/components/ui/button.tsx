import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[12px] text-[13px] font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] hover:-translate-y-[1px]",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-br from-primary to-primary-dark text-primary-foreground shadow-button hover:shadow-lg",
        destructive:
          "bg-error text-white hover:bg-error/90 shadow-sm",
        outline:
          "border border-border bg-transparent hover:bg-surface-soft hover:text-text-primary text-text-secondary",
        secondary:
          "bg-surface-soft text-text-primary hover:bg-black/5 dark:hover:bg-white/10",
        ghost: "hover:bg-surface-soft hover:text-text-primary text-text-secondary",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[36px] px-[16px]",
        sm: "h-[32px] px-[12px] text-[12px] rounded-[10px]",
        lg: "h-[42px] px-[20px] rounded-[14px] text-[14px]",
        icon: "h-[36px] w-[36px] rounded-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
