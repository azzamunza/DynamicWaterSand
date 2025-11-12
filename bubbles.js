// Bubble Simulator - Transpiled from bubble_simulator.tsx
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
  const [airPercentage, setAirPercentage] = useState(8); // Max 8% air in system
  const [surfaceTension, setSurfaceTension] = useState(0.5); // Controls bubble merging/separation
  const animationRef = useRef(null);
  const gridRef = useRef([]);
  const velocityRef = useRef([]);
  const voxelLogRef = useRef([]);

  // Initialize grid and canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = gridWidth * voxelScale;
    canvas.height = gridHeight * voxelScale;

    // Initialize voxel grid - fill with water first, then add air at bottom
    const grid = [];
    const velocity = [];

    // First, fill everything with water
    for (let y = 0; y < gridHeight; y++) {
      grid[y] = [];
      velocity[y] = [];
      for (let x = 0; x < gridWidth; x++) {
        grid[y][x] = VOXEL_WATER;
        velocity[y][x] = {
          vx: 0,
          vy: 0
        };
      }
    }

    // Calculate total voxels and desired air voxels based on air percentage
    const totalVoxels = gridWidth * gridHeight;
    const targetAirVoxels = Math.round(totalVoxels * (airPercentage / 100));

    // Spawn air bubbles at the bottom in a single initialization
    // Use bottom rows for air placement to simulate bubbles at source
    let airVoxelsPlaced = 0;
    const bottomRows = Math.min(5, gridHeight); // Use bottom 5 rows max

    // Create a list of all available positions in bottom rows
    const availablePositions = [];
    for (let y = gridHeight - bottomRows; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        availablePositions.push({
          x,
          y
        });
      }
    }

    // Shuffle the positions for random distribution
    for (let i = availablePositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availablePositions[i], availablePositions[j]] = [availablePositions[j], availablePositions[i]];
    }

    // Place exact number of air voxels
    for (let i = 0; i < Math.min(targetAirVoxels, availablePositions.length); i++) {
      const pos = availablePositions[i];
      grid[pos.y][pos.x] = VOXEL_AIR;
      airVoxelsPlaced++;
    }
    gridRef.current = grid;
    velocityRef.current = velocity;
    voxelLogRef.current = []; // Clear log on reset

    console.log(`Initialized grid: ${totalVoxels} total voxels, ${airVoxelsPlaced} air voxels (${(airVoxelsPlaced / totalVoxels * 100).toFixed(2)}%)`);
  }, [gridWidth, gridHeight, voxelScale, airPercentage]);

  // Main simulation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let lastTime = performance.now();

    // Helper function to check if position is within bounds
    const inBounds = (x, y) => {
      return x >= 0 && x < gridWidth && y >= 0 && y < gridHeight;
    };

    // Helper function to detect interface voxels (air-water boundary)
    const isInterface = (x, y) => {
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
    const updatePhysics = frameCount => {
      const grid = gridRef.current;
      const newGrid = grid.map(row => [...row]);
      const processed = Array(gridHeight).fill(0).map(() => Array(gridWidth).fill(false));

      // CLOSED SYSTEM: No air spawning during simulation
      // Air is only initialized once at grid creation

      // Process from bottom to top for water, top to bottom for air
      // This ensures proper settling behavior

      // First pass: Air bubbles rise (process top to bottom)
      for (let y = 1; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          if (processed[y][x]) continue;
          if (grid[y][x] === VOXEL_AIR && grid[y - 1][x] === VOXEL_WATER) {
            // Air wants to rise - swap with water above
            if (Math.random() < 0.7) {
              // Probabilistic for more natural movement
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

      // VALIDATION: Check if voxel counts remain constant (closed system)
      // Log any discrepancies for debugging
      // Skip first 120 frames to let system stabilize
      if (frameCount > 120 && frameCount % 60 === 0) {
        // Check every 60 frames (~1 second)
        let airCount = 0;
        let waterCount = 0;
        for (let y = 0; y < gridHeight; y++) {
          for (let x = 0; x < gridWidth; x++) {
            if (newGrid[y][x] === VOXEL_AIR) airCount++;else if (newGrid[y][x] === VOXEL_WATER) waterCount++;
          }
        }
        const totalVoxels = gridWidth * gridHeight;
        const currentAirPercent = airCount / totalVoxels * 100;
        const expectedAirPercent = airPercentage;
        const tolerance = 0.1; // 0.1% tolerance for closed system

        // Log if percentages drift beyond tolerance
        if (Math.abs(currentAirPercent - expectedAirPercent) > tolerance) {
          const logEntry = {
            frame: frameCount,
            airCount,
            waterCount,
            airPercent: currentAirPercent
          };
          voxelLogRef.current.push(logEntry);
          console.warn(`Frame ${frameCount}: Voxel count drift detected! Air: ${airCount} (${currentAirPercent.toFixed(2)}%), Expected: ${expectedAirPercent}%`);
        }
      }
    };

    // Find all connected components (bubbles) using flood fill
    const findBubbles = () => {
      const grid = gridRef.current;
      const visited = Array(gridHeight).fill(0).map(() => Array(gridWidth).fill(false));
      const bubbles = [];
      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          if (grid[y][x] === VOXEL_AIR && !visited[y][x]) {
            // Start a new bubble with flood fill
            const bubble = [];
            const queue = [{
              x,
              y
            }];
            visited[y][x] = true;
            while (queue.length > 0) {
              const pos = queue.shift();
              bubble.push(pos);

              // Check 4-connected neighbors
              const neighbors = [{
                x: pos.x - 1,
                y: pos.y
              }, {
                x: pos.x + 1,
                y: pos.y
              }, {
                x: pos.x,
                y: pos.y - 1
              }, {
                x: pos.x,
                y: pos.y + 1
              }];
              for (const neighbor of neighbors) {
                if (inBounds(neighbor.x, neighbor.y) && !visited[neighbor.y][neighbor.x] && grid[neighbor.y][neighbor.x] === VOXEL_AIR) {
                  visited[neighbor.y][neighbor.x] = true;
                  queue.push(neighbor);
                }
              }
            }
            bubbles.push(bubble);
          }
        }
      }
      return bubbles;
    };

    // Moore-Neighbor tracing algorithm to extract bubble boundary
    // Traces the outer edge of a connected component of air voxels
    const traceBubbleContour = bubble => {
      if (bubble.length === 0) return [];
      const grid = gridRef.current;
      const bubbleSet = new Set(bubble.map(p => `${p.x},${p.y}`));

      // Find a starting point (topmost, then leftmost air voxel at boundary)
      let start = bubble[0];
      for (const pos of bubble) {
        // Check if this is a boundary voxel (has water neighbor)
        let isBoundary = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = pos.x + dx;
            const ny = pos.y + dy;
            if (inBounds(nx, ny) && grid[ny][nx] === VOXEL_WATER) {
              isBoundary = true;
              break;
            }
          }
          if (isBoundary) break;
        }
        if (isBoundary && (pos.y < start.y || pos.y === start.y && pos.x < start.x)) {
          start = pos;
        }
      }

      // Moore neighborhood (8-connected, clockwise from top)
      const directions = [{
        dx: 0,
        dy: -1
      },
      // N
      {
        dx: 1,
        dy: -1
      },
      // NE
      {
        dx: 1,
        dy: 0
      },
      // E
      {
        dx: 1,
        dy: 1
      },
      // SE
      {
        dx: 0,
        dy: 1
      },
      // S
      {
        dx: -1,
        dy: 1
      },
      // SW
      {
        dx: -1,
        dy: 0
      },
      // W
      {
        dx: -1,
        dy: -1
      } // NW
      ];
      const contour = [];
      let current = start;
      let dirIdx = 6; // Start looking west (since we want to go counter-clockwise around air)
      const maxSteps = bubble.length * 4; // Prevent infinite loops
      let steps = 0;
      do {
        contour.push({
          x: current.x,
          y: current.y
        });

        // Look for next boundary pixel
        let found = false;
        for (let i = 0; i < 8; i++) {
          const checkIdx = (dirIdx + i) % 8;
          const dir = directions[checkIdx];
          const nx = current.x + dir.dx;
          const ny = current.y + dir.dy;
          if (inBounds(nx, ny) && bubbleSet.has(`${nx},${ny}`)) {
            current = {
              x: nx,
              y: ny
            };
            // Turn left (counter-clockwise) to stay along the edge
            dirIdx = (checkIdx + 6) % 8;
            found = true;
            break;
          }
        }
        if (!found) break;
        steps++;
      } while ((current.x !== start.x || current.y !== start.y) && steps < maxSteps);
      return contour;
    };

    // Chaikin's corner cutting algorithm for path smoothing
    // Applies multiple iterations to create smooth curves (surface tension simulation)
    const smoothPath = (path, iterations = 2) => {
      if (path.length < 3) return path;
      let smoothed = [...path];
      for (let iter = 0; iter < iterations; iter++) {
        const newPath = [];
        for (let i = 0; i < smoothed.length; i++) {
          const p1 = smoothed[i];
          const p2 = smoothed[(i + 1) % smoothed.length];

          // Cut corners: place points at 1/4 and 3/4 along each segment
          const q = {
            x: 0.75 * p1.x + 0.25 * p2.x,
            y: 0.75 * p1.y + 0.25 * p2.y
          };
          const r = {
            x: 0.25 * p1.x + 0.75 * p2.x,
            y: 0.25 * p1.y + 0.75 * p2.y
          };
          newPath.push(q);
          newPath.push(r);
        }
        smoothed = newPath;
      }
      return smoothed;
    };

    // Render
    const render = () => {
      const grid = gridRef.current;

      // Clear canvas with black
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw dots for each voxel type
      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          const voxel = grid[y][x];
          const centerX = (x + 0.5) * voxelScale;
          const centerY = (y + 0.5) * voxelScale;
          const dotRadius = Math.max(1, voxelScale * 0.15);
          ctx.beginPath();
          ctx.arc(centerX, centerY, dotRadius, 0, Math.PI * 2);
          if (voxel === VOXEL_WATER) {
            // Dark blue dot for water
            ctx.fillStyle = '#0044aa';
          } else if (voxel === VOXEL_AIR) {
            // White dot for air
            ctx.fillStyle = '#ffffff';
          }
          ctx.fill();
        }
      }

      // Find all bubbles (connected air voxel groups)
      const bubbles = findBubbles();

      // Draw smooth white outline around each bubble
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const bubble of bubbles) {
        if (bubble.length < 3) continue; // Skip very small bubbles

        // Extract bubble boundary using Moore-Neighbor tracing
        const contour = traceBubbleContour(bubble);
        if (contour.length < 3) continue;

        // Apply Chaikin's smoothing algorithm for surface tension effect
        // Surface tension slider controls smoothing iterations (0.0-1.0 -> 0-3 iterations)
        const smoothingIterations = Math.round(surfaceTension * 3);
        const smoothedContour = smoothPath(contour, smoothingIterations);

        // Draw the smoothed outline
        if (smoothedContour.length > 0) {
          ctx.beginPath();
          const firstPoint = smoothedContour[0];
          ctx.moveTo((firstPoint.x + 0.5) * voxelScale, (firstPoint.y + 0.5) * voxelScale);
          for (let i = 1; i < smoothedContour.length; i++) {
            const point = smoothedContour[i];
            ctx.lineTo((point.x + 0.5) * voxelScale, (point.y + 0.5) * voxelScale);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
    };
    let frameCount = 0;
    const animate = currentTime => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      // Update physics once per frame with frame counter
      updatePhysics(frameCount);
      frameCount++;
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
  }, [isRunning, gridWidth, gridHeight, voxelScale, gravity, convection, surfaceTension, airPercentage]);

  // Function to save voxel drift log to a file
  const saveVoxelLog = () => {
    if (voxelLogRef.current.length === 0) {
      alert('No voxel drift detected. System is stable!');
      return;
    }
    const logContent = JSON.stringify(voxelLogRef.current, null, 2);
    const blob = new Blob([logContent], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voxel-drift-log-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert(`Log saved with ${voxelLogRef.current.length} drift events`);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#1a1a1a',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", sans-serif'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '20px',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      border: '2px solid #333',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: '#000',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: '640px',
      minHeight: '480px'
    }
  }, /*#__PURE__*/React.createElement("canvas", {
    ref: canvasRef
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      backgroundColor: '#2a2a2a',
      color: 'white',
      padding: '20px',
      borderRadius: '8px',
      width: '280px',
      border: '1px solid #444'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: '24px',
      fontWeight: 'bold',
      marginBottom: '12px',
      marginTop: 0
    }
  }, "Voxel Bubble Physics"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '12px',
      marginBottom: '20px',
      opacity: 0.75,
      marginTop: 0
    }
  }, "Air bubbles rise through water with convection currents"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '16px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: '14px',
      display: 'block',
      marginBottom: '8px'
    }
  }, "Grid Width: ", gridWidth), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "40",
    max: "120",
    value: gridWidth,
    onChange: e => setGridWidth(Number(e.target.value)),
    style: {
      width: '100%'
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '11px',
      marginTop: '4px',
      opacity: 0.75,
      marginBottom: 0
    }
  }, "Number of horizontal voxels")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '16px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: '14px',
      display: 'block',
      marginBottom: '8px'
    }
  }, "Grid Height: ", gridHeight), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "40",
    max: "100",
    value: gridHeight,
    onChange: e => setGridHeight(Number(e.target.value)),
    style: {
      width: '100%'
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '11px',
      marginTop: '4px',
      opacity: 0.75,
      marginBottom: 0
    }
  }, "Number of vertical voxels")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '16px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: '14px',
      display: 'block',
      marginBottom: '8px'
    }
  }, "Voxel Scale: ", voxelScale, "px"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "4",
    max: "12",
    step: "1",
    value: voxelScale,
    onChange: e => setVoxelScale(Number(e.target.value)),
    style: {
      width: '100%'
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '11px',
      marginTop: '4px',
      opacity: 0.75,
      marginBottom: 0
    }
  }, "Pixel size per voxel")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '16px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: '14px',
      display: 'block',
      marginBottom: '8px'
    }
  }, "Air Percentage: ", airPercentage.toFixed(1), "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "8",
    step: "0.5",
    value: airPercentage,
    onChange: e => setAirPercentage(Number(e.target.value)),
    style: {
      width: '100%'
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '11px',
      marginTop: '4px',
      opacity: 0.75,
      marginBottom: 0
    }
  }, "Amount of air in closed system (max 8%)")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '16px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: '14px',
      display: 'block',
      marginBottom: '8px'
    }
  }, "Surface Tension: ", surfaceTension.toFixed(2)), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "1",
    step: "0.1",
    value: surfaceTension,
    onChange: e => setSurfaceTension(Number(e.target.value)),
    style: {
      width: '100%'
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '11px',
      marginTop: '4px',
      opacity: 0.75,
      marginBottom: 0
    }
  }, "Bubble outline smoothness (0=sharp, 1=smooth)")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '16px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: '14px',
      display: 'block',
      marginBottom: '8px'
    }
  }, "Gravity: ", gravity.toFixed(2)), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "0.5",
    step: "0.01",
    value: gravity,
    onChange: e => setGravity(Number(e.target.value)),
    style: {
      width: '100%'
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '11px',
      marginTop: '4px',
      opacity: 0.75,
      marginBottom: 0
    }
  }, "Water falls, air rises")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '16px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: '14px',
      display: 'block',
      marginBottom: '8px'
    }
  }, "Convection: ", convection.toFixed(2)), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "1",
    step: "0.05",
    value: convection,
    onChange: e => setConvection(Number(e.target.value)),
    style: {
      width: '100%'
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '11px',
      marginTop: '4px',
      opacity: 0.75,
      marginBottom: 0
    }
  }, "Bubbles push water aside")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setIsRunning(!isRunning),
    style: {
      padding: '10px 16px',
      backgroundColor: '#0066cc',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      width: '100%',
      fontSize: '14px',
      fontWeight: '600',
      transition: 'background-color 0.2s',
      marginBottom: '8px'
    },
    onMouseOver: e => e.currentTarget.style.backgroundColor = '#0052a3',
    onMouseOut: e => e.currentTarget.style.backgroundColor = '#0066cc'
  }, isRunning ? 'Pause' : 'Resume'), /*#__PURE__*/React.createElement("button", {
    onClick: saveVoxelLog,
    style: {
      padding: '8px 12px',
      backgroundColor: '#666',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      width: '100%',
      fontSize: '12px',
      fontWeight: '500',
      transition: 'background-color 0.2s'
    },
    onMouseOver: e => e.currentTarget.style.backgroundColor = '#555',
    onMouseOut: e => e.currentTarget.style.backgroundColor = '#666'
  }, "Save Voxel Drift Log"))));
};
// BubbleSimulator is defined above
  
  // Export to window.BubbleSimulator
  window.BubbleSimulator = BubbleSimulator;
})();
