import {
  AdditiveBlending,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  RingGeometry,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
} from "three";

interface Drop {
  x: number;
  z: number;
  phase: number;
  speed: number;
  length: number;
}

interface Ripple {
  drop: Drop;
  mesh: Mesh<RingGeometry, MeshBasicMaterial>;
}

function puddleGeometry(): CircleGeometry {
  const geometry = new CircleGeometry(1, 72);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    if (Math.hypot(x, y) < 0.01) continue;
    const angle = Math.atan2(y, x);
    const edge = 1 + Math.sin(angle * 5 + 0.7) * 0.055 + Math.sin(angle * 9 - 0.4) * 0.035;
    positions.setXYZ(i, x * edge * 1.02, y * edge * 0.66, 0);
  }
  positions.needsUpdate = true;
  return geometry;
}

function sequence(index: number, salt: number): number {
  return ((Math.sin(index * 91.73 + salt * 37.11) * 43758.5453) % 1 + 1) % 1;
}

/** Adds a rain-and-water diorama around the already fitted Rob model. */
export function addRobRainScene(container: Group, floorY: number): (time: number) => void {
  // Rob and the weather share the same rig. The puddle uses an unlit,
  // texture-driven material so rotating the scene cannot swing it through a
  // directional highlight and cause the old brightness strobe.
  const weather = new Group();
  container.add(weather);

  const surfaceMap = new TextureLoader().load("/img/rob-rain-water.webp");
  surfaceMap.colorSpace = SRGBColorSpace;
  surfaceMap.wrapS = RepeatWrapping;
  surfaceMap.wrapT = RepeatWrapping;
  surfaceMap.repeat.set(1.18, 1.18);
  const geometry = puddleGeometry();

  const wetGround = new Mesh(
    new PlaneGeometry(2.9, 2.15),
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `
        varying vec2 vWetUv;
        void main() {
          vWetUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vWetUv;
        void main() {
          vec2 wetPoint = (vWetUv - 0.5) * vec2(1.0, 1.32);
          float wetFade = 1.0 - smoothstep(0.34, 0.72, length(wetPoint));
          gl_FragColor = vec4(vec3(0.018, 0.024, 0.026), wetFade * 0.72);
        }
      `,
    }),
  );
  wetGround.rotation.x = -Math.PI / 2;
  wetGround.position.y = floorY - 0.002;
  weather.add(wetGround);

  const shoreline = new Mesh(
    geometry,
    new MeshBasicMaterial({
      color: 0x11191c,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: DoubleSide,
    }),
  );
  shoreline.rotation.x = -Math.PI / 2;
  shoreline.position.y = floorY + 0.003;
  shoreline.scale.set(1.02, 1.02, 1.02);
  weather.add(shoreline);

  const waterMaterial = new MeshBasicMaterial({
    color: 0xe8f0f2,
    map: surfaceMap,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    side: DoubleSide,
  });
  waterMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
// Lift the dark photographic texture without introducing a light direction.
// Its highlights rotate with the image, but their total brightness stays put.
diffuseColor.rgb = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(0.64)) * vec3(0.92, 0.98, 1.0);`,
    );
  };
  waterMaterial.customProgramCacheKey = () => "rob-stable-photographic-water-v1";
  const water = new Mesh(geometry.clone(), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.y = floorY + 0.012;
  water.renderOrder = 1;
  weather.add(water);

  const drops: Drop[] = Array.from({ length: 58 }, (_, index) => ({
    x: (sequence(index, 1) - 0.5) * 2.05,
    z: (sequence(index, 2) - 0.5) * 1.15,
    phase: sequence(index, 3),
    speed: 0.62 + sequence(index, 4) * 0.62,
    length: 0.72 + sequence(index, 5) * 0.7,
  }));
  const dropGeometry = new CylinderGeometry(0.003, 0.007, 0.145, 7, 1, true);
  const dropMaterial = new MeshPhysicalMaterial({
    color: 0xd9f6ff,
    roughness: 0.03,
    metalness: 0,
    transmission: 0.72,
    thickness: 0.025,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  const rain = new InstancedMesh(dropGeometry, dropMaterial, drops.length);
  rain.instanceMatrix.setUsage(DynamicDrawUsage);
  rain.frustumCulled = false;
  rain.renderOrder = 2;
  weather.add(rain);

  const ripples: Ripple[] = drops.slice(0, 14).map((drop) => {
    const material = new MeshBasicMaterial({
      color: 0xbdefff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
    const mesh = new Mesh(new RingGeometry(0.38, 0.48, 48), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(drop.x, floorY + 0.018, drop.z);
    mesh.renderOrder = 3;
    weather.add(mesh);
    return { drop, mesh };
  });

  const transform = new Object3D();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (time) => {
    const t = reducedMotion ? 1.75 : time;

    drops.forEach((drop, index) => {
      const cycle = (t * drop.speed + drop.phase) % 1;
      transform.position.set(drop.x, floorY + 0.08 + (1 - cycle) * 2.45, drop.z);
      transform.scale.set(1, drop.length, 1);
      transform.updateMatrix();
      rain.setMatrixAt(index, transform.matrix);
    });
    rain.instanceMatrix.needsUpdate = true;

    for (const { drop, mesh } of ripples) {
      const age = (t * drop.speed + drop.phase) % 1;
      const visible = age < 0.22 ? 1 - age / 0.22 : 0;
      const scale = 0.08 + age * 1.45;
      mesh.scale.setScalar(scale);
      mesh.material.opacity = visible * 0.46;
      mesh.visible = visible > 0;
    }
  };
}
