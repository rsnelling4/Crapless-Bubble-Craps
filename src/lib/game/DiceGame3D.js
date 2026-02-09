import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class DiceGame3D {
    constructor(containerId, onResult) {
        this.container = document.getElementById(containerId);
        this.onResult = onResult;
        this.dice = [];
        this.isRolling = false;
        this.init();
    }

    init() {
        // --- 1. Three.js Scene Setup ---
        this.scene = new THREE.Scene();
        // Transparent background
        this.scene.background = null; 

        const width = 180;
        const height = 150;
        const aspect = width / height;
        this.camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 1000); 
        this.camera.position.set(0, 15, 65); // Pull back more for a cleaner side view
        this.camera.lookAt(0, 12, 0); 

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
        this.container.appendChild(this.renderer.domElement);

        // Lighting - Brighter and more direct like the reference
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        const spotLight = new THREE.SpotLight(0xffffff, 1.2);
        spotLight.position.set(5, 40, 20);
        spotLight.castShadow = true;
        spotLight.shadow.mapSize.width = 1024;
        spotLight.shadow.mapSize.height = 1024;
        spotLight.shadow.bias = -0.001;
        this.scene.add(spotLight);

        // Top highlight for glass effect
        const topLight = new THREE.PointLight(0xffffff, 0.5);
        topLight.position.set(0, 35, 0);
        this.scene.add(topLight);

        // --- 2. Cannon.js Physics Setup ---
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82 * 2.5, 0);
        this.world.allowSleep = true;

        // --- 3. Cylinder Container ---
        this.createCylinder();

        // --- 4. Dice ---
        this.createDice();

        // Start animation loop
        this.animate();
    }

    createCylinder() {
        const radius = 13;
        const height = 30; // Taller like the reference image
        const floorThickness = 1.5;

        // Visual Cylinder (Glass Shaker)
        // Straighter walls (radiusTop and radiusBottom almost same)
        const geometry = new THREE.CylinderGeometry(radius, radius, height, 32, 1, true);
        const material = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide,
            shininess: 150,
            specular: 0xffffff
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = height / 2;
        this.scene.add(mesh);

        // Top Cap (Slightly flatter dome like reference)
        const capGeo = new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 3);
        const capMesh = new THREE.Mesh(capGeo, material);
        capMesh.position.y = height;
        this.scene.add(capMesh);

        // Visual Floor (Bright Green Felt Disc)
        const floorGeo = new THREE.CylinderGeometry(radius - 0.2, radius - 0.2, floorThickness, 32);
        const floorMat = new THREE.MeshPhongMaterial({ color: 0x44cc44 }); // Brighter lime-green felt
        this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
        this.floorMesh.position.y = floorThickness / 2;
        this.floorMesh.receiveShadow = true;
        this.scene.add(this.floorMesh);

        // Physics Floor (Kinematic body for "popping" the dice)
        const groundShape = new CANNON.Cylinder(radius, radius, floorThickness, 32);
        this.groundBody = new CANNON.Body({
            mass: 0,
            type: CANNON.Body.KINEMATIC,
            shape: groundShape,
            material: new CANNON.Material({ friction: 0.5, restitution: 0.9 }) 
        });
        const quat = new CANNON.Quaternion();
        quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.groundBody.quaternion.copy(quat);
        this.groundBody.position.set(0, floorThickness / 2, 0);
        this.world.addBody(this.groundBody);

        // Physics Walls (Cylindrical containment)
        const wallMaterial = new CANNON.Material({ friction: 0.05, restitution: 0.7 });
        const numSegments = 32;
        for (let i = 0; i < numSegments; i++) {
            const angle = (i / numSegments) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const wallBody = new CANNON.Body({ mass: 0, material: wallMaterial });
            wallBody.addShape(new CANNON.Box(new CANNON.Vec3(4, height, 1)));
            wallBody.position.set(x, height / 2, z);
            wallBody.quaternion.setFromEuler(0, -angle, 0);
            this.world.addBody(wallBody);
        }

        // Physics Ceiling
        const ceilingBody = new CANNON.Body({ mass: 0 });
        ceilingBody.addShape(new CANNON.Plane());
        ceilingBody.position.set(0, height + 5, 0);
        ceilingBody.quaternion.setFromEuler(Math.PI / 2, 0, 0);
        this.world.addBody(ceilingBody);
    }

    createDice() {
        const size = 6.5; // Larger dice like reference
        const dieMaterial = new CANNON.Material({ friction: 0.3, restitution: 0.5 });

        for (let i = 0; i < 2; i++) {
            // Visual Die - White with slight gloss
            const geometry = new THREE.BoxGeometry(size, size, size);
            const mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({ 
                color: 0xffffff,
                shininess: 30
            }));
            mesh.castShadow = true;
            this.scene.add(mesh);

            // Physics Die
            const body = new CANNON.Body({
                mass: 25,
                shape: new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2)),
                material: dieMaterial,
                linearDamping: 0.1,
                angularDamping: 0.1
            });
            body.position.set(i === 0 ? -4 : 4, 10, i === 0 ? 2 : -2);
            this.world.addBody(body);

            this.dice.push({ mesh, body });
            this.addDots(mesh, size);
        }
    }

    addDots(mesh, size) {
        const dotGeo = new THREE.SphereGeometry(size * 0.08, 8, 8);
        const dotMat = new THREE.MeshPhongMaterial({ color: 0x111111 });
        const offset = size * 0.5 + 0.01;
        const s = size * 0.25;

        const dotConfigs = [
            { face: 'front', pos: [[0, 0, offset]] }, // 1
            { face: 'back', pos: [[-s, -s, -offset], [s, s, -offset]] }, // 2
            { face: 'top', pos: [[-s, offset, -s], [0, offset, 0], [s, offset, s]] }, // 3
            { face: 'bottom', pos: [[-s, -offset, -s], [s, -offset, -s], [-s, -offset, s], [s, -offset, s]] }, // 4
            { face: 'right', pos: [[offset, -s, -s], [offset, s, -s], [offset, 0, 0], [offset, -s, s], [offset, s, s]] }, // 5
            { face: 'left', pos: [[-offset, -s, -s], [-offset, s, -s], [-offset, -s, s], [-offset, s, s], [-offset, s, 0], [-offset, -s, 0]] } // 6
        ];

        dotConfigs.forEach(config => {
            config.pos.forEach(p => {
                const dot = new THREE.Mesh(dotGeo, dotMat);
                dot.position.set(p[0], p[1], p[2]);
                mesh.add(dot);
            });
        });
    }

    roll() {
        if (this.isRolling) return;
        this.isRolling = true;

        const duration = 2000;
        const startTime = Date.now();
        const baseHeight = this.groundBody.position.y;

        const shake = () => {
            const elapsed = Date.now() - startTime;
            
            if (elapsed < duration) {
                // Energetic shaker logic:
                // High frequency oscillation for the earthquake effect
                const frequency = 40; 
                const amplitude = 50; // Increased amplitude for more "pop"
                
                // Rapidly move floor up and down to kick the dice
                this.groundBody.velocity.y = Math.sin(elapsed * 0.1 * frequency) * amplitude;
                
                // Add horizontal jitter to the floor to scramble the dice
                this.groundBody.position.x = (Math.random() - 0.5) * 1.5;
                this.groundBody.position.z = (Math.random() - 0.5) * 1.5;

                requestAnimationFrame(shake);
            } else {
                // Reset floor and wait for dice to settle
                this.groundBody.velocity.set(0, 0, 0);
                this.groundBody.position.set(0, baseHeight, 0);
                this.checkSettled();
            }
        };

        // Wake up dice and give them an initial random nudge
        this.dice.forEach(d => {
            d.body.wakeUp();
            d.body.angularVelocity.set(
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20
            );
        });

        shake();
    }

    checkSettled() {
        const interval = setInterval(() => {
            const allSettled = this.dice.every(d => 
                d.body.velocity.length() < 0.2 && d.body.angularVelocity.length() < 0.2
            );

            if (allSettled) {
                clearInterval(interval);
                this.isRolling = false;
                this.reportResult();
            }
        }, 100);
    }

    reportResult() {
        const results = this.dice.map((d, index) => {
            // Check which face is up
            const up = new THREE.Vector3(0, 1, 0);
            
            // Standard dice mapping relative to local axes
            const faces = [
                { dir: new THREE.Vector3(0, 0, 1), val: 1 },  // Front
                { dir: new THREE.Vector3(0, 0, -1), val: 2 }, // Back
                { dir: new THREE.Vector3(0, 1, 0), val: 3 },  // Top
                { dir: new THREE.Vector3(0, -1, 0), val: 4 }, // Bottom
                { dir: new THREE.Vector3(1, 0, 0), val: 5 },  // Right
                { dir: new THREE.Vector3(-1, 0, 0), val: 6 }  // Left
            ];

            let maxDot = -Infinity;
            let result = 1;

            faces.forEach(f => {
                // Transform local direction to world space using current mesh rotation
                const worldDir = f.dir.clone().applyQuaternion(d.mesh.quaternion);
                const dot = worldDir.dot(up);
                if (dot > maxDot) {
                    maxDot = dot;
                    result = f.val;
                }
            });
            return result;
        });

        if (this.onResult) this.onResult(results[0], results[1]);
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        // Update Physics
        this.world.step(1 / 60);

        // Sync Floor Visuals (for earthquake effect)
        if (this.floorMesh && this.groundBody) {
            this.floorMesh.position.copy(this.groundBody.position);
            this.floorMesh.quaternion.copy(this.groundBody.quaternion);
        }

        // Sync Dice Visuals
        this.dice.forEach(d => {
            d.mesh.position.copy(d.body.position);
            d.mesh.quaternion.copy(d.body.quaternion);
        });

        this.renderer.render(this.scene, this.camera);
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.renderer.dispose();
        if (this.container && this.container.contains(this.renderer.domElement)) {
            this.container.removeChild(this.renderer.domElement);
        }
    }
}

export const createGame3D = (containerId, onResult) => {
    return new DiceGame3D(containerId, onResult);
};
