import HelperRegisterModule from "../../helper-register-module.js";

import AerisMap from "./aeris-map.vue";


const components = [AerisMap];

export default {
  install: (Vue, options) => {
    let timer = setInterval(() => {
      HelperRegisterModule.registerStore(options.store, components);
      HelperRegisterModule.registerVueComponents(Vue, components);
      clearInterval(timer);
    }, 2000);
  }
};