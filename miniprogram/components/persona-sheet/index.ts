import type { HomePersonaOption } from "../../shared/types";

interface PersonaOptionView extends HomePersonaOption {
  className: string;
}

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    active: {
      type: Boolean,
      value: false
    },
    options: {
      type: Array,
      value: [] as HomePersonaOption[]
    },
    selectedId: {
      type: String,
      value: ""
    }
  },
  data: {
    renderOptions: [] as PersonaOptionView[]
  },
  observers: {
    "options, selectedId": function (options: HomePersonaOption[], selectedId: string) {
      this.setData({
        renderOptions: options.map((option) => ({
          ...option,
          className: option.id === selectedId ? "persona-option is-active" : "persona-option"
        }))
      });
    }
  },
  methods: {
    noop() {},
    handleMaskTap() {
      this.triggerEvent("cancel");
    },
    handleSelect(event: WechatMiniprogram.CustomEvent) {
      const personaId = String(event.currentTarget.dataset.personaId || "");
      this.triggerEvent("select", {
        personaId
      });
    },
    handleCancel() {
      this.triggerEvent("cancel");
    },
    handleConfirm() {
      this.triggerEvent("confirm", {
        personaId: this.properties.selectedId
      });
    }
  }
});
