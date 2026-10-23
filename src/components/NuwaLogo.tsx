import logo from "../assets/newlogo.png";

interface NuwaLogoProps {
  size?: "sm" | "md" | "lg";

  variant?: "full" | "mark" | "wordmark";

  color?: "default" | "white" | "deep";

  className?: string;
}

const logoSizes = {
  sm: { height: 32, width: 73 },
  md: { height: 40, width: 91 },
  lg: { height: 48, width: 110 },
};

export default function NuwaLogo({
  size = "md",

  className = "",
}: NuwaLogoProps) {
  return (
    <img
      src={logo}
      alt="شعار وَعي"
      className={`inline-block shrink-0 object-contain ${className}`}
      style={{ ...logoSizes[size], objectFit: "contain" }}
    />
  );
}
