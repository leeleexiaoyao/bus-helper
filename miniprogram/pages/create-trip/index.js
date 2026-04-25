"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../../shared/constants");
const trip_service_1 = require("../../services/trip-service");
const cloud_ready_1 = require("../../utils/cloud-ready");
const feedback_1 = require("../../utils/feedback");
const DEFAULT_TEMPLATE_ID = "template-49";
const TEMPLATE_COPY = {
    "template-49": {
        title: "经典 49座",
        layoutText: "4 × 11 + 5"
    },
    "template-53": {
        title: "舒适 53座",
        layoutText: "4 × 12 + 5"
    },
    "template-57": {
        title: "宽敞 57座",
        layoutText: "4 × 13 + 5"
    }
};
function getDepartureDisplay(departureDate, departureClock) {
    if (departureDate && departureClock) {
        return `${departureDate}  ${departureClock}`;
    }
    if (departureDate) {
        return `${departureDate}  选择时间`;
    }
    if (departureClock) {
        return `选择日期  ${departureClock}`;
    }
    return "";
}
function buildTemplates(selectedTemplateId) {
    return constants_1.TRIP_TEMPLATES.map((template) => (Object.assign(Object.assign({}, template), { displayName: TEMPLATE_COPY[template.id].title, layoutText: TEMPLATE_COPY[template.id].layoutText, selected: selectedTemplateId === template.id, className: selectedTemplateId === template.id ? "template-card is-active" : "template-card" })));
}
Page({
    data: {
        tripName: "",
        departureTime: "",
        departureDate: "",
        departureClock: "",
        departureDisplay: "",
        password: "",
        templateId: DEFAULT_TEMPLATE_ID,
        templates: buildTemplates(DEFAULT_TEMPLATE_ID),
        submitting: false
    },
    onLoad() {
        try {
            this.setData({
                password: trip_service_1.tripService.generateAvailableTripPassword()
            });
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
    },
    async onShow() {
        try {
            await (0, cloud_ready_1.waitForCloudReady)();
            trip_service_1.tripService.ensureAuthorizedAccess();
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
            wx.switchTab({
                url: "/pages/home/index"
            });
        }
    },
    handleInput(event) {
        const field = String(event.currentTarget.dataset.field);
        this.setData({
            [field]: event.detail.value
        });
    },
    handleTemplateSelect(event) {
        const templateId = String(event.currentTarget.dataset.templateId);
        this.setData({
            templateId,
            templates: buildTemplates(templateId)
        });
    },
    handleDepartureDateChange(event) {
        const departureDate = String(event.detail.value || "");
        const departureDisplay = getDepartureDisplay(departureDate, this.data.departureClock);
        this.setData({
            departureDate,
            departureDisplay,
            departureTime: departureDate && this.data.departureClock ? `${departureDate} ${this.data.departureClock}` : ""
        });
    },
    handleDepartureTimeChange(event) {
        const departureClock = String(event.detail.value || "");
        const departureDisplay = getDepartureDisplay(this.data.departureDate, departureClock);
        this.setData({
            departureClock,
            departureDisplay,
            departureTime: this.data.departureDate && departureClock ? `${this.data.departureDate} ${departureClock}` : ""
        });
    },
    handleCopyPassword() {
        wx.setClipboardData({
            data: this.data.password,
            success: () => {
                (0, feedback_1.showSuccessToast)("已复制");
            },
            fail: feedback_1.showErrorToast
        });
    },
    handleSubmit() {
        if (this.data.submitting) {
            return;
        }
        this.setData({
            submitting: true
        });
        try {
            trip_service_1.tripService.createTrip({
                tripName: this.data.tripName,
                departureTime: this.data.departureTime,
                password: this.data.password,
                templateId: this.data.templateId
            });
            (0, feedback_1.showSuccessToast)("创建成功");
            setTimeout(() => {
                wx.reLaunch({
                    url: "/pages/home/index"
                });
            }, 450);
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
        }
        finally {
            this.setData({
                submitting: false
            });
        }
    }
});
