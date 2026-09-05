import {
  Box3,
  Group,
  NormalBlending,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";

interface SmokeParticle {
  sprite: Sprite;
  material: SpriteMaterial;
  phase: number;
  rate: number;
  seed: number;
  x: number;
  z: number;
  drift: number;
  lift: number;
  size: number;
  spin: number;
}

let smokeTexture: Texture | null = null;

function texture(): Texture {
  if (smokeTexture) return smokeTexture;
  smokeTexture = new TextureLoader().load("/img/mrhodlx-smoke.webp");
  smokeTexture.colorSpace = SRGBColorSpace;
  return smokeTexture;
}

function sequence(index: number, salt: number): number {
  return ((Math.sin(index * 83.17 + salt * 41.93) * 43758.5453) % 1 + 1) % 1;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return x * x * (3 - 2 * x);
}

/** Adds a buoyant bank of smoke that rotates with the fitted MrHodlX model. */
export function addMrHodlSmokeScene(container: Group, bounds: Box3): (time: number) => void {
  const smokeField = new Group();
  container.add(smokeField);

  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;
  const depth = bounds.max.z - bounds.min.z;

  const particles: SmokeParticle[] = Array.from({ length: 38 }, (_, index) => {
    const material = new SpriteMaterial({
      map: texture(),
      color: index % 5 === 0 ? 0x9da9a3 : 0xc2cbc7,
      transparent: true,
      opacity: 0,
      depthTest: true,
      depthWrite: false,
      blending: NormalBlending,
      fog: false,
    });
    const sprite = new Sprite(material);
    sprite.center.set(0.5, 0.5);
    sprite.frustumCulled = false;
    sprite.renderOrder = 2;
    smokeField.add(sprite);
    return {
      sprite,
      material,
      phase: sequence(index, 1),
      rate: 0.075 + sequence(index, 2) * 0.055,
      seed: sequence(index, 3) * Math.PI * 2,
      x: (sequence(index, 4) - 0.5) * width * 1.42,
      z: (sequence(index, 5) - 0.5) * depth * 1.45,
      drift: (sequence(index, 6) - 0.5) * width * 0.3,
      lift: 0.76 + sequence(index, 7) * 0.46,
      size: 0.72 + sequence(index, 8) * 0.54,
      spin: (sequence(index, 9) - 0.5) * 0.3,
    };
  });

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (time) => {
    const t = reducedMotion ? 2.6 : time;
    for (const particle of particles) {
      const age = (t * particle.rate + particle.phase) % 1;
      const buoyancy = age * age;
      const spread = 0.018 + age * width * 0.115;
      const curl = particle.seed + age * (Math.PI * 3.6);
      const turbulentX = Math.sin(curl) * spread + Math.sin(curl * 0.51 + 1.7) * spread * 0.38;
      const turbulentY = Math.cos(curl * 0.69) * spread * 0.28;
      const turbulentZ = Math.cos(curl * 0.91 + 0.6) * spread * 0.52;

      particle.sprite.position.set(
        particle.x + particle.drift * age + turbulentX,
        bounds.min.y + height * 0.02 + buoyancy * height * 0.76 * particle.lift + turbulentY,
        particle.z + turbulentZ,
      );

      const scale = (0.08 + smoothstep(0.02, 1, age) * width * 0.3) * particle.size;
      particle.sprite.scale.set(scale, scale * (0.82 + age * 0.28), 1);
      particle.material.rotation = particle.seed + t * particle.spin + age * 1.4;

      const form = smoothstep(0.015, 0.11, age);
      const dissipate = 1 - smoothstep(0.58, 1, age);
      const densityVariation = 0.72 + Math.sin(particle.seed * 2.3) * 0.14;
      particle.material.opacity = form * dissipate * densityVariation * 0.24;
      particle.sprite.visible = particle.material.opacity > 0.002;
    }
  };
}
