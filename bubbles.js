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

// SPH (Smoothed Particle Hydrodynamics) Constants
const SPH_PARAMS = {
  // Kernel smoothing length (interaction radius)
  H: 3.0,
  // Rest density for water
  REST_DENSITY_WATER: 1000.0,
  // Rest density for air (much lighter)
  REST_DENSITY_AIR: 1.2,
  // Gas stiffness constant for pressure calculation
  GAS_STIFFNESS: 1000.0,
  // Viscosity coefficient
  VISCOSITY_WATER: 0.5,
  VISCOSITY_AIR: 0.01,
  // Surface tension coefficient
  SURFACE_TENSION_COEFF: 0.1,
  // Pressure exponent in Tait equation
  GAMMA: 7.0,
  // Mass per particle
  PARTICLE_MASS: 1.0
};

// SPH Kernel Functions
// Poly6 kernel for density and pressure
const poly6Kernel = (r, h) => {
  if (r >= h) return 0;
  const h2 = h * h;
  const h9 = h2 * h2 * h2 * h2 * h;
  const factor = 315.0 / (64.0 * Math.PI * h9);
  const diff = h2 - r * r;
  return factor * diff * diff * diff;
};

// Gradient of Spiky kernel for pressure forces
const spikyKernelGradient = (dx, dy, r, h) => {
  if (r >= h || r < 0.0001) return {
    x: 0,
    y: 0
  };
  const h6 = h * h * h * h * h * h;
  const factor = -45.0 / (Math.PI * h6);
  const diff = h - r;
  const gradMag = factor * diff * diff / r;
  return {
    x: gradMag * dx,
    y: gradMag * dy
  };
};

