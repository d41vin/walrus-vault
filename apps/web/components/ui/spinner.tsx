import { cn } from "@/lib/utils"
import { IconLoader } from "@tabler/icons-react"

interface SpinnerProps extends React.ComponentProps<"svg"> {
  size?: "sm" | "md" | "lg" | number;
}

function Spinner({ className, size = "md", ...props }: SpinnerProps) {
  const sizeMap = {
    sm: "size-4",
    md: "size-6",
    lg: "size-8",
  };
  const sizeClass = typeof size === "string" ? sizeMap[size] || "size-6" : "";
  const sizeStyle = typeof size === "number" ? { width: size, height: size } : {};

  return (
    <IconLoader
      role="status"
      aria-label="Loading"
      className={cn("animate-spin", sizeClass, className)}
      style={sizeStyle}
      {...props}
    />
  )
}

export { Spinner }
