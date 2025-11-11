import React, { useEffect, useRef, useState } from 'react';

// Voxel types
const VOXEL_EMPTY = 0;
const VOXEL_WATER = 1;
const VOXEL_AIR = 2;

const BubbleSimulator = () => {
  const canvasRef = useRef(null);
  const [isRunning, setIsRunning] = useState(true);
  const [gridWidth, setGridWidth] = useState(80);
  const [gridHeight, setGridHeight] = useState(60);
  const [voxelScale, setVoxelScale] = useState(8);
  const [gravity, setGravity] = useState(0.1);
  const [convection, setConvection] = useState(0.5);
  const animationRef = useRef(null);
  const gridRef = useRef([]);
  const velocityRef = useRef([]);

  // Initialize grid and canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = gridWidth * voxelScale;
    canvas.height = gridHeight * voxelScale;

    // Initialize voxel grid
    const grid = [];
    const velocity = [];
    
    for (let y = 0; y < gridHeight; y++) {
      grid[y] = [];
      velocity[y] = [];
      for (let x = 0; x < gridWidth; x++) {
        // Bottom 70% filled with water, top 30% air
        if (y > gridHeight * 0.3) {
          grid[y][x] = VOXEL_WATER;
        } else {
          grid[y][x] = VOXEL_AIR;
        }
        velocity[y][x] = { vx: 0, vy: 0 };
      }
    }
    
    // Add an air bubble strip at the bottom (2 voxels high, spanning most of width)
    const bubbleY = gridHeight - 5;
    for (let x = 5; x < gridWidth - 5; x++) {
      for (let dy = 0; dy < 2; dy++) {
        if (bubbleY + dy < gridHeight) {
          grid[bubbleY + dy][x] = VOXEL_AIR;
        }
      }
    }
    
    gridRef.current = grid;
    velocityRef.current = velocity;
  }, [gridWidth, gridHeight, voxelScale]);

  // Main simulation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let lastTime = performance.now();

    // Helper function to check if position is within bounds
    const inBounds = (x: number, y: number) => {
      return x >= 0 && x < gridWidth && y >= 0 && y < gridHeight;
    };

    // Helper function to detect interface voxels (air-water boundary)
    const isInterface = (x: number, y: number) => {
      const grid = gridRef.current;
      const current = grid[y][x];
      
      // Check neighbors for different types
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (inBounds(nx, ny) && grid[ny][nx] !== current) {
            return true;
          }
        }
      }
      return false;
    };

    // Physics update using cellular automata approach
    const updatePhysics = () => {
      const grid = gridRef.current;
      const newGrid = grid.map(row => [...row]);
      const processed = Array(gridHeight).fill(0).map(() => Array(gridWidth).fill(false));

      // Process from bottom to top for water, top to bottom for air
      // This ensures proper settling behavior
      
      // First pass: Air bubbles rise (process top to bottom)
      for (let y = 1; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          if (processed[y][x]) continue;
          
          if (grid[y][x] === VOXEL_AIR && grid[y - 1][x] === VOXEL_WATER) {
            // Air wants to rise - swap with water above
            if (Math.random() < 0.7) {  // Probabilistic for more natural movement
              newGrid[y - 1][x] = VOXEL_AIR;
              newGrid[y][x] = VOXEL_WATER;
              processed[y][x] = true;
              processed[y - 1][x] = true;
            }
          }
        }
      }

      // Second pass: Sideways spreading (air moves horizontally through water)
      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          if (processed[y][x]) continue;
          
          if (grid[y][x] === VOXEL_AIR && y > 0) {
            // Check if air is blocked above
            const blockedAbove = y === 0 || grid[y - 1][x] === VOXEL_AIR;
            
            if (blockedAbove) {
              // Try to spread sideways
              const dirs = Math.random() < 0.5 ? [-1, 1] : [1, -1];
              for (const dir of dirs) {
                const nx = x + dir;
                if (inBounds(nx, y) && grid[y][nx] === VOXEL_WATER && !processed[y][nx]) {
                  if (Math.random() < 0.3 * convection) {
                    newGrid[y][nx] = VOXEL_AIR;
                    newGrid[y][x] = VOXEL_WATER;
                    processed[y][x] = true;
                    processed[y][nx] = true;
                    break;
                  }
                }
              }
            }
          }
        }
      }

      // Third pass: Water falls (process bottom to top)
      for (let y = gridHeight - 2; y >= 0; y--) {
        for (let x = 0; x < gridWidth; x++) {
          if (processed[y][x]) continue;
          
          if (grid[y][x] === VOXEL_WATER && grid[y + 1][x] === VOXEL_AIR) {
            // Water wants to fall - swap with air below
            if (Math.random() < 0.9) {
              newGrid[y + 1][x] = VOXEL_WATER;
              newGrid[y][x] = VOXEL_AIR;
              processed[y][x] = true;
              processed[y + 1][x] = true;
            }
          }
        }
      }

      gridRef.current = newGrid;
    };

    // Render
    const render = () => {
      const grid = gridRef.current;
      
      // Clear canvas with black
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw voxels
      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          const voxel = grid[y][x];
          
          // Both water and air are black (no fill), only interface is visible
          // Draw blue outline for interface voxels
          if (isInterface(x, y)) {
            ctx.strokeStyle = '#0088ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(x * voxelScale, y * voxelScale, voxelScale, voxelScale);
          }
        }
      }
    };

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      // Update physics once per frame
      updatePhysics();

      render();

      if (isRunning) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (isRunning) {
      lastTime = performance.now();
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, gridWidth, gridHeight, voxelScale, gravity, convection]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#1a1a1a',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", sans-serif'
    }}>
      <div style={{
        display: 'flex',
        gap: '20px',
        alignItems: 'flex-start'
      }}>
        {/* Simulation Canvas - Centered */}
        <div style={{
          border: '2px solid #333',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: '#000'
        }}>
          <canvas ref={canvasRef} />
        </div>

        {/* Controls Panel - Right Side */}
        <div style={{
          backgroundColor: '#2a2a2a',
          color: 'white',
          padding: '20px',
          borderRadius: '8px',
          width: '280px',
          border: '1px solid #444'
        }}>
          <h1 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            marginBottom: '12px',
            marginTop: 0
          }}>
            Voxel Bubble Physics
          </h1>
          <p style={{ 
            fontSize: '12px', 
            marginBottom: '20px', 
            opacity: 0.75,
            marginTop: 0
          }}>
            Air bubbles rise through water with convection currents
          </p>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              fontSize: '14px', 
              display: 'block', 
              marginBottom: '8px' 
            }}>
              Grid Width: {gridWidth}
            </label>
            <input
              type="range"
              min="40"
              max="120"
              value={gridWidth}
              onChange={(e) => setGridWidth(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <p style={{ 
              fontSize: '11px', 
              marginTop: '4px', 
              opacity: 0.75,
              marginBottom: 0
            }}>
              Number of horizontal voxels
            </p>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              fontSize: '14px', 
              display: 'block', 
              marginBottom: '8px' 
            }}>
              Grid Height: {gridHeight}
            </label>
            <input
              type="range"
              min="40"
              max="100"
              value={gridHeight}
              onChange={(e) => setGridHeight(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <p style={{ 
              fontSize: '11px', 
              marginTop: '4px', 
              opacity: 0.75,
              marginBottom: 0
            }}>
              Number of vertical voxels
            </p>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              fontSize: '14px', 
              display: 'block', 
              marginBottom: '8px' 
            }}>
              Voxel Scale: {voxelScale}px
            </label>
            <input
              type="range"
              min="4"
              max="12"
              step="1"
              value={voxelScale}
              onChange={(e) => setVoxelScale(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <p style={{ 
              fontSize: '11px', 
              marginTop: '4px', 
              opacity: 0.75,
              marginBottom: 0
            }}>
              Pixel size per voxel
            </p>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              fontSize: '14px', 
              display: 'block', 
              marginBottom: '8px' 
            }}>
              Gravity: {gravity.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={gravity}
              onChange={(e) => setGravity(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <p style={{ 
              fontSize: '11px', 
              marginTop: '4px', 
              opacity: 0.75,
              marginBottom: 0
            }}>
              Water falls, air rises
            </p>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              fontSize: '14px', 
              display: 'block', 
              marginBottom: '8px' 
            }}>
              Convection: {convection.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={convection}
              onChange={(e) => setConvection(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <p style={{ 
              fontSize: '11px', 
              marginTop: '4px', 
              opacity: 0.75,
              marginBottom: 0
            }}>
              Bubbles push water aside
            </p>
          </div>
          
          <button
            onClick={() => setIsRunning(!isRunning)}
            style={{
              padding: '10px 16px',
              backgroundColor: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              width: '100%',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0052a3'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0066cc'}
          >
            {isRunning ? 'Pause' : 'Resume'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BubbleSimulator;