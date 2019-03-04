export * from "./block/BlockStage";
export * from "./property/PropertyList";
export * from "./node-tree/NodeTree";

import * as ticloI18n from "../common/util/i18n";

// register special view

import "./block/view/Note";


export async function initEditor() {
  let lng = window.localStorage.getItem('ticlo-lng');
  await ticloI18n.init(lng);
}