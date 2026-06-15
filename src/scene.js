import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { gsap } from "gsap";

import { sectionInfo } from "./data.js";

const MODEL_URL = "/models/desk.glb";
const CLICKABLE_NAMES = ["sony", "cdj", "macbook", "case"];
const NAMED_OBJECTS = [...CLICKABLE_NAMES, "table", "light"];

const lightingModes = {
  default: {
    key: "#f5f2e8",
    fill: "#9fa8b8",
    ambient: "#ffffff",
    keyIntensity: 4.6,
    fillIntensity: 1.25,
    ambientIntensity: 0.72,
    frontIntensity: 1.35,
  },
  video: {
    key: "#d8ecff",
    fill: "#7fa6d6",
    ambient: "#dcecff",
    keyIntensity: 5.2,
    fillIntensity: 1.45,
    ambientIntensity: 0.62,
    frontIntensity: 1.35,
  },
  events: {
    key: "#8370ff",
    fill: "#4a90e2",
    ambient: "#b5adff",
    keyIntensity: 4.9,
    fillIntensity: 1.7,
    ambientIntensity: 0.48,
    frontIntensity: 1.35,
  },
  web: {
    key: "#ffffff",
    fill: "#dce5f4",
    ambient: "#ffffff",
    keyIntensity: 5.4,
    fillIntensity: 1.25,
    ambientIntensity: 0.7,
    frontIntensity: 1.35,
  },
  contact: {
    key: "#d8b16a",
    fill: "#b58a4a",
    ambient: "#f4dcc0",
    keyIntensity: 5.0,
    fillIntensity: 1.35,
    ambientIntensity: 0.58,
    frontIntensity: 1.35,
  },
};

