"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
            value: []
        },
        selectedId: {
            type: String,
            value: ""
        }
    },
    data: {
        renderOptions: []
    },
    observers: {
        "options, selectedId": function (options, selectedId) {
            this.setData({
                renderOptions: options.map((option) => (Object.assign(Object.assign({}, option), { className: option.id === selectedId ? "persona-option is-active" : "persona-option" })))
            });
        }
    },
    methods: {
        noop() { },
        handleMaskTap() {
            this.triggerEvent("cancel");
        },
        handleSelect(event) {
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
