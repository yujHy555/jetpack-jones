import * as THREE from 'three';
import { Player } from './Player';
import { ObstacleManager } from '../level/Obstacles';

export enum MeteorType {
  ROCK = 'rock',
  CRYSTAL = 'crystal',
}

interface MeteorParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  maxLife: number;
  active: boolean;
  baseScale: number;
  type: MeteorType;
}

export interface ActiveMeteor {
  group: THREE.Group;
  coreMesh: THREE.Mesh;
  type: MeteorType;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotationSpeed: THREE.Vector3;
  radius: number;
  active: boolean;
  pointLight: THREE.PointLight;
  age: number;
}

export interface MeteorShrapnel {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  radius: number;
  damage: number;
  age: number;
  maxLife: number;
  active: boolean;
  type: MeteorType;
}

export interface ScorchedCrater {
  mesh: THREE.Mesh;
  age: number;
  maxLife: number;
  active: boolean;
}

/**
 * AAA Random Meteor System
 * Spawns Rock & Crystal Meteors falling from the cosmos with luminous tails.
 * Shatters on impact into lethal shrapnel that harms both player and enemies,
 * leaving behind realistic scorched-earth impact craters.
 */
export class MeteorManager {
  private scene: THREE.Scene;
  public meteors: ActiveMeteor[] = [];
  public shrapnelList: MeteorShrapnel[] = [];
  public craters: ScorchedCrater[] = [];
  private particles: MeteorParticle[] = [];

  private spawnCooldown: number = 60.0;
  private spawnTimer: number = 45.0;
  public onSedimentWarning?: () => void;
  private warningTriggered: boolean = false;

