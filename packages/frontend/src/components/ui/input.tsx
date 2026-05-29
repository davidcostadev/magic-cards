import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/utils/cn";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-12 w-full rounded-xl border border-input bg-background px-4 py-3 text-base ring-offset-background transition-colors file:border-0 file:bg-transparent file:text-base file:font-medium placeholder:text-muted-foreground hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
