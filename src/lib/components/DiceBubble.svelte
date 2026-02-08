<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import * as THREE from 'three';
  import * as CANNON from 'cannon-es';
  import { gsap } from 'gsap';

  export let show = false;
  
  const dispatch = createEventDispatcher();

  let container;
  let scene, camera, renderer, world;
  let dice = [];
  let floorMesh, floorBody;
  let frameId;
  let isRolling = false;
  let lastResult = null;

  // Dice params
  const diceParams = {
    size: 7.2, // Lowered from 8.0
    edgeRadius: 1.6, // Adjusted from 1.8 to maintain proportionality
    segments: 12 // Higher segments for smoother rounding
  };

  const baseRadius = 16;
  const floorThickness = 4.0;

  function createDiceGeometry() {
    const boxGeometry = new THREE.BoxGeometry(diceParams.size, diceParams.size, diceParams.size, diceParams.segments, diceParams.segments, diceParams.segments);
    const positionAttribute = boxGeometry.attributes.position;
    const subCubeHalfSize = (diceParams.size / 2) - diceParams.edgeRadius;

    for (let i = 0; i < positionAttribute.count; i++) {
      let x = positionAttribute.getX(i);
      let y = positionAttribute.getY(i);
      let z = positionAttribute.getZ(i);

      if (Math.abs(x) > subCubeHalfSize && Math.abs(y) > subCubeHalfSize && Math.abs(z) > subCubeHalfSize) {
        // Corner
        const temp = new THREE.Vector3(
          x > 0 ? x - subCubeHalfSize : x + subCubeHalfSize,
          y > 0 ? y - subCubeHalfSize : y + subCubeHalfSize,
          z > 0 ? z - subCubeHalfSize : z + subCubeHalfSize
        );
        temp.normalize().multiplyScalar(diceParams.edgeRadius);
        positionAttribute.setXYZ(i, 
          (x > 0 ? subCubeHalfSize : -subCubeHalfSize) + temp.x,
          (y > 0 ? subCubeHalfSize : -subCubeHalfSize) + temp.y,
          (z > 0 ? subCubeHalfSize : -subCubeHalfSize) + temp.z
        );
      } else if (Math.abs(x) > subCubeHalfSize && Math.abs(y) > subCubeHalfSize) {
        // Edge parallel to Z
        const temp = new THREE.Vector2(
          x > 0 ? x - subCubeHalfSize : x + subCubeHalfSize,
          y > 0 ? y - subCubeHalfSize : y + subCubeHalfSize
        );
        temp.normalize().multiplyScalar(diceParams.edgeRadius);
        positionAttribute.setXY(i, 
          (x > 0 ? subCubeHalfSize : -subCubeHalfSize) + temp.x,
          (y > 0 ? subCubeHalfSize : -subCubeHalfSize) + temp.y
        );
      } else if (Math.abs(x) > subCubeHalfSize && Math.abs(z) > subCubeHalfSize) {
        // Edge parallel to Y
        const temp = new THREE.Vector2(
          x > 0 ? x - subCubeHalfSize : x + subCubeHalfSize,
          z > 0 ? z - subCubeHalfSize : z + subCubeHalfSize
        );
        temp.normalize().multiplyScalar(diceParams.edgeRadius);
        positionAttribute.setX(i, (x > 0 ? subCubeHalfSize : -subCubeHalfSize) + temp.x);
        positionAttribute.setZ(i, (z > 0 ? subCubeHalfSize : -subCubeHalfSize) + temp.y);
      } else if (Math.abs(y) > subCubeHalfSize && Math.abs(z) > subCubeHalfSize) {
        // Edge parallel to X
        const temp = new THREE.Vector2(
          y > 0 ? y - subCubeHalfSize : y + subCubeHalfSize,
          z > 0 ? z - subCubeHalfSize : z + subCubeHalfSize
        );
        temp.normalize().multiplyScalar(diceParams.edgeRadius);
        positionAttribute.setY(i, (y > 0 ? subCubeHalfSize : -subCubeHalfSize) + temp.x);
        positionAttribute.setZ(i, (z > 0 ? subCubeHalfSize : -subCubeHalfSize) + temp.y);
      }
    }

    boxGeometry.computeVertexNormals();
    return boxGeometry;
  }

  function createDiceMesh() {
    const geometry = createDiceGeometry();
    const material = new THREE.MeshStandardMaterial({
      color: 0xf0f0f0, // Slightly warmer white
      roughness: 0.6, // Increased roughness for a "soft/fluffy" feel
      metalness: 0.05
    });

    // Add dots
    const diceGroup = new THREE.Group();
    const dieMain = new THREE.Mesh(geometry, material);
    dieMain.castShadow = true;
    diceGroup.add(dieMain);

    const dotSize = 0.1 * diceParams.size; // Slightly smaller dots to fit the rounder corners
    // Use a flatter geometry for the dot or just sink the sphere
    const dotGeometry = new THREE.SphereGeometry(dotSize, 12, 12);
    const dotMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x222222, 
      roughness: 0.4,
      metalness: 0.0 
    });

    const half = diceParams.size / 2;
    // Offset slightly INSIDE the face for indented look
    const offset = half - (dotSize * 0.4);
    const dotOffset = 0.22 * diceParams.size; // Moved dots inward to avoid falling off the rounded edges

    const faceDots = [
      { face: 'front', axis: 'z', val: offset, dots: [[0,0]] }, // 1
      { face: 'back', axis: 'z', val: -offset, dots: [[-dotOffset, -dotOffset], [-dotOffset, 0], [-dotOffset, dotOffset], [dotOffset, -dotOffset], [dotOffset, 0], [dotOffset, dotOffset]] }, // 6
      { face: 'top', axis: 'y', val: offset, dots: [[-dotOffset, -dotOffset], [dotOffset, dotOffset]] }, // 2
      { face: 'bottom', axis: 'y', val: -offset, dots: [[-dotOffset, -dotOffset], [0, 0], [dotOffset, dotOffset], [dotOffset, -dotOffset], [-dotOffset, dotOffset]] }, // 5
      { face: 'right', axis: 'x', val: offset, dots: [[-dotOffset, -dotOffset], [0, 0], [dotOffset, dotOffset]] }, // 3
      { face: 'left', axis: 'x', val: -offset, dots: [[-dotOffset, -dotOffset], [dotOffset, -dotOffset], [-dotOffset, dotOffset], [dotOffset, dotOffset]] }, // 4
    ];

    faceDots.forEach(f => {
      f.dots.forEach(dPos => {
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        if (f.axis === 'z') {
          dot.position.set(dPos[0], dPos[1], f.val);
        } else if (f.axis === 'y') {
          dot.position.set(dPos[0], f.val, dPos[1]);
        } else {
          dot.position.set(f.val, dPos[0], dPos[1]);
        }
        diceGroup.add(dot);
      });
    });

    return diceGroup;
  }

  let rollStartTime = 0;

  function init() {
    // Three.js Setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 18, 28); // Zoomed in slightly: Y (20 -> 18), Z (32 -> 28)
    camera.lookAt(0, 4, 0); // Keep focus on the dice action area

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Slightly reduced ambient
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2); // Stronger directional
    mainLight.position.set(10, 25, 15);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    scene.add(mainLight);

    const rimLight = new THREE.PointLight(0xffffff, 0.5); // Add rim light for better definition
    rimLight.position.set(-15, 10, -10);
    scene.add(rimLight);

    // Physics
    world = new CANNON.World();
    world.gravity.set(0, -200, 0); // Increased gravity from -150 to -200
    world.allowSleep = true;
    world.solver.iterations = 20; // Better collision accuracy

    // Materials
    const diceMaterial = new CANNON.Material({ friction: 0.2, restitution: 0.5 });
    const floorMaterial = new CANNON.Material({ friction: 0.4, restitution: 0.3 });
    const wallMaterial = new CANNON.Material({ friction: 0.05, restitution: 0.8 });

    // Contact Materials
    const diceDiceContact = new CANNON.ContactMaterial(diceMaterial, diceMaterial, {
      friction: 0.2,
      restitution: 0.5,
      contactEquationStiffness: 1e6, // Slightly softer collisions
      contactEquationRelaxation: 3
    });
    world.addContactMaterial(diceDiceContact);

    const diceFloorContact = new CANNON.ContactMaterial(diceMaterial, floorMaterial, {
      friction: 0.4,
      restitution: 0.4
    });
    world.addContactMaterial(diceFloorContact);

    const diceWallContact = new CANNON.ContactMaterial(diceMaterial, wallMaterial, {
      friction: 0.05,
      restitution: 0.7
    });
    world.addContactMaterial(diceWallContact);

    // Floor (Green Base) - Thickened base
    floorBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: floorMaterial
    });
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floorBody);

    floorMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(baseRadius, baseRadius, floorThickness, 32),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.2 })
    );
    floorMesh.position.y = -floorThickness / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Bubble Cylinder (Visible)
    const bubbleHeight = 6; // Lowered from 8
    const cylinderGeom = new THREE.CylinderGeometry(baseRadius, baseRadius, bubbleHeight, 32, 1, true);
    const bubbleMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 0.1, // Reduced opacity slightly
      side: THREE.FrontSide, // Change to FrontSide to avoid z-fighting with itself
      metalness: 0.1,
      roughness: 0.05
    });
    const cylinder = new THREE.Mesh(cylinderGeom, bubbleMaterial);
    cylinder.position.y = bubbleHeight / 2;
    scene.add(cylinder);

    // Dome Top
    const domeGeom = new THREE.SphereGeometry(baseRadius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeom, bubbleMaterial);
    dome.position.y = bubbleHeight;
    scene.add(dome);

    // Physics walls for the cylinder
    // wallMaterial already defined above
    
    // Create circular walls using many small planes or a simplified box enclosure
    const wallCount = 12;
    for (let i = 0; i < wallCount; i++) {
      const angle = (i / wallCount) * Math.PI * 2;
      const x = Math.cos(angle) * baseRadius;
      const z = Math.sin(angle) * baseRadius;
      
      const wallBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Plane(),
        material: wallMaterial
      });
      wallBody.position.set(x, bubbleHeight / 2, z);
      wallBody.quaternion.setFromEuler(0, -angle - Math.PI / 2, 0);
      world.addBody(wallBody);
    }

    // Ceiling Physics
    const ceilingBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: wallMaterial
    });
    ceilingBody.position.set(0, bubbleHeight + baseRadius, 0); // At the top of the dome
    ceilingBody.quaternion.setFromEuler(Math.PI / 2, 0, 0);
    world.addBody(ceilingBody);

    // Create 2 Dice
    for (let i = 0; i < 2; i++) {
      const mesh = createDiceMesh();
      scene.add(mesh);

      const body = new CANNON.Body({
        mass: 20, // Increased mass to 20 as requested
        shape: new CANNON.Box(new CANNON.Vec3(diceParams.size / 2, diceParams.size / 2, diceParams.size / 2)),
        material: diceMaterial,
        linearDamping: 0.4, // Reduced from 0.7 for faster lateral movement
        angularDamping: 0.3 // Reduced from 0.7 to allow more free spinning
      });
      body.position.set(i === 0 ? -diceParams.size * 1.2 : diceParams.size * 1.2, diceParams.size / 2, 0);
      world.addBody(body);

      dice.push({ mesh, body });
    }

    animate();
  }

  function animate() {
    frameId = requestAnimationFrame(animate);
    world.fixedStep();

    dice.forEach(d => {
      // VELOCITY CLAMPING: Prevent the dice from ever reaching "escape velocity"
      // Limit linear velocity
      const maxVelocity = 30; // Lowered from 40 to prevent flying to the top
      const v = d.body.velocity;
      if (v.length() > maxVelocity) {
        v.scale(maxVelocity / v.length(), v);
      }

      // Limit angular velocity (spin)
      const maxAngularVelocity = 20; // Increased from 12 to allow more free spinning
      const av = d.body.angularVelocity;
      if (av.length() > maxAngularVelocity) {
        av.scale(maxAngularVelocity / av.length(), av);
      }

      d.mesh.position.copy(d.body.position);
      d.mesh.quaternion.copy(d.body.quaternion);
    });

    // Check if dice stopped moving
    if (isRolling) {
      const allStopped = dice.every(d => 
        d.body.velocity.length() < 0.3 && d.body.angularVelocity.length() < 0.3
      );
      
      const minimumTimeMet = Date.now() - rollStartTime > 3500;
      
      if (allStopped && minimumTimeMet) {
        // Delay completion to ensure duration
        setTimeout(() => {
          if (!isRolling) return;
          isRolling = false;
          calculateResult();
        }, 300);
      }
    }

    renderer.render(scene, camera);
  }

  function calculateResult() {
    const results = dice.map(d => {
      const dieQuat = d.mesh.quaternion;
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(dieQuat.clone().invert());
      
      // Check which side is up
      // faceDots order: front(1), back(6), top(2), bottom(5), right(3), left(4)
      const sides = [
        { val: 1, vec: new THREE.Vector3(0, 0, 1) },
        { val: 6, vec: new THREE.Vector3(0, 0, -1) },
        { val: 2, vec: new THREE.Vector3(0, 1, 0) },
        { val: 5, vec: new THREE.Vector3(0, -1, 0) },
        { val: 3, vec: new THREE.Vector3(1, 0, 0) },
        { val: 4, vec: new THREE.Vector3(-1, 0, 0) }
      ];

      let maxDot = -Infinity;
      let result = 1;
      sides.forEach(s => {
        const dot = s.vec.dot(up);
        if (dot > maxDot) {
          maxDot = dot;
          result = s.val;
        }
      });
      return result;
    });

    lastResult = results;
    dispatch('rolled', { dice: results, total: results[0] + results[1] });
  }

  export function roll() {
    if (isRolling) return;
    isRolling = true;
    dispatch('rollStart');
    lastResult = null;
    rollStartTime = Date.now();

    // Stabilized Initial Kick: Grounded spin focus
      dice.forEach(d => {
        d.body.wakeUp();
        // Guaranteed minimum sideways movement for spinning, low upward
        d.body.velocity.set(
          (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 10),
          4 + Math.random() * 4, 
          (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 10)
        );
        // Stronger initial rotation for free spinning
        d.body.angularVelocity.set(
          (Math.random() - 0.5) * 15,
          (Math.random() - 0.5) * 15,
          (Math.random() - 0.5) * 15
        );
      });

    // Earthquake animation - 3.5 seconds total (increased to match slower speed)
      if (floorMesh) {
        gsap.to({}, {
          duration: 3.5,
          onUpdate: function() {
            const progress = this.progress(); // 0 to 1
            const time = Date.now() * 0.016; // Slower oscillation speed as requested
            
            // Visual bounce intensity decays more naturally for the slower speed
            const intensity = (1 - progress * 0.8) * 1.0; 
            const bounceHeight = intensity * 6.0; // Increased height to match slower speed
            const tiltIntensity = intensity * 0.3; 
            
            // Trampoline Effect: Move only on Y axis in a slower, deeper oscillation
            const yOffset = Math.abs(Math.sin(time)) * bounceHeight;
            floorMesh.position.y = (-floorThickness / 2) + yOffset;
            
            // Sync physics floor - targeting 1/4 dice height (approx 1.8 units)
            floorBody.position.y = (yOffset * 0.5); 
            
            // Ensure X and Z are centered
            floorMesh.position.x = 0;
            floorMesh.position.z = 0;
            floorBody.position.x = 0;
            floorBody.position.z = 0;

            // Subtle tilt for variety
            const tiltX = (Math.sin(time * 0.5) * tiltIntensity);
            const tiltZ = (Math.cos(time * 0.5) * tiltIntensity);
            floorBody.quaternion.setFromEuler(-Math.PI / 2 + tiltX, 0, tiltZ);

            // Apply forces to dice to simulate the floor rumbling
            dice.forEach(d => {
              d.body.wakeUp();
              
              // Slightly higher upward push for the 1/4 height bounce
              const upwardPush = (Math.sin(time) > 0 ? 0.4 : 0.1); 
              const rumbleForce = new CANNON.Vec3(
                (Math.random() - 0.5) * 1200 * intensity, // Doubled horizontal force for speed
                (200 + Math.random() * 300) * intensity * upwardPush, // Slightly increased vertical
                (Math.random() - 0.5) * 1200 * intensity  // Doubled horizontal force for speed
              );
              d.body.applyForce(rumbleForce, d.body.position);

              // MINIMUM MOVEMENT: Increased threshold and nudge for constant energy
              if (d.body.velocity.length() < 18) { // Increased threshold from 12
                d.body.velocity.set(
                  d.body.velocity.x + (Math.random() - 0.5) * 60 * intensity, // Increased from 40
                  d.body.velocity.y + 10 * intensity, // Increased from 6
                  d.body.velocity.z + (Math.random() - 0.5) * 60 * intensity // Increased from 40
                );
              }

              // MINIMUM ROTATION: Increased rotation for "free" spinning
              if (d.body.angularVelocity.length() < 3.0) { // Increased threshold from 1.5
                d.body.angularVelocity.set(
                  (Math.random() - 0.5) * 40 * intensity, // Increased from 30
                  (Math.random() - 0.5) * 40 * intensity, // Increased from 30
                  (Math.random() - 0.5) * 40 * intensity  // Increased from 30
                );
              }
              
              // Occasional small pop - adjusted for slight bounce
              if (Math.random() > 0.94 && d.body.position.y < 4.5) {
                d.body.applyImpulse(new CANNON.Vec3(0, 150 * intensity, 0), d.body.position); 
              }
            });

            // ANTI-STUCK: Push dice apart if they are too close to each other
            if (dice.length >= 2 && dice[0].body && dice[1].body) {
              const d1 = dice[0].body;
              const d2 = dice[1].body;
              const minDist = diceParams.size * 1.1;
              const dist = d1.position.distanceTo(d2.position);
              
              if (dist < minDist) {
                const pushDir = d1.position.vsub(d2.position);
                pushDir.normalize();
                const pushForce = 100 * intensity;
                d1.applyImpulse(pushDir.scale(pushForce), d1.position);
                d2.applyImpulse(pushDir.scale(-pushForce), d2.position);
              }
            }
        },
        onComplete: () => {
          // Reset floor position smoothly
          gsap.to(floorMesh.position, { x: 0, y: -floorThickness / 2, z: 0, duration: 0.4, ease: "power2.out" });
          floorBody.position.set(0, 0, 0);
          floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        }
      });
    }
  }

  function onWindowResize() {
    if (!container || !camera || !renderer) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  onMount(() => {
    init();
    window.addEventListener('resize', onWindowResize);
  });

  onDestroy(() => {
    window.removeEventListener('resize', onWindowResize);
    cancelAnimationFrame(frameId);
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
    }
  });

  // No changes needed in script section for layout
  $: if (show && container && !scene) {
    init();
  }
</script>

<div class="w-[14%] bg-black/20 rounded-2xl border-2 border-emerald-400/50 shadow-[0_0_40px_rgba(0,0,0,0.6),inset_0_0_30px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden relative group" on:click|self={() => dispatch('close')}>
  <!-- Header Removed -->

  <!-- 3D Canvas -->
  <div bind:this={container} class="flex-1 relative cursor-pointer" on:click={roll}>
  </div>
</div>

<style>
  @keyframes eclipse-rays {
    from { transform: rotate(0deg) scale(1); }
    to { transform: rotate(360deg) scale(1.1); }
  }
  .animate-eclipse-rays {
    animation: eclipse-rays 10s linear infinite;
  }
</style>
