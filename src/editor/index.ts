import * as ticloI18n from "../common/util/i18n";
import * as i18next from "i18next";

export async function initEditor() {
  let lng = window.localStorage.getItem('ticlo-lng');
  await ticloI18n.init(lng);
}