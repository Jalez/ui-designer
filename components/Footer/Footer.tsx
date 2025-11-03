/** @format */
'use client';

import { appVersion } from "@/constants";

export const Footer = () => {
  return (
    <footer
      className="text-center p-2 w-full h-fit shrink-0 pointer-events-none text-sm"
      style={{
        backgroundColor: 'hsl(var(--footer-bg))',
        color: 'hsl(var(--footer-text))',
      }}
    >
      <p className="text-sm">
        Inspired by
        <a
          href="https://cssbattle.dev/"
          target="_blank"
          rel="noreferrer"
          className="text-primary m-2 pointer-events-auto"
        >
          <strong>
          CSS Battle
          </strong>
        </a>
      </p>
    </footer>
  );
};
