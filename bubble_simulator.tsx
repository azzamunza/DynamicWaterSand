import React, { useEffect, useRef, useState } from 'react';

const BubbleSimulator = () => {
  const canvasRef = useRef(null);
  const [isRunning, setIsRunning] = useState(true);
  const [surfaceTension, setSurfaceTension] = useState(50);
  const [voxelSize, setVoxelSize] = useState(8);
  const [waterDensity, setWaterDensity] = useState(100);
  const [airDensity, setAirDensity] = useState(10);
  const animationRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, isDown: false });
  const blobsRef = useRef([]);
  const waterVoxelsRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const handleMouseDown = (e) => {
      mouseRef.current.isDown = true;
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const handleMouseUp = () => {
      mouseRef.current.isDown = false;
    };

    const handleMouseMove = (e) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let frameCount = 0;
    let lastTime = performance.now();

    const METABALL_THRESHOLD = 1.0;
    const GRID_SIZE = voxelSize;
    const SURFACE_LAYER = 80; // Height of the surface accumulation zone

    class Blob {
      constructor(x, y, radius = null) {
        this.x = x;
        this.y = y;
        this.radius = radius || GRID_SIZE;
        this.vx = (Math.random() - 0.5) * 0.1;
        this.vy = -(Math.random() * 0.05 + 0.05);
        this.mass = this.radius * this.radius;
        this.mergeTimer = 0;
        this.atSurface = false;
        this.density = airDensity;
      }

      update(canvas, deltaTime) {
        // Check if at surface
        const distFromTop = this.y - this.radius;
        this.atSurface = distFromTop < SURFACE_LAYER;
        
        // Buoyancy based on density difference
        const densityDiff = waterDensity - this.density;
        const buoyancy = 0.0003 * densityDiff * deltaTime;
        
        if (this.atSurface) {
          // At surface: spread horizontally based on surface tension
          this.vy *= 0.85; // Strong damping
          
          // Lower surface tension = more spreading
          const spreadForce = (1.0 - surfaceTension / 100) * 0.5;
          this.vx += (Math.random() - 0.5) * spreadForce * deltaTime / 16;
          
          // Cap upward movement at surface
          if (this.y < this.radius + 5) {
            this.y = this.radius + 5;
            this.vy = Math.max(0, this.vy * 0.3);
          }
          
          // Stronger horizontal drift along surface
          this.vx *= 0.96;
        } else {
          // Rising through water: buoyancy
          this.vy -= buoyancy;
          
          this.vx *= 0.99;
          this.vy *= 0.99;
          
          // Gentle wobble
          this.vx += Math.sin(frameCount * 0.05 + this.x * 0.01) * 0.02 * deltaTime / 16;
        }
        
        // Update position with deltaTime
        this.x += this.vx * deltaTime / 16;
        this.y += this.vy * deltaTime / 16;
        
        // Boundary collisions - treat walls like glass (surface tension effect)
        const wallTension = surfaceTension / 100;
        if (this.x - this.radius < 0) {
          this.x = this.radius;
          this.vx = Math.abs(this.vx) * (0.3 + wallTension * 0.3);
        }
        if (this.x + this.radius > canvas.width) {
          this.x = canvas.width - this.radius;
          this.vx = -Math.abs(this.vx) * (0.3 + wallTension * 0.3);
        }
        if (this.y - this.radius < 0) {
          this.y = this.radius;
          this.vy = 0;
        }
        if (this.y + this.radius > canvas.height) {
          this.y = canvas.height - this.radius;
          this.vy = -Math.abs(this.vy) * 0.5;
        }

        this.mergeTimer--;
      }

      getMetaballValue(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        
        // Flatten blobs at the surface
        let effectiveRadius = this.radius;
        if (this.atSurface) {
          // Increase horizontal influence, decrease vertical
          const flattenFactor = 1.5 + (SURFACE_LAYER - (this.y - this.radius)) / SURFACE_LAYER;
          const verticalSqueeze = 0.7;
          
          const horizontalDist = dx * dx / (flattenFactor * flattenFactor);
          const verticalDist = dy * dy / (verticalSqueeze * verticalSqueeze);
          const distSq = horizontalDist + verticalDist;
          
          return (this.radius * this.radius) / (distSq + 1);
        }
        
        const distSq = dx * dx + dy * dy;
        return (effectiveRadius * effectiveRadius) / (distSq + 1);
      }

      canMerge() {
        return this.mergeTimer <= 0 && this.radius < 80;
      }

      canSplit() {
        return this.radius > GRID_SIZE * 3 && Math.random() < 0.0005;
      }
    }

    class WaterVoxel {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.density = waterDensity;
      }

      update(canvas, deltaTime) {
        // Gravity for water
        const gravity = 0.0005 * deltaTime;
        this.vy += gravity;
        
        this.vx *= 0.98;
        this.vy *= 0.98;
        
        // Update position
        this.x += this.vx * deltaTime / 16;
        this.y += this.vy * deltaTime / 16;
        
        // Boundary collisions
        if (this.x < GRID_SIZE / 2) {
          this.x = GRID_SIZE / 2;
          this.vx = Math.abs(this.vx) * 0.3;
        }
        if (this.x > canvas.width - GRID_SIZE / 2) {
          this.x = canvas.width - GRID_SIZE / 2;
          this.vx = -Math.abs(this.vx) * 0.3;
        }
        if (this.y < GRID_SIZE / 2) {
          this.y = GRID_SIZE / 2;
          this.vy = 0;
        }
        if (this.y > canvas.height - GRID_SIZE / 2) {
          this.y = canvas.height - GRID_SIZE / 2;
          this.vy = 0;
        }
      }
    }

    function getDistance(b1, b2) {
      const dx = b2.x - b1.x;
      const dy = b2.y - b1.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function mergeBlobs(b1, b2) {
      const totalMass = b1.mass + b2.mass;
      const newRadius = Math.sqrt(totalMass);
      
      const merged = new Blob(
        (b1.x * b1.mass + b2.x * b2.mass) / totalMass,
        (b1.y * b1.mass + b2.y * b2.mass) / totalMass,
        newRadius
      );
      
      merged.vx = (b1.vx * b1.mass + b2.vx * b2.mass) / totalMass;
      merged.vy = (b1.vy * b1.mass + b2.vy * b2.mass) / totalMass;
      merged.mergeTimer = 20;
      
      return merged;
    }

    function splitBlob(blob) {
      const angle = Math.random() * Math.PI * 2;
      const newRadius = blob.radius / Math.sqrt(2);
      const offset = newRadius * 1.2;
      
      const b1 = new Blob(
        blob.x + Math.cos(angle) * offset,
        blob.y + Math.sin(angle) * offset,
        newRadius
      );
      const b2 = new Blob(
        blob.x - Math.cos(angle) * offset,
        blob.y - Math.sin(angle) * offset,
        newRadius
      );
      
      b1.vx = blob.vx + Math.cos(angle) * 1.5;
      b1.vy = blob.vy + Math.sin(angle) * 1.5;
      b2.vx = blob.vx - Math.cos(angle) * 1.5;
      b2.vy = blob.vy - Math.sin(angle) * 1.5;
      
      return [b1, b2];
    }

    function applyAttraction(blobs) {
      for (let i = 0; i < blobs.length; i++) {
        for (let j = i + 1; j < blobs.length; j++) {
          const b1 = blobs[i];
          const b2 = blobs[j];
          
          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Stronger attraction at surface for spreading
          const attractionMult = (b1.atSurface && b2.atSurface) ? 2.0 : 1.0;
          const attractionRange = (b1.radius + b2.radius) * 2.5;
          
          if (dist < attractionRange && dist > 0.1) {
            const force = 0.008 * (b1.radius + b2.radius) / dist * attractionMult;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            b1.vx += fx;
            b1.vy += fy;
            b2.vx -= fx;
            b2.vy -= fy;
          }
        }
      }
    }

    function applySurfaceSpread(blobs) {
      // Blobs at surface repel each other horizontally to spread out
      const surfaceBlobs = blobs.filter(b => b.atSurface);
      
      for (let i = 0; i < surfaceBlobs.length; i++) {
        for (let j = i + 1; j < surfaceBlobs.length; j++) {
          const b1 = surfaceBlobs[i];
          const b2 = surfaceBlobs[j];
          
          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < (b1.radius + b2.radius) * 1.5 && dist > 0.1) {
            // Horizontal repulsion
            const force = 0.5 / (dist + 1);
            const fx = -(dx / dist) * force;
            
            b1.vx += fx;
            b2.vx -= fx;
          }
        }
      }
    }

    function drawMetaballs(ctx, blobs) {
      const imageData = ctx.createImageData(canvas.width, canvas.height);
      const data = imageData.data;
      
      // Fill with black background first
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 0;     // R
        data[i + 1] = 0; // G
        data[i + 2] = 0; // B
        data[i + 3] = 255; // A (fully opaque)
      }
      
      // Draw water voxels
      for (const waterVoxel of waterVoxelsRef.current) {
        const gridX = Math.floor(waterVoxel.x / GRID_SIZE) * GRID_SIZE;
        const gridY = Math.floor(waterVoxel.y / GRID_SIZE) * GRID_SIZE;
        
        for (let dy = 0; dy < GRID_SIZE; dy++) {
          for (let dx = 0; dx < GRID_SIZE; dx++) {
            const px = gridX + dx;
            const py = gridY + dy;
            if (px < canvas.width && py < canvas.height && px >= 0 && py >= 0) {
              const index = (py * canvas.width + px) * 4;
              // Dark blue water color
              data[index] = 20;     // R
              data[index + 1] = 80; // G
              data[index + 2] = 150; // B
              data[index + 3] = 255; // A (fully opaque)
            }
          }
        }
      }
      
      // Draw air bubbles
      for (let y = 0; y < canvas.height; y += GRID_SIZE) {
        for (let x = 0; x < canvas.width; x += GRID_SIZE) {
          let sum = 0;
          
          for (const blob of blobs) {
            sum += blob.getMetaballValue(x, y);
          }
          
          if (sum >= METABALL_THRESHOLD) {
            // Draw a filled square at this grid position
            for (let dy = 0; dy < GRID_SIZE; dy++) {
              for (let dx = 0; dx < GRID_SIZE; dx++) {
                const px = x + dx;
                const py = y + dy;
                if (px < canvas.width && py < canvas.height) {
                  const index = (py * canvas.width + px) * 4;
                  
                  // Calculate color intensity based on sum
                  const intensity = Math.min(1, sum / 2);
                  
                  // Light cyan/white bubble color with transparency
                  data[index] = 180 + intensity * 75;     // R
                  data[index + 1] = 230 + intensity * 25; // G
                  data[index + 2] = 255;                  // B
                  data[index + 3] = 220 + intensity * 35; // A
                }
              }
            }
          }
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      // Add surface tension shell outline
      const shellThickness = 1 + surfaceTension / 50;
      blobs.forEach(blob => {
        // Draw surface tension shell
        ctx.strokeStyle = `rgba(150, 200, 255, ${0.3 + surfaceTension / 200})`;
        ctx.lineWidth = shellThickness;
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Add highlights and glossiness
        const gradient = ctx.createRadialGradient(
          blob.x - blob.radius * 0.3,
          blob.y - blob.radius * 0.3,
          0,
          blob.x,
          blob.y,
          blob.radius
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const animate = (currentTime) => {
      // Calculate delta time for frame-rate independence
      const deltaTime = Math.min(currentTime - lastTime, 32); // Cap at ~30 FPS
      lastTime = currentTime;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Black background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Initialize blobs and water voxels on first frame
      if (frameCount === 0) {
        // Clear existing
        blobsRef.current = [];
        waterVoxelsRef.current = [];
        
        // Spawn initial air bubble - one long horizontal bubble at bottom (2 voxels high)
        const startY = canvas.height - GRID_SIZE * 3;
        for (let x = GRID_SIZE; x < canvas.width - GRID_SIZE; x += GRID_SIZE) {
          for (let row = 0; row < 2; row++) {
            const y = startY + row * GRID_SIZE;
            blobsRef.current.push(new Blob(x, y, GRID_SIZE));
          }
        }
        
        // Initialize water voxels - fill most of the canvas with water
        const waterHeightRatio = 0.7; // 70% filled with water
        const waterHeight = canvas.height * waterHeightRatio;
        for (let y = GRID_SIZE; y < waterHeight; y += GRID_SIZE) {
          for (let x = GRID_SIZE; x < canvas.width - GRID_SIZE; x += GRID_SIZE) {
            // Skip where air bubbles are
            const isAirRegion = y >= startY - GRID_SIZE && y <= startY + GRID_SIZE * 3;
            if (!isAirRegion) {
              waterVoxelsRef.current.push(new WaterVoxel(x, y));
            }
          }
        }
      }

      // Apply attraction
      applyAttraction(blobsRef.current);
      
      // Apply surface spreading
      applySurfaceSpread(blobsRef.current);

      // Update blobs
      blobsRef.current.forEach(b => b.update(canvas, deltaTime));
      
      // Update water voxels
      waterVoxelsRef.current.forEach(w => w.update(canvas, deltaTime));

      // Calculate merge difficulty based on surface tension
      // Low surface tension = easy merge/split (fluid-like)
      // High surface tension = hard merge/split (spherical/stable)
      const tensionFactor = surfaceTension / 100;
      const mergeDifficulty = 0.2 + tensionFactor * 0.6;
      const splitEasiness = 0.8 - tensionFactor * 0.6;

      // Handle merging (easier with low surface tension)
      const toRemove = new Set();
      const toAdd = [];

      for (let i = 0; i < blobsRef.current.length; i++) {
        for (let j = i + 1; j < blobsRef.current.length; j++) {
          const b1 = blobsRef.current[i];
          const b2 = blobsRef.current[j];
          
          if (toRemove.has(i) || toRemove.has(j)) continue;
          
          const dist = getDistance(b1, b2);
          const mergeDist = (b1.radius + b2.radius) * (0.6 + mergeDifficulty * 0.8);
          
          // Low surface tension = easier merge
          const baseMergeChance = (b1.atSurface && b2.atSurface) ? 0.4 : 0.2;
          const mergeChance = baseMergeChance * (1.2 - mergeDifficulty);
          
          if (dist < mergeDist && b1.canMerge() && b2.canMerge()) {
            if (Math.random() < mergeChance) {
              toAdd.push(mergeBlobs(b1, b2));
              toRemove.add(i);
              toRemove.add(j);
            }
          }
        }
      }

      // Handle splitting (easier with low surface tension)
      blobsRef.current.forEach((blob, i) => {
        if (!toRemove.has(i) && blob.canSplit()) {
          if (Math.random() < splitEasiness * 0.002) {
            const newBlobs = splitBlob(blob);
            toAdd.push(...newBlobs);
            toRemove.add(i);
          }
        }
      });

      // Remove and add blobs
      blobsRef.current = blobsRef.current.filter((_, i) => !toRemove.has(i));
      blobsRef.current.push(...toAdd);

      // Draw metaballs
      if (blobsRef.current.length > 0) {
        drawMetaballs(ctx, blobsRef.current);
      }

      frameCount++;
      
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
  }, [isRunning, voxelSize, surfaceTension, waterDensity, airDensity]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
      />
      <div className="absolute top-4 left-4 bg-black/70 text-white p-4 rounded-lg backdrop-blur-sm border border-gray-600">
        <h1 className="text-2xl font-bold mb-3">Voxel Bubble Physics</h1>
        <p className="text-xs mb-3 opacity-75">Watch air rise through water like an inverted jar</p>
        
        <div className="mb-3">
          <label className="text-sm block mb-2">
            Surface Tension: {surfaceTension}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={surfaceTension}
            onChange={(e) => setSurfaceTension(Number(e.target.value))}
            className="w-full"
          />
          <p className="text-xs mt-1 opacity-75">
            High = spherical bubbles, Low = fluid spreading
          </p>
        </div>
        
        <div className="mb-3">
          <label className="text-sm block mb-2">
            Voxel Size: {voxelSize}px
          </label>
          <input
            type="range"
            min="4"
            max="16"
            step="2"
            value={voxelSize}
            onChange={(e) => setVoxelSize(Number(e.target.value))}
            className="w-full"
          />
          <p className="text-xs mt-1 opacity-75">
            Smaller = more detail, slower performance
          </p>
        </div>
        
        <div className="mb-3">
          <label className="text-sm block mb-2">
            Water Density: {waterDensity}
          </label>
          <input
            type="range"
            min="50"
            max="200"
            value={waterDensity}
            onChange={(e) => setWaterDensity(Number(e.target.value))}
            className="w-full"
          />
        </div>
        
        <div className="mb-3">
          <label className="text-sm block mb-2">
            Air Density: {airDensity}
          </label>
          <input
            type="range"
            min="1"
            max="50"
            value={airDensity}
            onChange={(e) => setAirDensity(Number(e.target.value))}
            className="w-full"
          />
        </div>
        
        <button
          onClick={() => setIsRunning(!isRunning)}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors w-full"
        >
          {isRunning ? 'Pause' : 'Resume'}
        </button>
      </div>
    </div>
  );
};

export default BubbleSimulator;