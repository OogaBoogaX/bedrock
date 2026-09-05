import { Box3, Group, Mesh, MeshStandardMaterial, PMREMGenerator, PointLight, Vector3, type Material, type Texture, type WebGLRenderer } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Character } from "./characters";
import { addRobRainScene } from "./rain";
import { addMrHodlSmokeScene } from "./smoke";

// Loaded on demand: only pages with a `data-model` viewport pay for GLTFLoader.

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<GLTF>>();

let env: Texture | null = null;

interface TimeUniform {
  value: number;
}

function antMaterial(source: Material, timeUniforms: TimeUniform[]): Material {
  const material = source.clone();
  if (!(material instanceof MeshStandardMaterial)) return material;

  material.color.set(0x080b09);
  material.metalness = Math.min(0.1, material.metalness);
  material.roughness = Math.max(0.62, material.roughness);
  const antTime = { value: 0 };
  timeUniforms.push(antTime);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.antTime = antTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vAntObjectPosition;\nvarying vec3 vAntObjectNormal;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvAntObjectPosition = position;\nvAntObjectNormal = normal;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float antTime;
varying vec3 vAntObjectPosition;
varying vec3 vAntObjectNormal;
float antHash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
}
float antRedEye(vec4 texel) {
  float redLead = texel.r - max(texel.g, texel.b);
  return smoothstep(0.018, 0.14, redLead) * smoothstep(0.38, 0.82, texel.r);
}
float antGlyphStream(vec2 surfacePoint, float seed) {
  float antColumn = floor((surfacePoint.x + 1.4) * 11.5);
  float antSpeed = 0.68 + antHash(vec2(antColumn, seed + 4.0)) * 0.72;
  vec2 antGrid = vec2(
    (surfacePoint.x + 1.4) * 11.5,
    (surfacePoint.y + 1.2) * 9.5 - antTime * antSpeed
  );
  vec2 antCell = floor(antGrid);
  vec2 antGlyphUv = fract(antGrid);
  vec2 antPixel = floor(antGlyphUv * vec2(4.0, 6.0));
  float antGlyph = step(0.6, antHash(antCell * 5.17 + antPixel * vec2(13.1, 7.7) + seed));
  float antGlyphBounds = step(0.09, antGlyphUv.x) * step(antGlyphUv.x, 0.91)
    * step(0.07, antGlyphUv.y) * step(antGlyphUv.y, 0.93);
  float antStreamStep = mod(
    antCell.y + floor(antHash(vec2(antColumn, seed + 9.0)) * 19.0),
    11.0
  );
  float antTrail = mix(0.16, 1.0, 1.0 - smoothstep(0.0, 7.5, antStreamStep))
    * mix(0.62, 1.0, step(antStreamStep, 0.75));
  return antGlyph * antGlyphBounds * antTrail;
}`,
      )
      .replace(
        "#include <map_fragment>",
        `float antEyeMask = 0.0;
float antEyeGlowMask = 0.0;
float antMatrixMask = 0.0;
#include <map_fragment>
#ifdef USE_MAP
  antEyeMask = antRedEye(sampledDiffuseColor);
  vec2 antEyeBlur = vec2(0.008, 0.0);
  antEyeGlowMask = antEyeMask;
  antEyeGlowMask = max(antEyeGlowMask, antRedEye(texture2D(map, vMapUv + antEyeBlur.xy)) * 0.82);
  antEyeGlowMask = max(antEyeGlowMask, antRedEye(texture2D(map, vMapUv - antEyeBlur.xy)) * 0.82);
  antEyeGlowMask = max(antEyeGlowMask, antRedEye(texture2D(map, vMapUv + antEyeBlur.yx)) * 0.82);
  antEyeGlowMask = max(antEyeGlowMask, antRedEye(texture2D(map, vMapUv - antEyeBlur.yx)) * 0.82);
  antEyeBlur = vec2(0.015, 0.0);
  antEyeGlowMask = max(antEyeGlowMask, antRedEye(texture2D(map, vMapUv + antEyeBlur.xy)) * 0.46);
  antEyeGlowMask = max(antEyeGlowMask, antRedEye(texture2D(map, vMapUv - antEyeBlur.xy)) * 0.46);
  antEyeGlowMask = max(antEyeGlowMask, antRedEye(texture2D(map, vMapUv + antEyeBlur.yx)) * 0.46);
  antEyeGlowMask = max(antEyeGlowMask, antRedEye(texture2D(map, vMapUv - antEyeBlur.yx)) * 0.46);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.006, 0.001), antEyeGlowMask * 0.92);
#endif

  // Keep the streams continuous over the crown instead of masking surfaces
  // whose normals point upward, and extend the height fade beyond the scalp.
  vec3 antNormal = normalize(vAntObjectNormal);
  float antRise = vAntObjectPosition.y - abs(vAntObjectPosition.z - 0.02) * 0.42;
  float antFrontBackStream = antGlyphStream(vec2(vAntObjectPosition.x, antRise), 17.0);
  float antSideStream = antGlyphStream(vec2(vAntObjectPosition.z, antRise), 53.0);
  float antProjectionBlend = abs(antNormal.z) / (abs(antNormal.x) + abs(antNormal.z) + 0.001);
  float antSurfaceStream = mix(antSideStream, antFrontBackStream, antProjectionBlend);
  float antBust = 1.0 - smoothstep(1.16, 1.3, vAntObjectPosition.y);
  antMatrixMask = antSurfaceStream * antBust * (1.0 - max(antEyeMask, antEyeGlowMask * 0.62));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.015, 1.0, 0.08), antMatrixMask * 0.84);
