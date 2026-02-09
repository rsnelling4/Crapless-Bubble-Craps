import Phaser from 'phaser';
import Matter from 'matter-js';
import { gsap } from 'gsap';

export class DiceGame extends Phaser.Scene {
    constructor() {
        super('DiceGame');
        this.dice = [];
        this.isRolling = false;
        this.onResult = null;
    }

    preload() {
        // We'll use graphics for dice faces instead of textures for now
    }

    create() {
        const { width, height } = this.scale;
        
        // --- 1. Robust Physics Bounds ---
        // Flatten the perspective further as requested
        const feltHeight = 15; // Flatter arch (was 25)
        const baseY = height - 15; // Lower base
        const bottomBoundY = baseY + 5; // Rest slightly "inside" the felt
        const wallPadding = 12; 
        
        this.matter.world.setBounds(wallPadding, 0, width - (wallPadding * 2), bottomBoundY, 100, true, true, true, true);
        
        // --- 2. Cylinder Visuals ---
        const baseWidth = width - 16;
        
        // Ensure the scene background color is set
        this.cameras.main.setBackgroundColor('#1a472a');
        
        // Background - Explicitly add background rectangle
        this.add.rectangle(width/2, height/2, width, height, 0x1a472a).setDepth(0);
        
        // Felt Base (Flatter perspective)
        this.base = this.add.ellipse(width/2, baseY, baseWidth, feltHeight, 0x24a148)
            .setStrokeStyle(3, 0x1d823a)
            .setDepth(1);
            
        // Glass Walls
        const walls = this.add.graphics();
        walls.lineStyle(2, 0xffffff, 0.1);
        walls.beginPath();
        walls.moveTo(width/2 - baseWidth/2, baseY);
        walls.lineTo(width/2 - baseWidth/2, 10);
        walls.moveTo(width/2 + baseWidth/2, baseY);
        walls.lineTo(width/2 + baseWidth/2, 10);
        walls.strokePath();
        walls.setDepth(2);

        // --- 3. Create Dice ---
        this.createDice();
    }

    createDice() {
        const { width, height } = this.scale;
        const baseY = height - 40;
        
        this.dice = [];

        for (let i = 0; i < 2; i++) {
            const index = i; 
            const x = width / 2 + (i === 0 ? -25 : 25);
            const y = baseY;
            
            const dieContainer = this.add.container(x, y);
            dieContainer.setDepth(100);
            
            const size = 32; 
            const graphics = this.add.graphics();
            dieContainer.add(graphics);
            
            const body = this.matter.add.rectangle(x, y, size, size, {
                restitution: 0.4,
                friction: 0.2,
                frictionAir: 0.03,
                mass: 15,
                label: `die_${index}`
            });
            
            this.dice.push({
                container: dieContainer,
                body: body,
                graphics: graphics,
                size: size,
                currentValue: 1,
                dots: []
            });
            
            this.drawCube(index, 0);
        }
    }

    // Advanced 3D Cube drawing with perspective scaling
    drawCube(index, angle) {
        const die = this.dice[index];
        if (!die || !die.graphics) return;
        
        const g = die.graphics;
        const size = die.size;
        const half = size / 2;
        
        g.clear();
        
        // Remove old dots
        if (die.dots) {
            die.dots.forEach(dot => dot.destroy());
        }
        die.dots = [];

        // Depth scaling based on Y position (simulates "further away")
        const { height } = this.scale;
        // Dice higher up (smaller Y) appear further away (smaller scale)
        const depthScale = 0.7 + ((die.body.position.y / height) * 0.4); 
        die.container.setScale(depthScale);

        // Face Colors
        const frontColor = 0xffffff;
        const topColor = 0xf0f0f0;
        const sideColor = 0xe0e0e0;

        // Perspective depth amount
        const pDepth = 8;
        
        // Calculate dynamic tilt based on speed for "tumbling" feel
        const tilt = this.isRolling ? Math.sin(this.time.now * 0.01) * 0.2 : 0;

        // 1. Top Face (Perspective)
        g.lineStyle(1, 0xcccccc, 1);
        g.fillStyle(topColor, 1);
        g.beginPath();
        g.moveTo(-half, -half);
        g.lineTo(-half + pDepth, -half - pDepth);
        g.lineTo(half + pDepth, -half - pDepth);
        g.lineTo(half, -half);
        g.closePath();
        g.fillPath();
        g.strokePath();

        // 2. Side Face (Perspective)
        g.fillStyle(sideColor, 1);
        g.beginPath();
        g.moveTo(half, -half);
        g.lineTo(half + pDepth, -half - pDepth);
        g.lineTo(half + pDepth, half - pDepth);
        g.lineTo(half, half);
        g.closePath();
        g.fillPath();
        g.strokePath();

        // 3. Front Face
        g.fillStyle(frontColor, 1);
        g.fillRoundedRect(-half, -half, size, size, 4);
        g.strokeRoundedRect(-half, -half, size, size, 4);

        // Determine which value to show
        const displayVal = (this.isRolling && die.body.speed > 0.5) 
            ? Math.floor(Math.random() * 6) + 1 
            : die.currentValue;

        // Draw dots on front face
        this.drawDots(die, displayVal, 0, 0, size);
    }

