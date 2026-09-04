import { Box3, Group, PMREMGenerator, Vector3, type Texture, type WebGLRenderer } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Character } from "./characters";

// Loaded on demand: only pages with a `data-model` viewport pay for GLTFLoader.

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<GLTF>>();

let env: Texture | null = null;

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
  return {
    group: g,
    update: (t) => {
      g.position.y = Math.sin(t * 1.7) * 0.04;
    },
  };
}