// Laplacian of viscosity kernel for viscosity forces
const viscosityKernelLaplacian = (r, h) => {
  if (r >= h) return 0;
  const h6 = h * h * h * h * h * h;
  const factor = 45.0 / (Math.PI * h6);
  return factor * (h - r);
};
const BubbleSimulator = () => {
  const canvasRef = useRef(null);
  const [isRunning, setIsRunning] = useState(true);
  const [gridWidth, setGridWidth] = useState(80);
  const [gridHeight, setGridHeight] = useState(60);
  const [voxelScale, setVoxelScale] = useState(8);
  const [gravity, setGravity] = useState(0.1);
  const [convection, setConvection] = useState(0.5);
  const [airPercentage, setAirPercentage] = useState(8); // Default 8% air in system
  const [surfaceTension, setSurfaceTension] = useState(0.5); // Controls bubble merging/separation
  const [restartKey, setRestartKey] = useState(0); // Used to trigger grid re-initialization
  const animationRef = useRef(null);
  const gridRef = useRef([]);
  const velocityRef = useRef([]);
  const forcesRef = useRef([]); // Track forces for each voxel
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
    const forces = [];
    for (let y = 0; y < gridHeight; y++) {
      grid[y] = [];
      velocity[y] = [];
      forces[y] = [];
      for (let x = 0; x < gridWidth; x++) {
        grid[y][x] = VOXEL_WATER;
        velocity[y][x] = {
          vx: 0,
          vy: 0
        };
        forces[y][x] = {
          fx: 0,
          fy: 0
        };
      }
    }

    // Calculate total voxels and desired air voxels based on air percentage
    const totalVoxels = gridWidth * gridHeight;
    const targetAirVoxels = Math.max(3, Math.round(totalVoxels * (airPercentage / 100))); // Minimum 3 voxels

    // Create a single connected bubble at the bottom center
    // Start from center bottom and grow outward to ensure connectivity
    let airVoxelsPlaced = 0;

    // Start position: center of bottom row
    const startX = Math.floor(gridWidth / 2);
    const startY = gridHeight - 1;

    // Use BFS to grow a connected bubble
    const toPlace = [{
      x: startX,
      y: startY
    }];
    const placed = new Set();
    placed.add(`${startX},${startY}`);
    while (airVoxelsPlaced < targetAirVoxels && toPlace.length > 0) {
      // Place current voxel
      const pos = toPlace.shift();
      grid[pos.y][pos.x] = VOXEL_AIR;
      airVoxelsPlaced++;

      // If we need more voxels, add adjacent positions to queue
      if (airVoxelsPlaced < targetAirVoxels) {
        // Check 4-connected neighbors in random order
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

        // Shuffle neighbors for random growth pattern
        for (let i = neighbors.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
        }
        for (const neighbor of neighbors) {
          const key = `${neighbor.x},${neighbor.y}`;
          if (neighbor.x >= 0 && neighbor.x < gridWidth && neighbor.y >= 0 && neighbor.y < gridHeight && !placed.has(key)) {
            placed.add(key);
            toPlace.push(neighbor);
          }
        }
      }
    }
    gridRef.current = grid;
    velocityRef.current = velocity;
    forcesRef.current = forces;
    voxelLogRef.current = []; // Clear log on reset

    console.log(`Initialized grid: ${totalVoxels} total voxels, ${airVoxelsPlaced} air voxels (${(airVoxelsPlaced / totalVoxels * 100).toFixed(2)}%)`);
  }, [gridWidth, gridHeight, voxelScale, airPercentage, restartKey]);

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

    // Physics update using SPH-based fluid dynamics with cellular automata
    const updatePhysics = frameCount => {
      const grid = gridRef.current;
      const velocity = velocityRef.current;
      const forces = forcesRef.current;
      const newGrid = grid.map(row => [...row]);
      const newVelocity = velocity.map(row => row.map(v => ({
        ...v
      })));
      const newForces = forces.map(row => row.map(f => ({
        ...f
      })));
      const processed = Array(gridHeight).fill(0).map(() => Array(gridWidth).fill(false));

      // CLOSED SYSTEM: No air spawning during simulation
      // Air is only initialized once at grid creation

      // SPH-based fluid dynamics implementation
      // Calculate density, pressure, and forces for each voxel

      const density = Array(gridHeight).fill(0).map(() => Array(gridWidth).fill(0));
      const pressure = Array(gridHeight).fill(0).map(() => Array(gridWidth).fill(0));

      // Detect bubble components for cohesion force calculation
      const bubbles = findBubbles();
      const bubbleId = Array(gridHeight).fill(0).map(() => Array(gridWidth).fill(-1));

      // Map each air voxel to its bubble ID
      for (let i = 0; i < bubbles.length; i++) {
        for (const pos of bubbles[i]) {
          bubbleId[pos.y][pos.x] = i;
        }
      }

      // First pass: Calculate density for each particle using SPH kernel
      const searchRadius = Math.ceil(SPH_PARAMS.H);
      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          if (grid[y][x] === VOXEL_EMPTY) continue;
          let densitySum = 0;

          // Search in kernel radius
          for (let ny = Math.max(0, y - searchRadius); ny <= Math.min(gridHeight - 1, y + searchRadius); ny++) {
            for (let nx = Math.max(0, x - searchRadius); nx <= Math.min(gridWidth - 1, x + searchRadius); nx++) {
              if (grid[ny][nx] === VOXEL_EMPTY) continue;
              const dx = x - nx;
              const dy = y - ny;
              const r = Math.sqrt(dx * dx + dy * dy);
              if (r < SPH_PARAMS.H) {
                densitySum += SPH_PARAMS.PARTICLE_MASS * poly6Kernel(r, SPH_PARAMS.H);
              }
            }
          }
          density[y][x] = Math.max(densitySum, 0.01); // Prevent zero density
        }
      }

      // Second pass: Calculate pressure using Tait equation of state
      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          if (grid[y][x] === VOXEL_EMPTY) continue;
          const restDensity = grid[y][x] === VOXEL_AIR ? SPH_PARAMS.REST_DENSITY_AIR : SPH_PARAMS.REST_DENSITY_WATER;

          // Tait equation: p = k * ((ρ/ρ0)^γ - 1)
          const densityRatio = density[y][x] / restDensity;
          pressure[y][x] = SPH_PARAMS.GAS_STIFFNESS * (Math.pow(densityRatio, SPH_PARAMS.GAMMA) - 1);
        }
      }

      // Third pass: Apply SPH forces (pressure, viscosity, surface tension, cohesion, gravity)
      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          if (grid[y][x] === VOXEL_EMPTY) continue;
          let pressureForceX = 0;
          let pressureForceY = 0;
          let viscosityForceX = 0;
          let viscosityForceY = 0;
          let surfaceTensionForceX = 0;
          let surfaceTensionForceY = 0;
          let cohesionForceX = 0;
          let cohesionForceY = 0;
          let colorFieldGradientX = 0;
          let colorFieldGradientY = 0;
          let colorFieldLaplacian = 0;
          const currentType = grid[y][x];
          const currentViscosity = currentType === VOXEL_AIR ? SPH_PARAMS.VISCOSITY_AIR : SPH_PARAMS.VISCOSITY_WATER;

          // Search neighbors for force calculations
          for (let ny = Math.max(0, y - searchRadius); ny <= Math.min(gridHeight - 1, y + searchRadius); ny++) {
            for (let nx = Math.max(0, x - searchRadius); nx <= Math.min(gridWidth - 1, x + searchRadius); nx++) {
              if (nx === x && ny === y) continue;
              if (grid[ny][nx] === VOXEL_EMPTY) continue;
              const dx = x - nx;
              const dy = y - ny;
              const r = Math.sqrt(dx * dx + dy * dy);
              if (r >= SPH_PARAMS.H || r < 0.0001) continue;
              const neighborType = grid[ny][nx];

              // Pressure force (using symmetric pressure gradient)
              const pressureGrad = spikyKernelGradient(dx, dy, r, SPH_PARAMS.H);
              const avgPressure = (pressure[y][x] + pressure[ny][nx]) / 2.0;
              const pressureTerm = -SPH_PARAMS.PARTICLE_MASS * avgPressure / Math.max(density[ny][nx], 0.01);
              pressureForceX += pressureTerm * pressureGrad.x;
              pressureForceY += pressureTerm * pressureGrad.y;

              // Viscosity force
              const neighborViscosity = neighborType === VOXEL_AIR ? SPH_PARAMS.VISCOSITY_AIR : SPH_PARAMS.VISCOSITY_WATER;
              const avgViscosity = (currentViscosity + neighborViscosity) / 2.0;
              const velocityDiffX = velocity[ny][nx].vx - velocity[y][x].vx;
              const velocityDiffY = velocity[ny][nx].vy - velocity[y][x].vy;
              const viscosityLaplacian = viscosityKernelLaplacian(r, SPH_PARAMS.H);
              const viscosityTerm = avgViscosity * SPH_PARAMS.PARTICLE_MASS * viscosityLaplacian / Math.max(density[ny][nx], 0.01);
              viscosityForceX += viscosityTerm * velocityDiffX;
              viscosityForceY += viscosityTerm * velocityDiffY;

              // Surface tension using color field method (at air-water interface)
              if (currentType !== neighborType) {
                const colorValue = neighborType === VOXEL_AIR ? 1.0 : 0.0;
                const kernelGrad = spikyKernelGradient(dx, dy, r, SPH_PARAMS.H);
                colorFieldGradientX += colorValue * SPH_PARAMS.PARTICLE_MASS * kernelGrad.x / Math.max(density[ny][nx], 0.01);
                colorFieldGradientY += colorValue * SPH_PARAMS.PARTICLE_MASS * kernelGrad.y / Math.max(density[ny][nx], 0.01);
                colorFieldLaplacian += colorValue * SPH_PARAMS.PARTICLE_MASS * viscosityKernelLaplacian(r, SPH_PARAMS.H) / Math.max(density[ny][nx], 0.01);
              }

              // COHESION FORCE: Between air voxels in the same bubble
              // This keeps bubble clusters together, scaled by surface tension
              if (currentType === VOXEL_AIR && neighborType === VOXEL_AIR) {
                const currentBubbleId = bubbleId[y][x];
                const neighborBubbleId = bubbleId[ny][nx];

                // Only apply cohesion within the same bubble component
                if (currentBubbleId === neighborBubbleId && currentBubbleId >= 0) {
                  // Cohesion pulls air voxels toward each other
                  // Strength increases dramatically with surface tension
                  const cohesionStrength = surfaceTension * surfaceTension * 100.0;

                  // Attractive force toward neighbor (opposite direction from displacement)
                  const attractionX = -dx / r; // Normalized direction toward neighbor
                  const attractionY = -dy / r;

                  // Kernel function provides distance-based weighting
                  const kernelWeight = poly6Kernel(r, SPH_PARAMS.H);
                  cohesionForceX += cohesionStrength * kernelWeight * attractionX;
                  cohesionForceY += cohesionStrength * kernelWeight * attractionY;
                }
              }
            }
          }

          // Apply surface tension force at interfaces
          const colorFieldGradientMag = Math.sqrt(colorFieldGradientX * colorFieldGradientX + colorFieldGradientY * colorFieldGradientY);
          if (colorFieldGradientMag > 0.01) {
            const normalX = colorFieldGradientX / colorFieldGradientMag;
            const normalY = colorFieldGradientY / colorFieldGradientMag;
            surfaceTensionForceX = -surfaceTension * SPH_PARAMS.SURFACE_TENSION_COEFF * colorFieldLaplacian * normalX;
            surfaceTensionForceY = -surfaceTension * SPH_PARAMS.SURFACE_TENSION_COEFF * colorFieldLaplacian * normalY;
          }

          // Apply gravity (buoyancy for air, weight for water)
          const gravityForce = currentType === VOXEL_AIR ? -gravity * 2.0 : gravity * 0.5;

          // Combine all forces and update velocity
          const totalForceX = pressureForceX + viscosityForceX + surfaceTensionForceX + cohesionForceX;
          const totalForceY = pressureForceY + viscosityForceY + surfaceTensionForceY + cohesionForceY + gravityForce;

          // Store forces for visualization (especially for water voxels)
          newForces[y][x].fx = totalForceX;
          newForces[y][x].fy = totalForceY;

          // Scale forces for stability
          const forceScale = 0.01;
          newVelocity[y][x].vx += totalForceX * forceScale;
          newVelocity[y][x].vy += totalForceY * forceScale;

          // WATER DISPLACEMENT by rising air bubbles
          // When air rises, it pushes adjacent water downward and sideways
          if (currentType === VOXEL_AIR && gravityForce < 0) {
            // Air is rising, apply drag force to adjacent water
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const wx = x + dx;
                const wy = y + dy;
                if (inBounds(wx, wy) && grid[wy][wx] === VOXEL_WATER) {
                  // Push water away from rising bubble
                  const pushStrength = 0.5 * convection;
                  // Downward and sideways push
                  newVelocity[wy][wx].vx += dx * pushStrength * 0.02;
                  newVelocity[wy][wx].vy += (Math.abs(dy) > 0 ? dy : 0.5) * pushStrength * 0.02;
                }
              }
            }
          }
        }
      }

      // Fourth pass: Apply velocity damping for stability
      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          // Damping helps prevent instabilities
          newVelocity[y][x].vx *= 0.9;
          newVelocity[y][x].vy *= 0.9;
        }
      }

      // Fifth pass: Air bubbles rise (process top to bottom)
      // Enhanced with velocity-based movement decisions and connectivity preservation
      for (let y = 1; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          if (processed[y][x]) continue;
          if (grid[y][x] === VOXEL_AIR && grid[y - 1][x] === VOXEL_WATER) {
            // Air wants to rise - swap with water above
            // Use velocity magnitude to determine probability
            const upwardVelocity = -velocity[y][x].vy; // Negative vy is upward
            let riseProb = 0.6 + Math.max(0, upwardVelocity) * 0.4;

            // CONNECTIVITY CHECK: Prevent air voxels from becoming unbound
            // Count connected air neighbors before and after potential move
            let connectedNeighborsBefore = 0;
            let connectedNeighborsAfter = 0;

            // Check 4-connected neighbors at current position
            const currentNeighbors = [{
              x: x - 1,
              y: y
            }, {
              x: x + 1,
              y: y
            }, {
              x: x,
              y: y - 1
            }, {
              x: x,
              y: y + 1
            }];
            for (const n of currentNeighbors) {
              if (inBounds(n.x, n.y) && grid[n.y][n.x] === VOXEL_AIR) {
                connectedNeighborsBefore++;
              }
            }

            // Check 4-connected neighbors at new position
            const newNeighbors = [{
              x: x - 1,
              y: y - 1
            }, {
              x: x + 1,
              y: y - 1
            }, {
              x: x,
              y: y - 2
            }, {
              x: x,
              y: y
            } // y stays as water
            ];
            for (const n of newNeighbors) {
              if (inBounds(n.x, n.y) && grid[n.y][n.x] === VOXEL_AIR) {
                connectedNeighborsAfter++;
              }
            }

            // CRITICAL: Prevent moves that would leave voxel unbound (0 connections)
            // or would leave neighbors isolated
            if (connectedNeighborsAfter === 0) {
              // Would become unbound - reject this move completely
              riseProb = 0;
            } else if (connectedNeighborsBefore === 1) {
              // This voxel is a critical connection point - check if moving would isolate neighbors
              // Find the single neighbor
              let criticalNeighbor = null;
              for (const n of currentNeighbors) {
                if (inBounds(n.x, n.y) && grid[n.y][n.x] === VOXEL_AIR) {
                  criticalNeighbor = n;
                  break;
                }
              }

              // Check if that neighbor would have other connections
              if (criticalNeighbor) {
                let neighborConnections = 0;
                const neighborNeighbors = [{
                  x: criticalNeighbor.x - 1,
                  y: criticalNeighbor.y
                }, {
                  x: criticalNeighbor.x + 1,
                  y: criticalNeighbor.y
                }, {
                  x: criticalNeighbor.x,
                  y: criticalNeighbor.y - 1
                }, {
                  x: criticalNeighbor.x,
                  y: criticalNeighbor.y + 1
                }];
                for (const nn of neighborNeighbors) {
                  if (inBounds(nn.x, nn.y) && grid[nn.y][nn.x] === VOXEL_AIR && !(nn.x === x && nn.y === y)) {
                    neighborConnections++;
                  }
                }
                if (neighborConnections === 0) {
                  // Moving would isolate the neighbor - reject
                  riseProb = 0;
                }
              }
            } else if (connectedNeighborsBefore > 0 && connectedNeighborsAfter < connectedNeighborsBefore) {
              // Reduce probability to maintain connectivity
              const connectivityPenalty = (connectedNeighborsBefore - connectedNeighborsAfter) * 0.8;
              riseProb *= Math.max(0.05, 1.0 - connectivityPenalty);
            }
            if (Math.random() < Math.min(0.95, riseProb)) {
              newGrid[y - 1][x] = VOXEL_AIR;
              newGrid[y][x] = VOXEL_WATER;
              // Transfer velocity
              const tempVel = newVelocity[y][x];
              newVelocity[y][x] = newVelocity[y - 1][x];
              newVelocity[y - 1][x] = tempVel;
              processed[y][x] = true;
              processed[y - 1][x] = true;
            }
          }
        }
      }

      // Sixth pass: Sideways spreading (air moves horizontally through water)
      // Enhanced with velocity-driven horizontal movement and connectivity preservation
      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          if (processed[y][x]) continue;
          if (grid[y][x] === VOXEL_AIR && y > 0) {
            // Check if air is blocked above
            const blockedAbove = y === 0 || grid[y - 1][x] === VOXEL_AIR;
            if (blockedAbove) {
              // Try to spread sideways based on velocity
              const horizontalVel = velocity[y][x].vx;
              // Prefer direction of velocity, or random if velocity is low
              const dir = Math.abs(horizontalVel) > 0.1 ? horizontalVel > 0 ? 1 : -1 : Math.random() < 0.5 ? 1 : -1;
              const nx = x + dir;
              if (inBounds(nx, y) && grid[y][nx] === VOXEL_WATER && !processed[y][nx]) {
                let moveProb = 0.2 * (1 + Math.abs(horizontalVel) * 2);

                // CONNECTIVITY CHECK: Prevent air voxels from becoming unbound
                let connectedNeighborsBefore = 0;
                let connectedNeighborsAfter = 0;

                // Check 4-connected neighbors at current position
                const currentNeighbors = [{
                  x: x - 1,
                  y: y
                }, {
                  x: x + 1,
                  y: y
                }, {
                  x: x,
                  y: y - 1
                }, {
                  x: x,
                  y: y + 1
                }];
                for (const n of currentNeighbors) {
                  if (inBounds(n.x, n.y) && grid[n.y][n.x] === VOXEL_AIR) {
                    connectedNeighborsBefore++;
                  }
                }

                // Check 4-connected neighbors at new position
                const newNeighbors = [{
                  x: nx - 1,
                  y: y
                }, {
                  x: nx + 1,
                  y: y
                }, {
                  x: nx,
                  y: y - 1
                }, {
                  x: nx,
                  y: y + 1
                }];
                for (const n of newNeighbors) {
                  if (inBounds(n.x, n.y) && grid[n.y][n.x] === VOXEL_AIR && !(n.x === x && n.y === y)) {
                    connectedNeighborsAfter++;
                  }
                }

                // CRITICAL: Prevent moves that would leave voxel unbound or isolate neighbors
                if (connectedNeighborsAfter === 0) {
                  // Would become unbound - reject this move completely
                  moveProb = 0;
                } else if (connectedNeighborsBefore === 1) {
                  // This voxel is a critical connection point - check if moving would isolate neighbors
                  let criticalNeighbor = null;
                  for (const n of currentNeighbors) {
                    if (inBounds(n.x, n.y) && grid[n.y][n.x] === VOXEL_AIR) {
                      criticalNeighbor = n;
                      break;
                    }
                  }

                  // Check if that neighbor would have other connections
                  if (criticalNeighbor) {
                    let neighborConnections = 0;
                    const neighborNeighbors = [{
                      x: criticalNeighbor.x - 1,
                      y: criticalNeighbor.y
                    }, {
                      x: criticalNeighbor.x + 1,
                      y: criticalNeighbor.y
                    }, {
                      x: criticalNeighbor.x,
                      y: criticalNeighbor.y - 1
                    }, {
                      x: criticalNeighbor.x,
                      y: criticalNeighbor.y + 1
                    }];
                    for (const nn of neighborNeighbors) {
                      if (inBounds(nn.x, nn.y) && grid[nn.y][nn.x] === VOXEL_AIR && !(nn.x === x && nn.y === y)) {
                        neighborConnections++;
                      }
                    }
                    if (neighborConnections === 0) {
                      // Moving would isolate the neighbor - reject
                      moveProb = 0;
                    }
                  }
                } else if (connectedNeighborsBefore > 0 && connectedNeighborsAfter < connectedNeighborsBefore) {
                  // Heavily penalize lateral moves that reduce connectivity
                  const connectivityPenalty = (connectedNeighborsBefore - connectedNeighborsAfter) * 0.9;
                  moveProb *= Math.max(0.02, 1.0 - connectivityPenalty);
                }
                if (Math.random() < Math.min(0.7, moveProb)) {
                  newGrid[y][nx] = VOXEL_AIR;
                  newGrid[y][x] = VOXEL_WATER;
                  const tempVel = newVelocity[y][x];
                  newVelocity[y][x] = newVelocity[y][nx];
                  newVelocity[y][nx] = tempVel;
                  processed[y][x] = true;
                  processed[y][nx] = true;
                }
              }
            }
          }
        }
      }

      // Seventh pass: Water falls (process bottom to top)
      // Enhanced with velocity-based movement decisions
      for (let y = gridHeight - 2; y >= 0; y--) {
        for (let x = 0; x < gridWidth; x++) {
          if (processed[y][x]) continue;
          if (grid[y][x] === VOXEL_WATER && grid[y + 1][x] === VOXEL_AIR) {
            // Water wants to fall - swap with air below
            // Use velocity magnitude to determine probability
            const downwardVelocity = velocity[y][x].vy; // Positive vy is downward
            const fallProb = 0.85 + Math.max(0, downwardVelocity) * 0.15;
            if (Math.random() < Math.min(0.98, fallProb)) {
              newGrid[y + 1][x] = VOXEL_WATER;
              newGrid[y][x] = VOXEL_AIR;
              const tempVel = newVelocity[y][x];
              newVelocity[y][x] = newVelocity[y + 1][x];
              newVelocity[y + 1][x] = tempVel;
              processed[y][x] = true;
              processed[y + 1][x] = true;
            }
          }
        }
      }
      gridRef.current = newGrid;
      velocityRef.current = newVelocity;
      forcesRef.current = newForces;

      // VALIDATION: Check if voxel counts remain constant and all air voxels are connected
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

        // CONNECTIVITY VALIDATION: Ensure all air voxels are in a single connected component
        const bubbles = findBubbles();
        if (bubbles.length > 1) {
          console.warn(`Frame ${frameCount}: Multiple bubble components detected! Count: ${bubbles.length}`);
        }
        if (bubbles.length > 0 && bubbles[0].length < 3) {
          console.warn(`Frame ${frameCount}: Bubble too small! Size: ${bubbles[0].length}`);
        }
      }
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
            // Visualize force direction using normals as RGB colors
            const forces = forcesRef.current;
            const fx = forces[y][x].fx;
            const fy = forces[y][x].fy;
            const forceMagnitude = Math.sqrt(fx * fx + fy * fy);
            if (forceMagnitude > 0.01) {
              // Normalize force vector to get direction (normal)
              const nx = fx / forceMagnitude;
              const ny = fy / forceMagnitude;

              // Map normalized force direction to RGB color
              // nx, ny range from -1 to 1, map to 0-255
              // X-direction (left-right) -> Red channel
              // Y-direction (up-down) -> Green channel
              // Add base blue to maintain water-like appearance
              const r = Math.floor((nx + 1) * 127.5); // 0-255
              const g = Math.floor((ny + 1) * 127.5); // 0-255
              const b = 170; // Base blue component

              ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            } else {
              // No significant force - default dark blue
              ctx.fillStyle = '#0044aa';
            }
          } else if (voxel === VOXEL_AIR) {
            // White dot for air
            ctx.fillStyle = '#ffffff';
          }
          ctx.fill();
        }
      }

      // Find all bubbles (connected air voxel groups)
      const bubbles = findBubbles();

      // Draw smooth white outline around each bubble with size-dependent styling
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const bubble of bubbles) {
        if (bubble.length < 3) continue; // Skip very small bubbles

        // Extract bubble boundary using Moore-Neighbor tracing
        const contour = traceBubbleContour(bubble);
        if (contour.length < 3) continue;

        // Apply Chaikin's smoothing algorithm for surface tension effect
        // Higher surface tension = more smoothing iterations and larger apparent bubble size
        const smoothingIterations = Math.round(surfaceTension * 4);
        const smoothedContour = smoothPath(contour, smoothingIterations);

        // Draw the smoothed outline with variable line width based on bubble size
        if (smoothedContour.length > 0) {
          // Bubble size affects line thickness and opacity for better visual distinction
          const bubbleArea = bubble.length;
          const lineWidth = 1.5 + Math.min(bubbleArea / 50, 2) * surfaceTension;
          const alpha = 0.7 + 0.3 * surfaceTension;
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          const firstPoint = smoothedContour[0];
          ctx.moveTo((firstPoint.x + 0.5) * voxelScale, (firstPoint.y + 0.5) * voxelScale);
          for (let i = 1; i < smoothedContour.length; i++) {
            const point = smoothedContour[i];
            ctx.lineTo((point.x + 0.5) * voxelScale, (point.y + 0.5) * voxelScale);
          }
          ctx.closePath();
          ctx.stroke();

          // For larger bubbles with high surface tension, add a subtle inner glow
          if (bubbleArea > 30 && surfaceTension > 0.6) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 * surfaceTension})`;
            ctx.lineWidth = lineWidth * 1.5;
            ctx.stroke();
          }
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
    max: "15",
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
  }, "Amount of air in closed system (0-15%)")), /*#__PURE__*/React.createElement("div", {
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
  }, "Controls bubble merging, size, and smoothness")), /*#__PURE__*/React.createElement("div", {
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
    onClick: () => {
      setRestartKey(prev => prev + 1);
      setIsRunning(true);
    },
    style: {
      padding: '10px 16px',
      backgroundColor: '#00aa44',
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
    onMouseOver: e => e.currentTarget.style.backgroundColor = '#008833',
    onMouseOut: e => e.currentTarget.style.backgroundColor = '#00aa44'
  }, "Restart"), /*#__PURE__*/React.createElement("button", {
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
