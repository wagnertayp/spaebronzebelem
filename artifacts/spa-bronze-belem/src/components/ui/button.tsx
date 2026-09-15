import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-[14px] font-bold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] hover:-translate-y-[2px]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-button hover:shadow-lg hover:bg-primary-dark",
        destructive: "bg-error text-white hover:bg-error/90 shadow-sm",
        outline: "border-2 border-border bg-transparent hover:border-primary/30 hover:bg-primary-soft hover:text-primary text-text-secondary",
        secondary: "bg-surface-soft text-text-primary hover:bg-black/5 dark:hover:bg-white/10",
        ghost: "hover:bg-surface-soft hover:text-text-primary text-text-secondary rounded-lg",
        link: "text-primary underline-offset-4 hover:underline",
        accent: "bg-accent text-accent-foreground shadow-button-accent hover:shadow-lg hover:bg-accent/90",
      },
      size: {
        default: "h-12 px-6",
        sm: "h-9 px-4 text-[13px]",
        lg: "h-14 px-8 text-[15px]",
        icon: "h-12 w-12",
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