import React from "react";
import { HandCoins, UsersRound } from "lucide-react";

export function BrandMark({ size = "md", label = "Visionaries Village Banking", showText = false, className = "" }) {
  return (
    <span className={`brand-lockup ${showText ? "with-text" : ""} ${className}`.trim()} aria-label={label}>
      <span className={`brand-mark ${size}`} aria-hidden="true">
        <UsersRound className="brand-mark-people" size={size === "lg" ? 44 : size === "sm" ? 18 : 26} />
        <HandCoins className="brand-mark-coin" size={size === "lg" ? 28 : size === "sm" ? 13 : 18} />
      </span>
      {showText ? (
        <span className="brand-wordmark">
          <strong>Visionaries</strong>
          <small>Village Banking</small>
        </span>
      ) : null}
    </span>
  );
}
