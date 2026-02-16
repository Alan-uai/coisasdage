import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCloudinaryImageUrl(category: string, filename:string): string {
  const cloudName = 'dme6as4bi';
  return `https://res.cloudinary.com/${cloudName}/image/upload/v1/Home/${category}/${filename}`;
}
