import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-5xl">💔</span>
      <h1 className="font-display italic text-3xl text-pearl">Page not found</h1>
      <p className="text-mist">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-primary mt-2">Back to Home</Link>
    </div>
  );
}
