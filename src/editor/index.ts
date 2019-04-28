export * from "./block/BlockStage";
export * from "./property/PropertyList";
export * from "./node-tree/NodeTree";

import * as ticloI18n from "../core/util/i18n";

// register special view

import "./block/view/Note";
import "./block/view/Slider";

export async function initEditor() {
  let lng = window.localStorage.getItem('ticlo-lng');
  await ticloI18n.init(lng);
}