`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
float antEyePulse = 0.92 + sin(antTime * 3.2) * 0.08;
totalEmissiveRadiance += vec3(10.0, 0.006, 0.001) * antEyeMask * antEyePulse;
totalEmissiveRadiance += vec3(4.0, 0.003, 0.0005) * max(0.0, antEyeGlowMask - antEyeMask * 0.42) * antEyePulse;
totalEmissiveRadiance += vec3(0.01, 1.75, 0.055) * antMatrixMask;`,
      );
  };
  material.customProgramCacheKey = () => "ant-black-matrix-red-eyes-v8";
  material.needsUpdate = true;
  return material;
}

function styleAnt(model: Group, container: Group): (t: number) => void {
  const timeUniforms: TimeUniform[] = [];
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => antMaterial(material, timeUniforms))
      : antMaterial(object.material, timeUniforms);
  });

  for (const x of [-0.17, 0.17]) {
    const eyeGlow = new PointLight(0xff1003, 6.5, 1.05, 2);
    eyeGlow.position.set(x, 0.38, 0.62);
    container.add(eyeGlow);
  }
  return (t) => timeUniforms.forEach((uniform) => (uniform.value = t));
}

function styleRulesBust(model: Group): void {
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const tone = (source: Material): Material => {
      const material = source.clone();
      if (!(material instanceof MeshStandardMaterial)) return material;
      material.color.set(0xffffff);
      material.roughness = Math.max(0.84, material.roughness);
      material.metalness = Math.min(0.08, material.metalness);
      material.envMapIntensity = 0.28;
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `#include <map_fragment>
float rulesTone = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
float rulesMid = smoothstep(0.24, 0.56, rulesTone);
float rulesHighlight = smoothstep(0.58, 0.82, rulesTone);
vec3 rulesGrade = mix(vec3(0.012), vec3(0.18), rulesMid);
rulesGrade = mix(rulesGrade, vec3(0.82), rulesHighlight);
diffuseColor.rgb = rulesGrade;`,
        );
      };
      material.customProgramCacheKey = () => "rules-high-contrast-ink-v1";
      material.needsUpdate = true;
      return material;
    };
    object.material = Array.isArray(object.material) ? object.material.map(tone) : tone(object.material);
  });
}

function styleMrHodl(model: Group, container: Group): void {
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const grade = (source: Material): Material => {
      const material = source.clone();
      if (!(material instanceof MeshStandardMaterial)) return material;
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <map_fragment>",
            `float mrHodlBadge = 0.0;
#include <map_fragment>
float mrHodlTone = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
float mrHodlGreenLead = diffuseColor.g - max(diffuseColor.r, diffuseColor.b);
mrHodlBadge = smoothstep(0.025, 0.16, mrHodlGreenLead) * smoothstep(0.18, 0.58, diffuseColor.g);
float mrHodlCloth = (1.0 - smoothstep(0.34, 0.64, mrHodlTone)) * (1.0 - mrHodlBadge);
diffuseColor.rgb *= mix(vec3(1.0), vec3(0.78, 0.80, 0.79), mrHodlCloth);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.015, 1.0, 0.085), mrHodlBadge * 0.92);`,
          )
          .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(0.008, 4.8, 0.055) * mrHodlBadge;`,
          );
      };
      material.customProgramCacheKey = () => "mrhodl-dark-cloth-neon-badge-v1";
      material.needsUpdate = true;
      return material;
    };
    object.material = Array.isArray(object.material) ? object.material.map(grade) : grade(object.material);
  });

  const badgeGlow = new PointLight(0x20ff55, 0.9, 0.46, 2);
  badgeGlow.position.set(-0.48, -0.03, 0.62);
  container.add(badgeGlow);
}

// PBR materials need an environment to read as anything but mud; one shared room map.
export function environment(renderer: WebGLRenderer): Texture {
  if (env) return env;
  const pmrem = new PMREMGenerator(renderer);
  renderer.setScissorTest(false);
  env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  renderer.setScissorTest(true);
  pmrem.dispose();
  return env;
}

// Centers the asset and fits it to the same ~2.1 unit envelope as the procedural characters.
export async function loadModel(url: string): Promise<Character> {
  let pending = cache.get(url);
  if (!pending) {
    pending = loader.loadAsync(url);
    cache.set(url, pending);
  }
  const gltf = await pending;
  const model = gltf.scene.clone();
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const scale = 2.1 / Math.max(size.x, size.y, size.z);
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

  const g = new Group();
  g.add(model);
  const fittedBox = new Box3().setFromObject(model);
  if (url.endsWith("/rules-without-rulers.glb")) styleRulesBust(model);
  if (url.endsWith("/mrhodlx.glb")) styleMrHodl(model, g);
  const updateAnt = url.endsWith("/2140data.glb") ? styleAnt(model, g) : null;
  const updateRobRain = url.endsWith("/rob1ham.glb") ? addRobRainScene(g, fittedBox.min.y) : null;
  const updateMrHodlSmoke = url.endsWith("/mrhodlx.glb") ? addMrHodlSmokeScene(g, fittedBox) : null;
  return {
    group: g,
    update: (t) => {
      g.position.y = updateRobRain || updateMrHodlSmoke ? 0 : Math.sin(t * 1.7) * 0.04;
      updateAnt?.(t);
      updateRobRain?.(t);
      updateMrHodlSmoke?.(t);
    },
  };
}
