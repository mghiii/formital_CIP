import Image from "next/image";

type FormitalLogoProps = {
  compact?: boolean;
  inverted?: boolean;
  framed?: boolean;
  showText?: boolean;
  className?: string;
};

export function FormitalLogo({ compact = false, inverted = false, framed = false, showText = true, className = "" }: FormitalLogoProps) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`} aria-label="Formital">
      <span className={`grid place-items-center ${
        framed
          ? "rounded-[10px] bg-white px-4 py-3"
          : inverted
            ? "rounded-[10px] bg-white px-3 py-2"
            : ""
      }`}>
        <Image
          src="/formital-logo-full.png"
          alt="Formital"
          width={260}
          height={96}
          className={`${compact ? "h-10 w-auto" : "h-16 w-auto"} rounded-[10px] object-contain`}
        />
      </span>
      {compact && showText ? <span className={`text-sm font-bold ${inverted ? "text-white" : "text-formital-green"}`}>Digital CIP</span> : null}
    </div>
  );
}
