# DynamicWaterSand
Sand Art picture frame simulation

## Overview

An interactive 2D dynamic liquid sand and air simulation displayed within a decorative picture frame. Watch as particles naturally separate by density, with sand settling at the bottom, water in the middle, and air bubbles rising to the top.

## Features

- **80% Water**: Blue semi-transparent liquid particles
- **15% Sand**: Three density levels with realistic color gradients
  - Heavy sand (dark brown)
  - Medium sand (sienna)
  - Light sand (golden)
- **5% Air**: White circular bubbles with surface tension
- **Flip Button**: Reverse gravity to watch particles reorganize
- **Real-time Physics**: Density-based particle sorting and movement

## How to Run

1. Open `index.html` in a web browser
2. Watch the particles settle by density
3. Click "FLIP FRAME" to invert gravity
4. Enjoy the mesmerizing sand art patterns!

## Technical Details

- Pure HTML/CSS/JavaScript (no dependencies)
- Canvas-based particle system
- 60 FPS real-time simulation
- 15,000 particles (150x100 grid)
- Grid-optimized physics engine

## Files

- `index.html` - Main HTML structure
- `styles.css` - Styling for frame and UI
- `simulation.js` - Particle physics and rendering