export async function createScene({ canvas, onProgress }) {
  RectAreaLightUniformsLib.init();

  const isMobileQuery = window.matchMedia("(max-width: 760px)");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobileQuery.matches,
    alpha: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobileQuery.matches ? 1.5 : 2));
  const initialViewport = getCanvasViewport(canvas);
  renderer.setSize(initialViewport.width, initialViewport.height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#050505");
  scene.fog = new THREE.FogExp2("#050505", 0.024);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 1000);
  const cameraTarget = new THREE.Vector3();
  const parallax = new THREE.Vector2();

  const ambientLight = new THREE.HemisphereLight("#ffffff", "#080808", 0.7);
  const softboxLight = new THREE.RectAreaLight("#f5f2e8", 4.6, 3.5, 2.4);
  const fillLight = new THREE.DirectionalLight("#9fa8b8", 1.25);
  const rimLight = new THREE.DirectionalLight("#ffffff", 1.1);
  const frontLight = new THREE.DirectionalLight("#eef4ff", 1.35);
  const contactWarmLight = new THREE.PointLight("#d8b16a", 0.75, 8, 2.2);

  fillLight.position.set(-4, 4, 3);
  rimLight.position.set(3, 3.2, -3.5);
  frontLight.position.set(0, 2.2, 4);
  contactWarmLight.position.set(-1.5, 1.5, 2);

  scene.add(
    ambientLight,
    softboxLight,
    fillLight,
    fillLight.target,
    rimLight,
    rimLight.target,
    frontLight,
    frontLight.target,
    contactWarmLight,
  );

  const loadingManager = new THREE.LoadingManager();
  loadingManager.onProgress = (_, loaded, total) => {
    onProgress?.(total ? loaded / total : 0);
  };

  const gltfLoader = new GLTFLoader(loadingManager);
  const dracoLoader = new DRACOLoader(loadingManager);
  dracoLoader.setDecoderPath("/draco/");
  dracoLoader.setDecoderConfig({ type: "wasm" });
  dracoLoader.preload();
  gltfLoader.setDRACOLoader(dracoLoader);

  const gltf = await gltfLoader.loadAsync(MODEL_URL);
  const modelRoot = gltf.scene;
  modelRoot.name = "portfolio-desk";
  prepareModel(modelRoot);
  modelRoot.rotation.set(Math.PI + 0.07, -Math.PI / 2, 0);
  scene.add(modelRoot);

  const modelBox = new THREE.Box3().setFromObject(modelRoot);
  const modelCenter = modelBox.getCenter(new THREE.Vector3());
  modelRoot.position.sub(modelCenter);
  modelRoot.updateWorldMatrix(true, true);

  const bounds = new THREE.Box3().setFromObject(modelRoot);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const namedObjects = collectNamedObjects(modelRoot);
  const clickableObjects = Object.fromEntries(
    CLICKABLE_NAMES.map((name) => [name, namedObjects[name]]).filter(([, object]) => object),
  );
  const originals = storeOriginalTransforms(namedObjects);
  const caseLid = namedObjects.case?.getObjectByName("case.001_pelican1120t_0") ?? null;
  const caseLidOriginal = caseLid ? copyTransform(caseLid) : null;

  addGroundPlane(scene, bounds, size);
  positionLights(
    namedObjects,
    softboxLight,
    fillLight,
    rimLight,
    frontLight,
    contactWarmLight,
    center,
    size,
  );
  setLightingMode("default");

  const initialCamera = getInitialCameraPosition(size, isMobileQuery.matches);
  const initialTarget = getInitialCameraTarget(size, isMobileQuery.matches);
  setInitialCameraUp(camera, isMobileQuery.matches);
  camera.position.copy(initialCamera);
  cameraTarget.copy(initialTarget);
  updateCameraAspect();

  const controller = {
    camera,
    scene,
    renderer,
    clickableObjects,
    start,
    setHover,
    focusObject,
    resetDesk,
    getObjectScreenPosition,
    setLightingMode,
  };

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", updateParallax, { passive: true });

  function start(onFrame) {
    renderer.setAnimationLoop(() => {
      if (!activeFocus) {
        camera.position.x += (initialCamera.x + parallax.x * size.x * 0.018 - camera.position.x) * 0.03;
        camera.position.y += (initialCamera.y + parallax.y * size.y * 0.018 - camera.position.y) * 0.03;
      }

      camera.lookAt(cameraTarget);
      renderer.render(scene, camera);
      onFrame?.();
    });
  }

  let currentHover = null;
  let activeFocus = null;

  function setHover(name) {
    if (currentHover === name) return;

    if (currentHover) {
      animateGroupHighlight(currentHover, false);
    }

    currentHover = name;

    if (!name) {
      return;
    }

    animateGroupHighlight(name, true);
  }

  function focusObject(name) {
    const selected = clickableObjects[name];
    if (!selected) return Promise.resolve();

    activeFocus = name;
    setHover(null);
    setLightingMode(sectionInfo[name]?.id ?? "default");

    const selectedCenter = getObjectCenter(selected);
    const selectedWorldPosition = selected.getWorldPosition(new THREE.Vector3());
    const focusCenter = getFocusCenter(name, size);
    const offset = focusCenter.clone().sub(selectedCenter);
    const targetWorldPosition = selectedWorldPosition.clone().add(offset);
    const targetLocalPosition = selected.parent.worldToLocal(targetWorldPosition.clone());
    const focusCamera = getFocusCameraPosition(name, focusCenter, size, isMobileQuery.matches);
    const focusTarget = getFocusCameraTarget(name, focusCenter, size);
    const focusUp = getFocusCameraUp();
    const focusRotation = getFocusRotation(name);
    const focusScale = getFocusScale(name);
    const table = namedObjects.table;
    const tableDrop = Math.max(size.y * 0.06, 0.08);
    const timeline = gsap.timeline({
      defaults: { duration: 1.5, ease: "power3.inOut" },
    });

    Object.keys(clickableObjects).forEach((objectName) => {
      if (objectName !== name) {
        animateGroupDim(objectName, true, 1.25);
      }
    });
    if (namedObjects.light) {
      animateObjectDim(namedObjects.light, true, 1.25, 0.16);
    }

    timeline.to(
      selected.position,
      {
        x: targetLocalPosition.x,
        y: targetLocalPosition.y,
        z: targetLocalPosition.z,
      },
      0,
    );
    timeline.to(
      selected.rotation,
      {
        x: originals[name].rotation.x + focusRotation.x,
        y: originals[name].rotation.y + focusRotation.y,
        z: originals[name].rotation.z + focusRotation.z,
      },
      0,
    );
    timeline.to(
      selected.scale,
      {
        x: originals[name].scale.x * focusScale,
        y: originals[name].scale.y * focusScale,
        z: originals[name].scale.z * focusScale,
      },
      0,
    );

    if (table && originals.table) {
      timeline.to(table.position, { y: originals.table.position.y - tableDrop }, 0);
    }

    if (name === "case" && caseLid && caseLidOriginal) {
      timeline.to(
        caseLid.rotation,
        {
          x: caseLidOriginal.rotation.x - 0.22,
          y: caseLidOriginal.rotation.y,
          z: caseLidOriginal.rotation.z,
        },
        0.16,
      );
    }

    timeline.to(camera.position, { x: focusCamera.x, y: focusCamera.y, z: focusCamera.z }, 0);
    timeline.to(cameraTarget, { x: focusTarget.x, y: focusTarget.y, z: focusTarget.z }, 0);
    timeline.to(camera.up, { x: focusUp.x, y: focusUp.y, z: focusUp.z }, 0);

    return promiseFromTimeline(timeline);
  }

  function resetDesk() {
    const timeline = gsap.timeline({
      defaults: { duration: 1.15, ease: "power3.inOut" },
      onComplete: () => {
        activeFocus = null;
      },
    });

    Object.entries(namedObjects).forEach(([name, object]) => {
      const original = originals[name];
      if (!object || !original) return;

      timeline.to(object.position, original.position, 0);
      timeline.to(
        object.rotation,
        {
          x: original.rotation.x,
          y: original.rotation.y,
          z: original.rotation.z,
        },
        0,
      );
      timeline.to(object.scale, original.scale, 0);
    });

    if (caseLid && caseLidOriginal) {
      timeline.to(
        caseLid.rotation,
        {
          x: caseLidOriginal.rotation.x,
          y: caseLidOriginal.rotation.y,
          z: caseLidOriginal.rotation.z,
        },
        0,
      );
    }

    Object.keys(clickableObjects).forEach((name) => {
      animateGroupDim(name, false, 0.95);
      animateGroupHighlight(name, false, 0.95);
    });
    if (namedObjects.light) {
      animateObjectDim(namedObjects.light, false, 0.95);
    }

    setLightingMode("default");
    timeline.to(camera.position, { x: initialCamera.x, y: initialCamera.y, z: initialCamera.z }, 0);
    timeline.to(cameraTarget, { x: initialTarget.x, y: initialTarget.y, z: initialTarget.z }, 0);
    timeline.to(camera.up, getInitialCameraUp(isMobileQuery.matches), 0);

    return promiseFromTimeline(timeline);
  }

  function setLightingMode(modeName) {
    const mode = getLightingMode(modeName, isMobileQuery.matches);
    const keyColor = new THREE.Color(mode.key);
    const fillColor = new THREE.Color(mode.fill);
    const ambientColor = new THREE.Color(mode.ambient);

    gsap.to(softboxLight.color, {
      r: keyColor.r,
      g: keyColor.g,
      b: keyColor.b,
      duration: 0.9,
      ease: "power2.out",
    });
    gsap.to(fillLight.color, {
      r: fillColor.r,
      g: fillColor.g,
      b: fillColor.b,
      duration: 0.9,
      ease: "power2.out",
    });
    gsap.to(ambientLight.color, {
      r: ambientColor.r,
      g: ambientColor.g,
      b: ambientColor.b,
      duration: 0.9,
      ease: "power2.out",
    });
    gsap.to(softboxLight, { intensity: mode.keyIntensity, duration: 0.9, ease: "power2.out" });
    gsap.to(fillLight, { intensity: mode.fillIntensity, duration: 0.9, ease: "power2.out" });
    gsap.to(ambientLight, { intensity: mode.ambientIntensity, duration: 0.9, ease: "power2.out" });
    gsap.to(frontLight, { intensity: mode.frontIntensity, duration: 0.9, ease: "power2.out" });
  }

  function animateGroupHighlight(name, active, duration = 0.25) {
    const group = clickableObjects[name];
    if (!group) return;

    const accent = new THREE.Color(sectionInfo[name]?.accent ?? "#4a90e2");

    forEachMaterial(group, (material) => {
      const original = material.userData.originalMaterial;
      if (!original) return;

      if (material.color) {
        gsap.to(material.color, {
          r: active ? Math.min(original.color.r * 1.25 + accent.r * 0.12, 1) : original.color.r,
          g: active ? Math.min(original.color.g * 1.25 + accent.g * 0.12, 1) : original.color.g,
          b: active ? Math.min(original.color.b * 1.25 + accent.b * 0.12, 1) : original.color.b,
          duration,
          ease: "power2.out",
        });
      }

      if (material.emissive) {
        gsap.to(material.emissive, {
          r: active ? accent.r : original.emissive.r,
          g: active ? accent.g : original.emissive.g,
          b: active ? accent.b : original.emissive.b,
          duration,
          ease: "power2.out",
        });
        gsap.to(material, {
          emissiveIntensity: active ? 0.18 : original.emissiveIntensity,
          duration,
          ease: "power2.out",
        });
      }
    });
  }

  function animateGroupDim(name, active, duration = 0.6) {
    const group = clickableObjects[name];
    if (!group) return;

    animateObjectDim(group, active, duration);
  }

  function animateObjectDim(object, active, duration = 0.6, dimOpacity = 0.26) {
    forEachMaterial(object, (material) => {
      const original = material.userData.originalMaterial;
      if (!original) return;

      material.transparent = active || original.transparent || original.opacity < 1;
      gsap.to(material, {
        opacity: active ? Math.min(original.opacity, dimOpacity) : original.opacity,
        duration,
        ease: "power2.out",
        onComplete: () => {
          if (!active) {
            material.transparent = original.transparent || original.opacity < 1;
          }
        },
      });

      if (material.color) {
        gsap.to(material.color, {
          r: active ? original.color.r * 0.32 : original.color.r,
          g: active ? original.color.g * 0.32 : original.color.g,
          b: active ? original.color.b * 0.32 : original.color.b,
          duration,
          ease: "power2.out",
        });
      }
    });
  }

  function getObjectScreenPosition(name) {
    const object = clickableObjects[name];
    if (!object) return null;

    const worldPosition = getObjectCenter(object);
    worldPosition.project(camera);

    return {
      x: (worldPosition.x * 0.5 + 0.5) * canvas.clientWidth,
      y: (-worldPosition.y * 0.5 + 0.5) * canvas.clientHeight,
    };
  }

  function resize() {
    const mobile = isMobileQuery.matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    const viewport = getCanvasViewport(canvas);
    renderer.setSize(viewport.width, viewport.height, false);
    updateCameraAspect();

    if (!activeFocus) {
      initialCamera.copy(getInitialCameraPosition(size, mobile));
      initialTarget.copy(getInitialCameraTarget(size, mobile));
      setInitialCameraUp(camera, mobile);
      camera.position.copy(initialCamera);
      cameraTarget.copy(initialTarget);
    }
  }

  function updateCameraAspect() {
    const { width, height } = getCanvasViewport(canvas);
    camera.aspect = width / height;
    camera.fov = isMobileQuery.matches ? 48 : 34;
    camera.updateProjectionMatrix();
  }

  function updateParallax(event) {
    if (activeFocus || isMobileQuery.matches) return;
    parallax.x = (event.clientX / window.innerWidth - 0.5) * 2;
    parallax.y = -(event.clientY / window.innerHeight - 0.5) * 2;
  }

  return controller;
}

