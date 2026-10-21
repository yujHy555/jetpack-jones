import * as THREE from 'three';

interface SmokeParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  maxLife: number;
  scale: number;
  rotation: number;
  rotSpeed: number;
  active: boolean;
}

interface SparkParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  maxLife: number;
  active: boolean;
}

/**
 * Faux-Volumetric Jetpack Smoke & Fire Exhaust System
 * Uses spherical pseudo-normal lighting, dynamic thermal color ramp,
 * instanced particles, spark trails, and a real-time thruster PointLight.
 */
export class JetpackSmoke {
  public group: THREE.Group;
  public thrusterLight: THREE.PointLight;

  private maxSmokeParticles = 120;
  private smokeParticles: SmokeParticle[] = [];
  private smokeMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();

  private maxSparks = 75;
  private sparkParticles: SparkParticle[] = [];
  private sparkPoints: THREE.Points;
  private sparkGeo: THREE.BufferGeometry;
  private sparkPositions: Float32Array;
  private sparkColors: Float32Array;

  // Shader material for pseudo-volumetric shaded smoke puffs
  private smokeMaterial: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // 1. Dynamic Thruster Point Light
    this.thrusterLight = new THREE.PointLight(0xff7711, 0, 14, 1.2);
    this.thrusterLight.castShadow = false;
    scene.add(this.thrusterLight);

