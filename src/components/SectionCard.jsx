import React from "react";

export function SectionCard({ title, kicker, children, className = "" }) {
  return (
    <section className={`panel ${className}`.trim()}>
      <div className="section-head centered">
        <div>
          <p className="section-kicker">{kicker}</p>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}
