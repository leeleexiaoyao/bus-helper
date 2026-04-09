"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../../shared/constants");
const trip_service_1 = require("../../services/trip-service");
const feedback_1 = require("../../utils/feedback");
function formatTemplateLayout(rowSeatCounts) {
    const groups = rowSeatCounts.reduce((accumulator, seatCount) => {
        const lastGroup = accumulator[accumulator.length - 1];
        if (lastGroup && lastGroup.seatCount === seatCount) {
            lastGroup.rowCount += 1;
            return accumulator;
        }
        accumulator.push({
            rowCount: 1,
            seatCount
        });
        return accumulator;
    }, []);
    return groups
        .map((group) => `${group.rowCount}排${group.seatCount}座`)
        .join("+");
}
function buildTemplates(selectedTemplateId) {
    return constants_1.TRIP_TEMPLATES.map((template) => (Object.assign(Object.assign({}, template), { displayName: `${template.seatCount} 座`, layoutText: formatTemplateLayout(template.rowSeatCounts), selected: selectedTemplateId === template.id, className: selectedTemplateId === template.id ? "template-card is-active" : "template-card" })));
}
Page({
    data: {
        statusBarHeight: 20,
        navHeight: 44,
        navTotalHeight: 64,
        navRightPadding: 112,
        tripName: "",
        departureTime: "",
        password: "",
        templateId: "",
        templates: buildTemplates(""),
        submitting: false
    },
    onLoad() {
        const systemInfo = wx.getSystemInfoSync();
        const capsule = wx.getMenuButtonBoundingClientRect();
        const statusBarHeight = systemInfo.statusBarHeight || 20;
        const navHeight = Math.max(44, capsule.bottom - statusBarHeight);
        const navTotalHeight = statusBarHeight + navHeight;
        const navRightPadding = Math.max(systemInfo.windowWidth - capsule.left + 16, 112);
        this.setData({
            statusBarHeight,
            navHeight,
            navTotalHeight,
            navRightPadding
        });
    },
    onShow() {
        try {
            trip_service_1.tripService.ensureAuthorizedAccess();
        }
        catch (error) {
            (0, feedback_1.showErrorToast)(error);
            wx.switchTab({
                url: "/pages/home/index"
            });
        }
    },
    handleBack() {
        if (getCurrentPages().length > 1) {
            wx.navigateBack();
            return;
        }
        wx.switchTab({
            url: "/pages/home/index"
        });
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
            wx.switchTab({
                url: "/pages/home/index"
            });
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
