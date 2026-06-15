import "./styles.css";

import { createInteractionController } from "./interactions.js";
import { createScene } from "./scene.js";
import { createUI } from "./ui.js";

const canvas = document.querySelector("#scene-canvas");
const ui = createUI({
  loader: document.querySelector("#loader"),
  loaderText: document.querySelector("#loader-text"),
  landing: document.querySelector("#landing"),
  label: document.querySelector("#object-label"),
  panel: document.querySelector("#section-panel"),
});

bootstrap().catch((error) => {
  console.error(error);
  ui.setLoadingProgress(0);
});

async function bootstrap() {
  const sceneController = await createScene({
    canvas,
    onProgress: ui.setLoadingProgress,
  });

  ui.hideLoader();

  let hoveredName = null;
  let activeName = null;

  const interactions = createInteractionController({
    canvas,
    camera: sceneController.camera,
    objects: sceneController.clickableObjects,
    onHoverChange(name) {
      hoveredName = name;
      sceneController.setHover(name);

      if (!name) {
        ui.hideObjectLabel();
        return;
      }

      ui.showObjectLabel(name, sceneController.getObjectScreenPosition(name));
    },
    async onSelect(name) {
      if (activeName) return;

      activeName = name;
      interactions.setEnabled(false);
      sceneController.setHover(null);
      ui.hideObjectLabel();
      await ui.hideLanding();
      await sceneController.focusObject(name);
      ui.showSection(name);
    },
  });

  ui.onBack(async () => {
    if (!activeName) return;

    ui.hideSection();
    await sceneController.resetDesk();
    await ui.showLanding();
    activeName = null;
    interactions.setEnabled(true);
  });

  sceneController.start(() => {
    if (hoveredName && !activeName) {
      ui.updateObjectLabel(sceneController.getObjectScreenPosition(hoveredName));
    }
  });

  window.__portfolioDebug = {
    getObjectScreenPosition: sceneController.getObjectScreenPosition,
    selectObject: async (name) => {
      interactions.setEnabled(false);
      activeName = name;
      await ui.hideLanding();
      await sceneController.focusObject(name);
      ui.showSection(name);
    },
    reset: async () => {
      ui.hideSection();
      await sceneController.resetDesk();
      await ui.showLanding();
      activeName = null;
      interactions.setEnabled(true);
    },
  };
}
