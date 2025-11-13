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

## Simulations

- **Sand Art Simulation**: [index.html](https://azzamunza.github.io/DynamicWaterSand/) - Main liquid sand art simulation
- **Bubble Physics**: [bubbles.html](https://azzamunza.github.io/DynamicWaterSand/bubbles.html) - Interactive voxel-based air bubble physics simulation with:
  - **SPH-Based Fluid Dynamics**: Smoothed Particle Hydrodynamics for realistic bubble behavior
  - **Pressure Forces**: Tait equation of state for proper compressibility
  - **Viscosity Modeling**: Internal friction for smooth fluid motion
  - **Surface Tension**: Color field method at air-water interfaces
  - Smooth bubble outlines using Moore-Neighbor contour tracing
  - Path smoothing via Chaikin's algorithm
  - Dark blue dots for water, white dots for air
  - Configurable parameters: gravity, viscosity, surface tension, air percentage
- **Metaball Liquid Simulation**: [liquid.html](https://azzamunza.github.io/DynamicWaterSand/liquid.html) - WebGL-accelerated fluid simulation with:
  - **Dual Liquid System**: 90% water particles and 10% air particles
  - **SPH Physics**: Smoothed Particle Hydrodynamics with pressure, viscosity, and surface tension
  - **Interactive Surface Tension**: Adjustable sliders for water and air surface tension
  - **Mouse Attraction**: Air particles are attracted to mouse cursor with adjustable force
  - **GPU Acceleration**: Optimized rendering for real-time performance
  - **Metaball Rendering**: Smooth, blob-like liquid visualization
  - **Density-Based Behavior**: Air rises, water sinks based on relative densities
  - No collisions between particles of same type (cohesive behavior)

## Files

- `index.html` - Main HTML structure
- `styles.css` - Styling for frame and UI
- `simulation.js` - Particle physics and rendering
- `bubbles.html` - Bubble simulation page
- `bubbles.js` - Transpiled bubble simulator component
- `bubble_simulator.tsx` - React/TypeScript source for bubble simulation with SPH physics
- `liquid.html` - WebGL-accelerated metaball liquid simulation with dual liquid types
- `SPH_IMPLEMENTATION.md` - Detailed documentation of the SPH fluid dynamics implementation