function collectNamedObjects(root) {
  return Object.fromEntries(
    NAMED_OBJECTS.map((name) => [name, root.getObjectByName(name)]).filter(([, object]) => object),
  );
}

function prepareModel(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;

    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;

    if (Array.isArray(child.material)) {
      child.material = child.material.map(cloneMaterial);
    } else if (child.material) {
      child.material = cloneMaterial(child.material);
    }
  });
}

function cloneMaterial(material) {
  const clone = material.clone();
  clone.userData.originalMaterial = {
    opacity: clone.opacity,
    transparent: clone.transparent,
    color: clone.color ? clone.color.clone() : new THREE.Color("#ffffff"),
    emissive: clone.emissive ? clone.emissive.clone() : new THREE.Color("#000000"),
    emissiveIntensity: clone.emissiveIntensity ?? 0,
  };
  return clone;
}

function addGroundPlane(scene, bounds, size) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size.x * 3.5, size.z * 3.5),
    new THREE.ShadowMaterial({ color: "#000000", opacity: 0.34 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = bounds.min.y - 0.035;
  ground.receiveShadow = true;
  scene.add(ground);
}

function positionLights(
  namedObjects,
  softboxLight,
  fillLight,
  rimLight,
  frontLight,
  contactWarmLight,
  center,
  size,
) {
  const lightObject = namedObjects.light;
  const tableObject = namedObjects.table;
  const tableCenter = tableObject ? getObjectCenter(tableObject) : center;
  const lightCenter = lightObject
    ? getObjectCenter(lightObject)
    : new THREE.Vector3(-size.x * 0.45, size.y * 0.95, size.z * 0.2);

  softboxLight.position.copy(lightCenter).add(new THREE.Vector3(0, size.y * 0.12, 0));
  softboxLight.lookAt(tableCenter);

  fillLight.position.set(-size.x * 0.65, size.y * 1.15, size.z * 0.7);
  fillLight.target.position.copy(tableCenter);
  rimLight.position.set(size.x * 0.5, size.y * 0.88, -size.z * 0.65);
  rimLight.target.position.copy(tableCenter);
  frontLight.position.set(size.x * 0.08, size.y * 0.85, size.z * 1.05);
  frontLight.target.position.copy(tableCenter);
  contactWarmLight.position.set(-size.x * 0.2, size.y * 0.45, size.z * 0.3);

  softboxLight.updateMatrixWorld();
}

function storeOriginalTransforms(objects) {
  return Object.fromEntries(
    Object.entries(objects).map(([name, object]) => [name, copyTransform(object)]),
  );
}

function copyTransform(object) {
  return {
    position: object.position.clone(),
    rotation: object.rotation.clone(),
    scale: object.scale.clone(),
  };
}

function getObjectCenter(object) {
  return new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
}

function getInitialCameraPosition(size, isMobile) {
  const maxPlan = Math.max(size.x, size.z);

  if (isMobile) {
    return new THREE.Vector3(-1, maxPlan * 0.60, size.z * 0.1 + 0.001);
  }

  return new THREE.Vector3(
    size.x * 0.04,
    size.y * 0.52,
    maxPlan * 1.18,
  );
}

function getInitialCameraTarget(size, isMobile) {
  if (isMobile) {
    return new THREE.Vector3(0, 0.01, size.z * 0.2);
  }

  return new THREE.Vector3(0, size.y * -0.12, 0);
}

function setInitialCameraUp(camera, isMobile) {
  const up = getInitialCameraUp(isMobile);
  camera.up.set(up.x, up.y, up.z);
}

function getInitialCameraUp(isMobile) {
  return {
    x: isMobile ? 1 : 0,
    y: isMobile ? 0 : 1,
    z: 0,
  };
}

function getFocusCameraUp() {
  return {
    x: 0,
    y: 1,
    z: 0,
  };
}

function getLightingMode(modeName, isMobile) {
  const mode = lightingModes[modeName] ?? lightingModes.default;

  if (modeName !== "default" || !isMobile) {
    return mode;
  }

  return {
    ...mode,
    keyIntensity: mode.keyIntensity * 1.5,
    fillIntensity: mode.fillIntensity * 1.9,
    ambientIntensity: Math.min(mode.ambientIntensity * 1.7, 1.3),
    frontIntensity: 3.0,
  };
}

function getFocusCenter(name, size) {
  const baseYByName = {
    cdj: 0.43,
    macbook: 0.52,
  };
  const baseY = size.y * (baseYByName[name] ?? 0.5);
  const xOffsetByName = {
    sony: -0.12,
    cdj: -0.01,
    macbook: -0.12,
    case: -0.12,
  };
  const xOffset = size.x * (xOffsetByName[name] ?? -0.1);
  const zOffset = name === "macbook" ? -size.z * 0.02 : 0;
  return new THREE.Vector3(xOffset, baseY, zOffset);
}

function getFocusCameraPosition(name, focusCenter, size, isMobile) {
  const maxPlan = Math.max(size.x, size.z);
  const distanceByName = {
    sony: 0.64,
    cdj: 0.6,
    macbook: 0.54,
    case: 0.62,
  };
  const distance = maxPlan * (distanceByName[name] ?? 0.64) * (isMobile ? 1.3 : 1);
  const desktopHeight = name === "cdj" ? 0.3 : 0.18;
  const mobileHeight = name === "cdj" ? 0.34 : 0.28;
  const height = focusCenter.y + size.y * (isMobile ? mobileHeight : desktopHeight);
  const xByName = {
    cdj: size.x * 0.01,
    macbook: 0,
  };
  const x = xByName[name] ?? size.x * 0.025;

  return new THREE.Vector3(x, height, distance);
}

function getFocusCameraTarget(name, focusCenter, size) {
  if (name === "cdj") {
    return new THREE.Vector3(focusCenter.x + size.x * 0.06, focusCenter.y + size.y * 0.04, focusCenter.z);
  }

  return new THREE.Vector3(focusCenter.x + size.x * 0.1, focusCenter.y, focusCenter.z);
}

function getCanvasViewport(canvas) {
  return {
    width: canvas.clientWidth || window.innerWidth,
    height: canvas.clientHeight || window.innerHeight,
  };
}

function getFocusRotation(name) {
  const rotations = {
    sony: { x: 0, y: -0.18, z: 0 },
    cdj: { x: 0, y: -0.5, z: -0.02 },
    macbook: { x: 0, y: 0, z: 0 },
    case: { x: 0, y: 0.12, z: 0 },
  };
  return rotations[name] ?? { x: 0, y: 0, z: 0 };
}

function getFocusScale(name) {
  const scales = {
    cdj: 0.92,
    macbook: 1.05,
  };
  return scales[name] ?? 1.08;
}

function forEachMaterial(group, callback) {
  group.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach(callback);
  });
}

function promiseFromTimeline(timeline) {
  return new Promise((resolve) => {
    timeline.eventCallback("onComplete", resolve);
  });
}
