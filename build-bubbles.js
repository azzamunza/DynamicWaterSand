const { transformFileSync } = require('@babel/core');
const fs = require('fs');

// Read and preprocess the source to remove imports
let sourceCode = fs.readFileSync('bubble_simulator.tsx', 'utf8');

// Remove the React import line
sourceCode = sourceCode.replace(/^import\s+React,\s*\{[^}]*\}\s*from\s*['"]react['"]\s*;?\s*$/m, '');

// Transform the TSX file using Babel
const result = transformFileSync('bubble_simulator.tsx', {
  presets: [
    '@babel/preset-typescript',
    ['@babel/preset-react', { 
      runtime: 'classic',
      pragma: 'React.createElement',
      pragmaFrag: 'React.Fragment'
    }]
  ]
});

// Remove any remaining import/export statements from the transpiled code
let transpiledCode = result.code;
transpiledCode = transpiledCode.replace(/^import\s+.*?from\s*['"].*?['"]\s*;?\s*$/gm, '');
transpiledCode = transpiledCode.replace(/^export\s+default\s+(\w+)\s*;?\s*$/gm, '// $1 is defined above');

// Wrap in IIFE with window.React and expose component
const wrappedCode = `// Bubble Simulator - Transpiled from bubble_simulator.tsx
// Requires React and ReactDOM to be loaded from CDN (https://react.dev)
(function() {
  'use strict';
  
  // Use React and ReactDOM from window (loaded via CDN)
  var React = window.React;
  var ReactDOM = window.ReactDOM;
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useRef = React.useRef;
  
  // Transpiled component code
${transpiledCode}
  
  // Export to window.BubbleSimulator
  window.BubbleSimulator = BubbleSimulator;
})();
`;

// Write the output
fs.writeFileSync('bubbles.js', wrappedCode);

console.log('✓ bubbles.js built successfully');
console.log('  Component exported as window.BubbleSimulator');