    drawDots(die, value, offsetX, offsetY, size) {
        const spacing = size * 0.25;
        const dotRadius = 2.4;
        const dotPositions = {
            1: [[0, 0]],
            2: [[-spacing, -spacing], [spacing, spacing]],
            3: [[-spacing, -spacing], [0, 0], [spacing, spacing]],
            4: [[-spacing, -spacing], [spacing, -spacing], [-spacing, spacing], [spacing, spacing]],
            5: [[-spacing, -spacing], [spacing, -spacing], [0, 0], [-spacing, spacing], [spacing, spacing]],
            6: [[-spacing, -spacing], [spacing, -spacing], [-spacing, 0], [spacing, 0], [-spacing, spacing], [spacing, spacing]]
        };

        const positions = dotPositions[value] || [];
        positions.forEach(([px, py]) => {
            const dot = this.add.circle(offsetX + px, offsetY + py, dotRadius, 0x111111);
            dot.setDepth(101);
            die.container.add(dot);
            die.dots.push(dot);
        });
    }

    updateDots(index, value) {
        const die = this.dice[index];
        if (die) {
            die.currentValue = value;
            this.drawCube(index, die.body.angle);
        }
    }

    roll() {
        if (this.isRolling) return;
        this.isRolling = true;

        this.diceResults = [
            Math.floor(Math.random() * 6) + 1,
            Math.floor(Math.random() * 6) + 1
        ];

        // 1. Earthquake / Popping Animation
        const tl = gsap.timeline();
        tl.to(this.base, {
            y: "+=4",
            scaleX: 1.04,
            duration: 0.08,
            repeat: 12,
            yoyo: true,
            ease: "power1.inOut"
        });

        // 2. Physics Pops
        const popInterval = setInterval(() => {
            this.applyPop(2.2);
        }, 120);

        this.time.delayedCall(1600, () => {
            clearInterval(popInterval);
            this.stopDice();
        });
    }

    applyPop(forceMultiplier) {
        this.dice.forEach(die => {
            if (!die.body) return;
            const forceX = (Math.random() - 0.5) * forceMultiplier * 0.15; 
            const forceY = -(Math.random() * 0.3 + 0.4) * forceMultiplier * 0.5; 
            const torque = (Math.random() - 0.5) * 0.5;
            
            Matter.Body.applyForce(die.body, die.body.position, { x: forceX, y: forceY });
            Matter.Body.setAngularVelocity(die.body, torque);
        });
    }

    stopDice() {
        this.dice.forEach((die, i) => {
            die.currentValue = this.diceResults[i];
            
            // Natural settling physics
            die.body.frictionAir = 0.15;
            die.body.friction = 0.8;
            die.body.restitution = 0.2;

            const check = setInterval(() => {
                if (!die.body) {
                    clearInterval(check);
                    return;
                }
                
                if (die.body.speed < 0.1 && die.body.angularSpeed < 0.1) {
                    clearInterval(check);
                    
                    // Final upright orientation for clarity
                    gsap.to(die.body, {
                        angle: 0,
                        duration: 0.5,
                        onUpdate: () => {
                            if (die.body) Matter.Body.setAngle(die.body, die.body.angle);
                        },
                        onComplete: () => {
                            if (i === 1) {
                                this.isRolling = false;
                                if (this.onResult) this.onResult(this.diceResults[0], this.diceResults[1]);
                            }
                        }
                    });
                }
            }, 100);
        });
    }

    update() {
        this.dice.forEach((die, i) => {
            if (die.body && die.container) {
                die.container.x = die.body.position.x;
                die.container.y = die.body.position.y;
                die.container.rotation = die.body.angle;
                // Continuous 3D redraw during movement
                this.drawCube(i, die.body.angle);
            }
        });
    }
}

export const createGame = (containerId, onResult) => {
    const config = {
        type: Phaser.AUTO,
        parent: containerId,
        width: 160,
        height: 120,
        backgroundColor: '#1a472a',
        physics: {
            default: 'matter',
            matter: {
                gravity: { y: 2.0 }, // Balanced gravity for tumbling (was 6.0)
                enableSleeping: false,
                debug: false
            }
        },
        scene: DiceGame
    };

    const game = new Phaser.Game(config);
    
    // Pass callback to scene
    game.events.once('ready', () => {
        const scene = game.scene.getScene('DiceGame');
        scene.onResult = onResult;
    });

    return game;
};
