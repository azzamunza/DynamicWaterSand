# Build Instructions

This document explains how to rebuild the `bubbles.js` bundle if you make changes to `bubble_simulator.tsx`.

## Prerequisites

- Node.js (v14 or later)
- npm

## Building the Bundle

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the bubbles.js bundle:
   ```bash
   npm run build:bubbles
   ```

   This will:
   - Transpile `bubble_simulator.tsx` using Babel
   - Remove import statements and wrap in an IIFE
   - Export the component as `window.BubbleSimulator`
   - Output the bundle to `bubbles.js`

## Files

- **bubble_simulator.tsx** - Source React/TypeScript component
- **bubbles.js** - Transpiled browser-ready bundle (commit this)
- **build-bubbles.js** - Build script using Babel
- **package.json** - Build dependencies

## Note

The `bubbles.js` file is committed to the repository so that GitHub Pages can serve it directly without requiring a build step in CI/CD. After rebuilding, commit the updated `bubbles.js` file.