  // Materials Cache
  private rockMat: THREE.MeshStandardMaterial;
  private magmaMat: THREE.MeshBasicMaterial;
  private crystalMats: THREE.MeshStandardMaterial[] = [];
  private crystalGlowMats: THREE.MeshBasicMaterial[] = [];
  private scorchMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Rock meteor materials: Dark basalt asteroid with incandescent fiery veins
    this.rockMat = new THREE.MeshStandardMaterial({
      color: 0x1a1614,
      roughness: 0.88,
      metalness: 0.15,
    });
    this.magmaMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
    });

    // Crystal meteor materials: Electric celestial amethyst, cosmic cyan, and alien emerald
    const crystalColors = [0xdd00ff, 0x00f5ff, 0x00ff88];
    const crystalEmissive = [0x9900cc, 0x00aacc, 0x00cc66];
    for (let c = 0; c < 3; c++) {
      this.crystalMats.push(
        new THREE.MeshStandardMaterial({
          color: crystalColors[c],
          emissive: crystalEmissive[c],
          emissiveIntensity: 1.8,
          roughness: 0.12,
          metalness: 0.45,
          transparent: true,
          opacity: 0.92,
        })
      );
      this.crystalGlowMats.push(
        new THREE.MeshBasicMaterial({
          color: crystalColors[c],
          transparent: true,
          opacity: 0.85,
        })
      );
    }

    // Scorched Earth crater material: Pitch black burned soot with glowing scorched ember rim
    this.scorchMat = new THREE.MeshBasicMaterial({
      color: 0x0a0706,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });

    // Pre-allocate pools
    this.initPools();
  }

  private initPools() {
    // Shrapnel Pool (Organic shards & glowing fragments)
    const tetraGeo = new THREE.TetrahedronGeometry(0.12, 0);
    const octaGeo = new THREE.OctahedronGeometry(0.11, 0);

    for (let i = 0; i < 48; i++) {
      const isRock = i % 2 === 0;
      const mat = isRock
        ? new THREE.MeshStandardMaterial({
            color: 0x241d1a,
            emissive: 0xff3300,
            emissiveIntensity: 1.4,
            roughness: 0.5,
          })
        : new THREE.MeshBasicMaterial({
            color: i % 4 === 0 ? 0x00ffff : 0xff00cc,
            transparent: true,
            opacity: 0.95,
          });

      const mesh = new THREE.Mesh(isRock ? tetraGeo : octaGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);

      this.shrapnelList.push({
        mesh,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        rotSpeed: new THREE.Vector3(),
        radius: 0.14,
        damage: 22,
        age: 0,
        maxLife: 1.4,
        active: false,
        type: isRock ? MeteorType.ROCK : MeteorType.CRYSTAL,
      });
    }

    // Scorched Crater Pool (Persistent ground decals)
    const craterGeo = new THREE.CircleGeometry(0.55, 16);
    craterGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < 20; i++) {
      const mesh = new THREE.Mesh(craterGeo, this.scorchMat.clone());
      mesh.visible = false;
      this.scene.add(mesh);

      this.craters.push({
        mesh,
        age: 0,
        maxLife: 5.0, // Fades away cleanly after 5 seconds
        active: false,
      });
    }

    // AAA Tail Particle Pool
    const puffGeo = new THREE.SphereGeometry(0.14, 8, 8);
    for (let i = 0; i < 60; i++) {
      const pMat = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(puffGeo, pMat);
      mesh.visible = false;
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(),
        age: 0,
        maxLife: 0.45,
        active: false,
        baseScale: 1.0,
        type: MeteorType.ROCK,
      });
    }
  }

  /**
   * Spawns a dramatic rock or crystal meteor falling from high in the sky
   */
  public spawnMeteor(targetX: number, explicitType?: MeteorType) {
    const type = explicitType !== undefined
      ? explicitType
      : (Math.random() < 0.55 ? MeteorType.ROCK : MeteorType.CRYSTAL);

    const group = new THREE.Group();

    // Spawn high above player view
    const spawnX = targetX + 4.0 + (Math.random() - 0.4) * 16.0;
    const spawnY = 14.5 + Math.random() * 4.0;
    group.position.set(spawnX, spawnY, 0);

    let coreMesh: THREE.Mesh;
    const radius = type === MeteorType.ROCK ? 0.38 : 0.34;

    if (type === MeteorType.ROCK) {
      // Craggy Volcanic Asteroid Core
      const rockGeo = new THREE.DodecahedronGeometry(radius, 1);
      // Organic craggy vertex displacement
      const posAttr = rockGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const vz = posAttr.getZ(i);
        const displace = 0.88 + Math.random() * 0.24;
        posAttr.setXYZ(i, vx * displace, vy * displace, vz * displace);
      }
      rockGeo.computeVertexNormals();

      coreMesh = new THREE.Mesh(rockGeo, this.rockMat);
      group.add(coreMesh);

      // Glowing Magma Fissures
      const fissureGeo = new THREE.IcosahedronGeometry(radius * 0.86, 0);
      const fissure = new THREE.Mesh(fissureGeo, this.magmaMat);
      group.add(fissure);
    } else {
      // Prismatic Faceted Alien Crystal Cluster
      const cIdx = Math.floor(Math.random() * this.crystalMats.length);
      const crystalGeo = new THREE.OctahedronGeometry(radius, 0);
      coreMesh = new THREE.Mesh(crystalGeo, this.crystalMats[cIdx]);
      group.add(coreMesh);

      // Radiating Crystal Spikes
      for (let s = 0; s < 5; s++) {
        const spikeGeo = new THREE.ConeGeometry(0.12, 0.42, 5);
        spikeGeo.rotateX(Math.PI / 2);
        const spike = new THREE.Mesh(spikeGeo, this.crystalGlowMats[cIdx]);
        spike.position.set(
          (Math.random() - 0.5) * 0.25,
          (Math.random() - 0.5) * 0.25,
          (Math.random() - 0.5) * 0.25
        );
        spike.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        group.add(spike);
      }
    }

    // Dynamic Point Light illuminating the descent path
    const lightColor = type === MeteorType.ROCK ? 0xff5500 : 0x00f5ff;
    const pointLight = new THREE.PointLight(lightColor, 24, 18, 1.2);
    group.add(pointLight);

    this.scene.add(group);

    // Fast, angled downward trajectory
    const vx = -(3.5 + Math.random() * 4.5);
    const vy = -(15.0 + Math.random() * 7.0);

    this.meteors.push({
      group,
      coreMesh,
      type,
      position: new THREE.Vector3(spawnX, spawnY, 0),
      velocity: new THREE.Vector3(vx, vy, 0),
      rotationSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 8.0,
        (Math.random() - 0.5) * 8.0,
        (Math.random() - 0.5) * 8.0
      ),
      radius,
      active: true,
      pointLight,
      age: 0,
    });
  }

  public update(
    dt: number,
    player: Player,
    obstacleManager: ObstacleManager,
    onShatterAudio?: (type: MeteorType) => void
  ) {
    // 1. Random Meteor Spawner
    this.spawnTimer -= dt;
    // Warning 2.5s before meteor impact: Soft radio crackle + "Warning - incoming planet sediment"
    if (this.spawnTimer <= 2.5 && !this.warningTriggered) {
      this.warningTriggered = true;
      if (this.onSedimentWarning) {
        this.onSedimentWarning();
      }
    }
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 60.0 + (Math.random() - 0.5) * 8.0; // ~1 every 60 seconds
      this.warningTriggered = false;
      this.spawnMeteor(player.position.x);
    }

    const platforms = obstacleManager.getPlatforms();

    // 2. Update Active Meteors
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      if (!m.active) {
        this.scene.remove(m.group);
        this.meteors.splice(i, 1);
        continue;
      }

      m.age += dt;
      m.position.addScaledVector(m.velocity, dt);
      m.group.position.copy(m.position);

      m.coreMesh.rotation.x += m.rotationSpeed.x * dt;
      m.coreMesh.rotation.y += m.rotationSpeed.y * dt;
      m.coreMesh.rotation.z += m.rotationSpeed.z * dt;

      // Spawn AAA Tail Particles
      this.emitTailParticles(m.position, m.velocity, m.type);

      // Check Collision with Ground Floor (Y <= -3.70)
      let collided = false;
      let hitSurfaceY = -3.70;

      if (m.position.y - m.radius <= -3.70) {
        collided = true;
        hitSurfaceY = -3.70;
      }

      // Check Collision with Platforms
      if (!collided) {
        for (const plat of platforms) {
          const platTop = plat.y + plat.height / 2;
          const platBottom = plat.y - plat.height / 2;
          const platLeft = plat.x - plat.width / 2;
          const platRight = plat.x + plat.width / 2;

          if (
            m.position.x >= platLeft - m.radius &&
            m.position.x <= platRight + m.radius &&
            m.position.y - m.radius <= platTop &&
            m.position.y + m.radius >= platBottom
          ) {
            collided = true;
            hitSurfaceY = platTop;
            break;
          }
        }
      }

      // Check Collision with Cover Barriers, Pistons, Crates
      if (!collided) {
        for (const obs of obstacleManager.obstacles) {
          if (!obs.active) continue;
          if (obs.collider.type === 'box' && obs.collider.halfSize && obs.collider.center) {
            const h = obs.collider.halfSize;
            const c = obs.collider.center;
            if (
              Math.abs(m.position.x - c.x) < h.x + m.radius &&
              Math.abs(m.position.y - c.y) < h.y + m.radius
            ) {
              collided = true;
              hitSurfaceY = c.y + h.y;
              if (obs.destructible) {
                obs.health -= 3;
                if (obs.health <= 0) obstacleManager.removeObstacle(obs);
              }
              break;
            }
          }
        }
      }

      // Check Collision with Physics Crates
      if (!collided) {
        for (const crate of obstacleManager.crates) {
          if (!crate.active || crate.isDestroyed) continue;
          if (
            Math.abs(m.position.x - crate.position.x) < crate.halfW + m.radius &&
            Math.abs(m.position.y - crate.position.y) < crate.halfH + m.radius
          ) {
            collided = true;
            hitSurfaceY = crate.position.y + crate.halfH;
            crate.takeDamage(100);
            break;
          }
        }
      }

      // Meteors do NOT affect enemies at all (pass through without damage)

      // Check Direct Impact with Player
      if (!collided) {
        const pHeight = player.isCrouching ? 1.10 : 1.85;
        const pCenterY = player.position.y + pHeight / 2;
        const pDistSq = (m.position.x - player.position.x) ** 2 + (m.position.y - pCenterY) ** 2;
        const pRadius = player.shieldActive ? 1.65 : player.radius;

        if (pDistSq < (m.radius + pRadius) ** 2) {
          collided = true;
          hitSurfaceY = player.position.y;
          if (player.shieldActive) {
            player.takeDamage(0, m.velocity.x > 0 ? 1 : -1);
            if (player.onShieldDeflect) player.onShieldDeflect();
          } else {
            player.takeDamage(40, m.velocity.x > 0 ? 1 : -1);
          }
        }
      }

      if (collided || m.position.y < -5.0) {
        m.active = false;
        if (collided) {
          // Strictly verify solid surface underneath (NEVER spawn craters floating in mid-air!)
          const isSolidGround = Math.abs(hitSurfaceY - (-3.70)) < 0.15;
          const isSolidPlatform = platforms.some(p => {
            const platTop = p.y + p.height / 2;
            const platLeft = p.x - p.width / 2;
            const platRight = p.x + p.width / 2;
            return Math.abs(hitSurfaceY - platTop) < 0.20 && m.position.x >= platLeft - 0.2 && m.position.x <= platRight + 0.2;
          });
          const canSpawnCrater = isSolidGround || isSolidPlatform;

          this.shatterMeteor(m.position.x, hitSurfaceY, m.type, onShatterAudio, canSpawnCrater);
        }
      }
    }

    // 3. Update Shrapnel (Flying lethal debris)
    for (const sh of this.shrapnelList) {
      if (!sh.active) continue;

      sh.age += dt;
      if (sh.age >= sh.maxLife) {
        sh.active = false;
        sh.mesh.visible = false;
        continue;
      }

      sh.velocity.y -= 22.0 * dt; // Gravity
      sh.velocity.x *= 0.985;
      sh.position.addScaledVector(sh.velocity, dt);
      sh.mesh.position.copy(sh.position);
      sh.mesh.rotation.x += sh.rotSpeed.x * dt;
      sh.mesh.rotation.y += sh.rotSpeed.y * dt;

      // Bounce on ground
      if (sh.position.y <= -3.70) {
        sh.position.y = -3.70;
        sh.velocity.y = -sh.velocity.y * 0.45;
      }

      // Lethal Shrapnel vs Player
      const pHeight = player.isCrouching ? 1.10 : 1.85;
      const pCenterY = player.position.y + pHeight / 2;
      const pDistSq = (sh.position.x - player.position.x) ** 2 + (sh.position.y - pCenterY) ** 2;

      if (pDistSq < (sh.radius + (player.shieldActive ? 1.65 : 0.45)) ** 2) {
        if (player.shieldActive) {
          // Deflected by forcefield
          sh.velocity.x = -sh.velocity.x * 1.5;
          sh.velocity.y = Math.abs(sh.velocity.y) + 4;
          player.emitSparks(sh.position.x, sh.position.y, 0, 4);
        } else if (player.invulnerableTime <= 0) {
          player.takeDamage(sh.damage, sh.velocity.x > 0 ? 1 : -1);
          sh.active = false;
          sh.mesh.visible = false;
        }
      }

      // Shrapnel does NOT affect enemies at all (player and environment only)
    }

    // 4. Update Scorched Earth Craters
    for (const c of this.craters) {
      if (!c.active) continue;
      c.age += dt;
      if (c.age >= c.maxLife) {
        c.active = false;
        c.mesh.visible = false;
        continue;
      }
      // Smooth fade away over the last 1.8 seconds of the 5.0-second lifespan
      if (c.age > c.maxLife - 1.8) {
        const fade = Math.max(0, (c.maxLife - c.age) / 1.8);
        (c.mesh.material as THREE.MeshBasicMaterial).opacity = 0.82 * fade;
      }
    }

    // 5. Update Tail Particles
    for (const p of this.particles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.mesh.position.addScaledVector(p.velocity, dt);
      const prog = p.age / p.maxLife;
      const s = p.baseScale * (1.0 + prog * 1.8);
      p.mesh.scale.set(s, s, s);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = (1.0 - prog) * 0.75;
    }
  }

  /**
   * Shatters the meteor into high-speed lethal debris & leaves behind scorched earth
   */
  private shatterMeteor(
    x: number,
    y: number,
    type: MeteorType,
    onShatterAudio?: (type: MeteorType) => void,
    canSpawnCrater: boolean = false
  ) {
    if (onShatterAudio) onShatterAudio(type);

    // 1. Spawn Scorched Earth crater mark ONLY if on a solid platform/ground surface!
    if (canSpawnCrater) {
      const crater = this.craters.find(c => !c.active);
      if (crater) {
        crater.active = true;
        crater.age = 0;
        crater.mesh.position.set(x, y + 0.015, -0.2);
        const craterScale = 1.0 + Math.random() * 0.35;
        crater.mesh.scale.set(craterScale, craterScale, craterScale);
        (crater.mesh.material as THREE.MeshBasicMaterial).opacity = 0.82;
        crater.mesh.visible = true;
      }
    }

    // 2. Burst lethal shrapnel outwards
    const shardCount = 14;
    for (let i = 0; i < shardCount; i++) {
      const sh = this.shrapnelList.find(s => !s.active);
      if (!sh) break;

      sh.active = true;
      sh.age = 0;
      sh.maxLife = 1.0 + Math.random() * 0.6;
      sh.type = type;
      sh.position.set(x + (Math.random() - 0.5) * 0.2, y + 0.1, (Math.random() - 0.5) * 0.2);

      // Radial explosive hemisphere trajectory
      const angle = (Math.PI * 0.1) + Math.random() * (Math.PI * 0.8);
      const speed = 11.0 + Math.random() * 12.0;
      sh.velocity.set(Math.cos(angle) * speed, Math.sin(angle) * speed, (Math.random() - 0.5) * 3.0);
      sh.rotSpeed.set(
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18
      );

      const scale = 0.8 + Math.random() * 0.6;
      sh.mesh.scale.set(scale, scale, scale);
      sh.mesh.visible = true;
    }
  }

  /**
   * Emits fiery smoke/ember or sparkling crystal tail particles along meteor path
   */
  private emitTailParticles(pos: THREE.Vector3, vel: THREE.Vector3, type: MeteorType) {
    for (let i = 0; i < 2; i++) {
      const p = this.particles.find(pt => !pt.active);
      if (!p) break;

      p.active = true;
      p.age = 0;
      p.type = type;
      p.maxLife = 0.35 + Math.random() * 0.25;
      p.baseScale = type === MeteorType.ROCK ? 0.9 : 0.65;

      p.mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.25,
        pos.y + (Math.random() - 0.5) * 0.25,
        pos.z + (Math.random() - 0.5) * 0.15
      );

      // Trailing backward along trajectory with expansion
      p.velocity.set(
        -vel.x * 0.15 + (Math.random() - 0.5) * 1.5,
        -vel.y * 0.12 + Math.random() * 2.0,
        (Math.random() - 0.5) * 1.0
      );

      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      if (type === MeteorType.ROCK) {
        mat.color.setHex(Math.random() < 0.6 ? 0xff4400 : 0xffaa00);
      } else {
        mat.color.setHex(Math.random() < 0.5 ? 0x00f5ff : 0xff00bb);
      }

      p.mesh.scale.set(p.baseScale, p.baseScale, p.baseScale);
      p.mesh.visible = true;
    }
  }

  public reset() {
    for (const m of this.meteors) {
      this.scene.remove(m.group);
    }
    this.meteors = [];

    for (const sh of this.shrapnelList) {
      sh.active = false;
      sh.mesh.visible = false;
    }
    for (const c of this.craters) {
      c.active = false;
      c.mesh.visible = false;
    }
    for (const p of this.particles) {
      p.active = false;
      p.mesh.visible = false;
    }
    this.spawnTimer = 45.0;
    this.warningTriggered = false;
  }
}
