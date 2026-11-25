import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="bottom-center"
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--st-text,#22211f)] group-[.toaster]:text-white group-[.toaster]:border-transparent group-[.toaster]:rounded-lg group-[.toaster]:text-[13px] group-[.toaster]:shadow-[var(--st-shadow-pop)]",
          description: "group-[.toast]:text-white/70",
          actionButton:
            "group-[.toast]:bg-white group-[.toast]:text-[var(--st-text,#22211f)] group-[.toast]:rounded-md",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
