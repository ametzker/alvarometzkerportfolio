import * as THREE from "three";

const CLICKABLE_NAMES = ["sony", "cdj", "macbook", "case"];

export function createInteractionController({ canvas, camera, objects, onHoverChange, onSelect }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let enabled = true;
  let hoveredName = null;
  let pointerDown = null;

  canvas.addEventListener("pointermove", handlePointerMove, { passive: true });
  canvas.addEventListener("pointerdown", handlePointerDown, { passive: true });
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointerleave", clearHover, { passive: true });

  return {
    setEnabled(nextEnabled) {
      enabled = nextEnabled;
      if (!enabled) clearHover();
    },
    dispose() {
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerleave", clearHover);
    },
  };

  function handlePointerMove(event) {
    if (!enabled || event.pointerType === "touch") return;

    const hit = pick(event);
    const nextName = hit?.name ?? null;

    if (nextName !== hoveredName) {
      hoveredName = nextName;
      canvas.style.cursor = nextName ? "pointer" : "default";
      onHoverChange?.(nextName);
    }
  }

  function handlePointerDown(event) {
    if (!enabled) return;
    pointerDown = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };

    if (event.pointerType === "touch") {
      const hit = pick(event);
      if (hit?.name) {
        hoveredName = hit.name;
        onHoverChange?.(hit.name);
      }
    }
  }

  function handlePointerUp(event) {
    if (!enabled || !pointerDown || pointerDown.pointerId !== event.pointerId) return;

    const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    pointerDown = null;

    if (moved > 10) return;

    const hit = pick(event);
    if (hit?.name) {
      event.preventDefault();
      onSelect?.(hit.name);
    }
  }

  function pick(event) {
    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);

    const intersections = raycaster.intersectObjects(Object.values(objects), true);
    for (const intersection of intersections) {
      const root = findInteractiveRoot(intersection.object);
      if (root && objects[root.name]) {
        return { name: root.name, object: root, point: intersection.point };
      }
    }

    return null;
  }

  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function clearHover() {
    if (!hoveredName) return;

    hoveredName = null;
    canvas.style.cursor = "default";
    onHoverChange?.(null);
  }
}

export function findInteractiveRoot(object) {
  let current = object;

  while (current) {
    if (CLICKABLE_NAMES.includes(current.name)) {
      return current;
    }
    current = current.parent;
  }

  return null;
}