    // 2. Custom Faux-Volumetric Smoke Shader
    this.smokeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uLightPos: { value: new THREE.Vector3(0, 0, 0) },
        uTime: { value: 0 },
      },
      vertexShader: `
        attribute float aAge;
        attribute float aMaxLife;
        attribute float aScale;
        attribute float aRotation;

        varying vec2 vUv;
        varying float vNormalizedAge;
        varying vec3 vWorldPos;

        void main() {
          vUv = uv;
          vNormalizedAge = aAge / aMaxLife;

          // Compute billboarding rotation
          float cosR = cos(aRotation);
          float sinR = sin(aRotation);
          vec2 rotatedPos = vec2(
            position.x * cosR - position.y * sinR,
            position.x * sinR + position.y * cosR
          );

          // Apply instance matrix
          vec4 worldPos = instanceMatrix * vec4(rotatedPos * aScale, 0.0, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying float vNormalizedAge;
        varying vec3 vWorldPos;
        uniform vec3 uLightPos;

        void main() {
          // Circular puff mask with soft edge
          vec2 centerCoord = vUv * 2.0 - 1.0;
          float distSq = dot(centerCoord, centerCoord);
          if (distSq > 1.0) discard;

          // Spherical pseudo-normal calculation for 3D volumetric illusion
          float z = sqrt(max(0.0, 1.0 - distSq));
          vec3 normal = normalize(vec3(centerCoord, z * 1.5));

          // Direction from particle to nozzle light
          vec3 lightDir = normalize(uLightPos - vWorldPos);
          float lightDistance = length(uLightPos - vWorldPos);
          float lightAtten = 1.0 / (1.0 + lightDistance * 0.35);

          // Directional lighting on the spherical puff
          float diffuse = max(0.0, dot(normal, lightDir));
          float rim = pow(1.0 - z, 2.0) * 0.5;

          // Thermal Color Ramp based on particle age
          vec3 flameWhite = vec3(1.0, 0.95, 0.85);
          vec3 flameOrange = vec3(1.0, 0.45, 0.05);
          vec3 hotSmoke = vec3(0.65, 0.28, 0.12);
          vec3 darkSmoke = vec3(0.22, 0.18, 0.16);
          vec3 coolAsh = vec3(0.12, 0.11, 0.11);

          vec3 baseColor;
          float alpha = 1.0;

          if (vNormalizedAge < 0.12) {
            // White-hot core
            float t = vNormalizedAge / 0.12;
            baseColor = mix(flameWhite, flameOrange, t);
            baseColor *= 2.2; // Emissive glow
            alpha = 0.95;
          } else if (vNormalizedAge < 0.35) {
            // Fiery orange combustion
            float t = (vNormalizedAge - 0.12) / 0.23;
            baseColor = mix(flameOrange, hotSmoke, t);
            baseColor *= (1.8 - t * 0.8);
            alpha = 0.9;
          } else if (vNormalizedAge < 0.7) {
            // Billowing thick terracotta soot
            float t = (vNormalizedAge - 0.35) / 0.35;
            baseColor = mix(hotSmoke, darkSmoke, t);
            alpha = 0.85 - t * 0.25;
          } else {
            // Cooling ash dispersing into atmosphere
            float t = (vNormalizedAge - 0.7) / 0.3;
            baseColor = mix(darkSmoke, coolAsh, t);
            alpha = (1.0 - t) * 0.6;
          }

          // Apply volumetric self-shading & lighting
          vec3 litColor = baseColor * (0.45 + diffuse * 0.75 * lightAtten + rim * 0.3);

          // Soft feathered alpha circle
          float edgeAlpha = smoothstep(1.0, 0.55, distSq);
          gl_FragColor = vec4(litColor, alpha * edgeAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide
    });

    // Create instanced plane geometry for smoke puffs
    const quadGeo = new THREE.PlaneGeometry(1, 1);
    this.smokeMesh = new THREE.InstancedMesh(quadGeo, this.smokeMaterial, this.maxSmokeParticles);
    this.smokeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Custom instanced attributes
    const ages = new Float32Array(this.maxSmokeParticles);
    const maxLifes = new Float32Array(this.maxSmokeParticles);
    const scales = new Float32Array(this.maxSmokeParticles);
    const rotations = new Float32Array(this.maxSmokeParticles);

    quadGeo.setAttribute('aAge', new THREE.InstancedBufferAttribute(ages, 1));
    quadGeo.setAttribute('aMaxLife', new THREE.InstancedBufferAttribute(maxLifes, 1));
    quadGeo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
    quadGeo.setAttribute('aRotation', new THREE.InstancedBufferAttribute(rotations, 1));

    this.group.add(this.smokeMesh);

    // Initialize particle pool
    for (let i = 0; i < this.maxSmokeParticles; i++) {
      this.smokeParticles.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        age: 0,
        maxLife: 1.0,
        scale: 0.1,
        rotation: 0,
        rotSpeed: 0,
        active: false,
      });
    }

    // 3. Glowing Sparks Particle System
    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkPositions = new Float32Array(this.maxSparks * 3);
    this.sparkColors = new Float32Array(this.maxSparks * 3);

    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    this.sparkGeo.setAttribute('color', new THREE.BufferAttribute(this.sparkColors, 3));

    const sparkMat = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.sparkPoints = new THREE.Points(this.sparkGeo, sparkMat);
    this.group.add(this.sparkPoints);

    for (let i = 0; i < this.maxSparks; i++) {
      this.sparkParticles.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        age: 0,
        maxLife: 0.5,
        active: false,
      });
    }
  }

  /**
   * Spawns smoke puffs and sparks at nozzle locations
   */
  public emit(nozzlePos: THREE.Vector3, playerVelocityX: number, isThrusting: boolean, count: number = 3) {
    if (!isThrusting && Math.random() > 0.15) return; // Light idle smoke when coasting

    // Update dynamic light position and intensity
    this.thrusterLight.position.copy(nozzlePos);
    this.smokeMaterial.uniforms.uLightPos.value.copy(nozzlePos);

    if (isThrusting) {
      // High-intensity flickering thruster flame
      this.thrusterLight.intensity = 18 + Math.random() * 8;
      this.thrusterLight.distance = 15;
    } else {
      this.thrusterLight.intensity = 1.5;
      this.thrusterLight.distance = 6;
    }

    const emitCount = isThrusting ? count : 1;

    for (let c = 0; c < emitCount; c++) {
      // Find inactive smoke particle
      const p = this.smokeParticles.find(sp => !sp.active);
      if (p) {
        p.active = true;
        p.age = 0;
        p.maxLife = isThrusting ? (0.9 + Math.random() * 0.5) : 0.6;
        p.position.copy(nozzlePos);
        p.position.x += (Math.random() - 0.5) * 0.15;
        p.position.y += (Math.random() - 0.5) * 0.15;
        p.position.z += (Math.random() - 0.5) * 0.25;

        // Velocity: shoots backwards horizontally with upward buoyancy and turbulent spread
        const speed = isThrusting ? (4.5 + Math.random() * 2.5) : 1.5;
        p.velocity.set(
          -speed - playerVelocityX * 0.35,
          (Math.random() - 0.45) * 1.8,
          (Math.random() - 0.5) * 0.8
        );

        p.scale = isThrusting ? 0.35 : 0.2;
        p.rotation = Math.random() * Math.PI * 2;
        p.rotSpeed = (Math.random() - 0.5) * 3.5;
      }
    }

    // Sparks (only when actively thrusting)
    if (isThrusting) {
      for (let s = 0; s < 2; s++) {
        const spark = this.sparkParticles.find(sp => !sp.active);
        if (spark) {
          spark.active = true;
          spark.age = 0;
          spark.maxLife = 0.25 + Math.random() * 0.35;
          spark.position.copy(nozzlePos);
          spark.velocity.set(
            -(7.0 + Math.random() * 6.0) - playerVelocityX * 0.5,
            (Math.random() - 0.5) * 3.5,
            (Math.random() - 0.5) * 2.0
          );
        }
      }
    }
  }

  public update(dt: number) {
    this.smokeMaterial.uniforms.uTime.value += dt;

    const quadGeo = this.smokeMesh.geometry;
    const aAge = quadGeo.getAttribute('aAge') as THREE.InstancedBufferAttribute;
    const aMaxLife = quadGeo.getAttribute('aMaxLife') as THREE.InstancedBufferAttribute;
    const aScale = quadGeo.getAttribute('aScale') as THREE.InstancedBufferAttribute;
    const aRotation = quadGeo.getAttribute('aRotation') as THREE.InstancedBufferAttribute;

    // 1. Update Smoke Particles
    for (let i = 0; i < this.maxSmokeParticles; i++) {
      const p = this.smokeParticles[i];
      if (!p.active) {
        this.dummy.position.set(0, -9999, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.smokeMesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }

      p.age += dt;
      if (p.age >= p.maxLife) {
        p.active = false;
        continue;
      }

      // Drag and buoyancy
      p.velocity.x *= (1.0 - dt * 1.2);
      p.velocity.y += dt * 0.6; // Hot smoke rises gently
      p.position.addScaledVector(p.velocity, dt);

      // Expansion: smoke puffs grow significantly as they billow outward
      const progress = p.age / p.maxLife;
      const currentScale = p.scale + progress * 2.8;
      p.rotation += p.rotSpeed * dt;

      // Update transform matrix
      this.dummy.position.copy(p.position);
      this.dummy.scale.set(currentScale, currentScale, 1.0);
      this.dummy.updateMatrix();
      this.smokeMesh.setMatrixAt(i, this.dummy.matrix);

      // Update shader attributes
      aAge.setX(i, p.age);
      aMaxLife.setX(i, p.maxLife);
      aScale.setX(i, currentScale);
      aRotation.setX(i, p.rotation);
    }

    this.smokeMesh.instanceMatrix.needsUpdate = true;
    aAge.needsUpdate = true;
    aMaxLife.needsUpdate = true;
    aScale.needsUpdate = true;
    aRotation.needsUpdate = true;

    // 2. Update Sparks
    let sparkPosIdx = 0;
    let sparkColIdx = 0;

    for (let i = 0; i < this.maxSparks; i++) {
      const sp = this.sparkParticles[i];
      if (sp.active) {
        sp.age += dt;
        if (sp.age >= sp.maxLife) {
          sp.active = false;
        } else {
          sp.velocity.x *= (1.0 - dt * 2.5);
          sp.velocity.y += (Math.random() - 0.5) * 4.0 * dt;
          sp.position.addScaledVector(sp.velocity, dt);
        }
      }

      if (sp.active) {
        this.sparkPositions[sparkPosIdx] = sp.position.x;
        this.sparkPositions[sparkPosIdx + 1] = sp.position.y;
        this.sparkPositions[sparkPosIdx + 2] = sp.position.z;

        const progress = sp.age / sp.maxLife;
        // Bright golden spark fading to red-orange
        this.sparkColors[sparkColIdx] = 1.0;
        this.sparkColors[sparkColIdx + 1] = 0.85 - progress * 0.6;
        this.sparkColors[sparkColIdx + 2] = 0.2 * (1.0 - progress);
      } else {
        this.sparkPositions[sparkPosIdx] = 0;
        this.sparkPositions[sparkPosIdx + 1] = -9999;
        this.sparkPositions[sparkPosIdx + 2] = 0;
      }

      sparkPosIdx += 3;
      sparkColIdx += 3;
    }

    this.sparkGeo.getAttribute('position').needsUpdate = true;
    this.sparkGeo.getAttribute('color').needsUpdate = true;
  }
}
