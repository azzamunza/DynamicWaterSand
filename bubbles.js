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

const BubbleSimulator = () => {
  const canvasRef = useRef(null);
  const [isRunning, setIsRunning] = useState(true);
  const [airAmount, setAirAmount] = useState(20);
  const [surfaceTension, setSurfaceTension] = useState(50);
  const animationRef = useRef(null);
  const mouseRef = useRef({
    x: 0,
    y: 0,
    isDown: false
  });
  const blobsRef = useRef([]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    const handleMouseDown = e => {
      mouseRef.current.isDown = true;
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };
    const handleMouseUp = () => {
      mouseRef.current.isDown = false;
    };
    const handleMouseMove = e => {
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
    const METABALL_THRESHOLD = 1.0;
    const GRID_SIZE = 8;
    const SURFACE_LAYER = 80; // Height of the surface accumulation zone

    class Blob {
      constructor(x, y, radius = null) {
        this.x = x;
        this.y = y;
        this.radius = radius || Math.random() * 15 + 10;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = -(Math.random() * 0.2 + 0.15);
        this.mass = this.radius * this.radius;
        this.mergeTimer = 0;
        this.atSurface = false;
      }
      update(canvas) {
        // Check if at surface
        const distFromTop = this.y - this.radius;
        this.atSurface = distFromTop < SURFACE_LAYER;
        if (this.atSurface) {
          // At surface: spread horizontally and slow down
          this.vy *= 0.85; // Strong damping

          // Apply horizontal spreading force
          const spreadForce = 0.3;
          this.vx += (Math.random() - 0.5) * spreadForce;

          // Cap upward movement at surface
          if (this.y < this.radius + 5) {
            this.y = this.radius + 5;
            this.vy = Math.max(0, this.vy * 0.3);
          }

          // Stronger horizontal drift along surface
          this.vx *= 0.96;
        } else {
          // Rising through water: normal buoyancy
          const buoyancy = 0.04 * (this.radius / 15);
          this.vy -= buoyancy;
          this.vx *= 0.99;
          this.vy *= 0.99;

          // Gentle wobble
          this.vx += Math.sin(frameCount * 0.05 + this.x * 0.01) * 0.02;
        }

        // Update position
        this.x += this.vx;
        this.y += this.vy;

        // Boundary collisions
        if (this.x - this.radius < 0) {
          this.x = this.radius;
          this.vx = Math.abs(this.vx) * 0.5;
        }
        if (this.x + this.radius > canvas.width) {
          this.x = canvas.width - this.radius;
          this.vx = -Math.abs(this.vx) * 0.5;
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
          return this.radius * this.radius / (distSq + 1);
        }
        const distSq = dx * dx + dy * dy;
        return effectiveRadius * effectiveRadius / (distSq + 1);
      }
      canMerge() {
        return this.mergeTimer <= 0 && this.radius < 80;
      }
      canSplit() {
        return this.radius > 25 && Math.random() < 0.001;
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
      const merged = new Blob((b1.x * b1.mass + b2.x * b2.mass) / totalMass, (b1.y * b1.mass + b2.y * b2.mass) / totalMass, newRadius);
      merged.vx = (b1.vx * b1.mass + b2.vx * b2.mass) / totalMass;
      merged.vy = (b1.vy * b1.mass + b2.vy * b2.mass) / totalMass;
      merged.mergeTimer = 20;
      return merged;
    }
    function splitBlob(blob) {
      const angle = Math.random() * Math.PI * 2;
      const newRadius = blob.radius / Math.sqrt(2);
      const offset = newRadius * 1.2;
      const b1 = new Blob(blob.x + Math.cos(angle) * offset, blob.y + Math.sin(angle) * offset, newRadius);
      const b2 = new Blob(blob.x - Math.cos(angle) * offset, blob.y - Math.sin(angle) * offset, newRadius);
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
          const attractionMult = b1.atSurface && b2.atSurface ? 2.0 : 1.0;
          const attractionRange = (b1.radius + b2.radius) * 2.5;
          if (dist < attractionRange && dist > 0.1) {
            const force = 0.008 * (b1.radius + b2.radius) / dist * attractionMult;
            const fx = dx / dist * force;
            const fy = dy / dist * force;
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

                  // Cyan/blue bubble color
                  data[index] = 150 + intensity * 80; // R
                  data[index + 1] = 220 + intensity * 35; // G
                  data[index + 2] = 255; // B
                  data[index + 3] = 180 + intensity * 75; // A
                }
              }
            }
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);

      // Add highlights and glossiness
      blobs.forEach(blob => {
        const gradient = ctx.createRadialGradient(blob.x - blob.radius * 0.3, blob.y - blob.radius * 0.3, 0, blob.x, blob.y, blob.radius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGradient.addColorStop(0, '#001a33');
      bgGradient.addColorStop(0.5, '#003d5c');
      bgGradient.addColorStop(1, '#005577');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Light rays
      ctx.save();
      ctx.globalAlpha = 0.1;
      for (let i = 0; i < 5; i++) {
        const x = canvas.width / 6 * (i + 1) + Math.sin(frameCount * 0.01 + i) * 50;
        const rayGradient = ctx.createLinearGradient(x - 50, 0, x + 50, canvas.height);
        rayGradient.addColorStop(0, 'rgba(255, 255, 200, 0.3)');
        rayGradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
        ctx.fillStyle = rayGradient;
        ctx.fillRect(x - 50, 0, 100, canvas.height);
      }
      ctx.restore();

      // Draw surface line
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.moveTo(0, SURFACE_LAYER);
      ctx.lineTo(canvas.width, SURFACE_LAYER);
      ctx.stroke();
      ctx.setLineDash([]);

      // Spawn blobs
      if (mouseRef.current.isDown && frameCount % 100 === 0) {
        blobsRef.current.push(new Blob(mouseRef.current.x, mouseRef.current.y, 15));
      }
      const spawnChance = airAmount / 1000; // Convert slider value to probability
      const maxBlobs = Math.floor(airAmount * 2.5); // Scale max blobs with air amount

      if (Math.random() < spawnChance && blobsRef.current.length < maxBlobs) {
        blobsRef.current.push(new Blob(Math.random() * canvas.width, canvas.height - 30, Math.random() * 15 + 15));
      }

      // Apply attraction
      applyAttraction(blobsRef.current);

      // Apply surface spreading
      applySurfaceSpread(blobsRef.current);

      // Update blobs
      blobsRef.current.forEach(b => b.update(canvas));

      // Calculate merge difficulty based on surface tension (0-100 -> 0.1-0.9)
      const mergeDifficulty = 0.1 + surfaceTension / 100 * 0.8;
      const splitDifficulty = 1.0 - surfaceTension / 100 * 0.8;

      // Handle merging (harder with high surface tension)
      const toRemove = new Set();
      const toAdd = [];
      for (let i = 0; i < blobsRef.current.length; i++) {
        for (let j = i + 1; j < blobsRef.current.length; j++) {
          const b1 = blobsRef.current[i];
          const b2 = blobsRef.current[j];
          if (toRemove.has(i) || toRemove.has(j)) continue;
          const dist = getDistance(b1, b2);
          const mergeDist = (b1.radius + b2.radius) * (0.5 + mergeDifficulty * 0.5);

          // Merge chance affected by surface tension
          const baseMergeChance = b1.atSurface && b2.atSurface ? 0.5 : 0.3;
          const mergeChance = baseMergeChance * (1 - mergeDifficulty);
          if (dist < mergeDist && b1.canMerge() && b2.canMerge()) {
            if (Math.random() < mergeChance) {
              toAdd.push(mergeBlobs(b1, b2));
              toRemove.add(i);
              toRemove.add(j);
            }
          }
        }
      }

      // Handle splitting (harder with high surface tension)
      blobsRef.current.forEach((blob, i) => {
        if (!toRemove.has(i) && blob.canSplit()) {
          if (Math.random() < splitDifficulty) {
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
      animate();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning]);
  return /*#__PURE__*/React.createElement("div", {
    className: "relative w-full h-screen overflow-hidden bg-blue-900"
  }, /*#__PURE__*/React.createElement("canvas", {
    ref: canvasRef,
    className: "absolute inset-0 cursor-crosshair"
  }), /*#__PURE__*/React.createElement("div", {
    className: "absolute top-4 left-4 bg-black/50 text-white p-4 rounded-lg backdrop-blur-sm"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "text-2xl font-bold mb-3"
  }, "Air Bubble Physics"), /*#__PURE__*/React.createElement("p", {
    className: "text-sm mb-3"
  }, "Click and hold to spawn bubbles"), /*#__PURE__*/React.createElement("div", {
    className: "mb-3"
  }, /*#__PURE__*/React.createElement("label", {
    className: "text-sm block mb-2"
  }, "Air Amount: ", airAmount, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    value: airAmount,
    onChange: e => setAirAmount(Number(e.target.value)),
    className: "w-full"
  })), /*#__PURE__*/React.createElement("div", {
    className: "mb-3"
  }, /*#__PURE__*/React.createElement("label", {
    className: "text-sm block mb-2"
  }, "Surface Tension: ", surfaceTension, "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    value: surfaceTension,
    onChange: e => setSurfaceTension(Number(e.target.value)),
    className: "w-full"
  }), /*#__PURE__*/React.createElement("p", {
    className: "text-xs mt-1 opacity-75"
  }, "High = stable bubbles, Low = easy merge/split")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setIsRunning(!isRunning),
    className: "px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors w-full"
  }, isRunning ? 'Pause' : 'Resume')));
};
// BubbleSimulator is defined above
  
  // Export to window.BubbleSimulator
  window.BubbleSimulator = BubbleSimulator;
})();
