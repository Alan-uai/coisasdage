import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9.54 16.5A6.5 6.5 0 0 1 3 12a6.5 6.5 0 0 1 6.5-4.5 4.4 4.4 0 0 1 2.7.9" />
      <path d="M14.46 7.5A6.5 6.5 0 0 1 21 12a6.5 6.5 0 0 1-6.5 4.5 4.4 4.4 0 0 0-2.7-.9" />
      <path d="m3.4 14.8.9-6.3 6.2 6.3.9-6.3" />
      <path d="m20.6 9.2-.9 6.3-6.2-6.3-.9 6.3" />
      <path d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z" />
      <path d="M12 3v18" />
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    </svg>
  );
}
