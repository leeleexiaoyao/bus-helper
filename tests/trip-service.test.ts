import assert from "node:assert/strict";
import { TOOL_TYPES, createInitialAppState } from "../miniprogram/shared/constants";
import { BusinessError } from "../miniprogram/shared/errors";
import { MemoryStorageAdapter } from "../miniprogram/repositories/storage-adapter";
import { generateSeatCodes } from "../miniprogram/shared/seat";
import { TripService } from "../miniprogram/services/trip-service";
import type { VoteChoice, VoteSubmitInput } from "../miniprogram/shared/types";

function createService() {
  const storage = new MemoryStorageAdapter(createInitialAppState());
  const service = new TripService(storage);
  return {
    storage,
    service
  };
}

function createServiceWithUserCount(userCount: number) {
  const initialState = createInitialAppState();
  for (let index = 5; index <= userCount; index += 1) {
    initialState.users[`user-${index}`] = {
      id: `user-${index}`,
      nickname: `成员${index}`,
      avatarUrl: `https://example.com/user-${index}.png`,
      tags: [],
      currentTripId: null,
      isAuthorized: false
    };
  }

  const storage = new MemoryStorageAdapter(initialState);
  const service = new TripService(storage);
  return {
    storage,
    service
  };
}

function createServiceWithUsers(userCount: number) {
  const state = createInitialAppState();
  for (let index = 5; index <= userCount; index += 1) {
    const userId = `user-${index}`;
    state.users[userId] = {
      id: userId,
      nickname: `成员${String(index).padStart(2, "0")}`,
      avatarUrl: `https://example.com/${userId}.png`,
      tags: [`模拟${index}`],
      currentTripId: null,
      isAuthorized: false
    };
  }

  const storage = new MemoryStorageAdapter(state);
  const service = new TripService(storage);
  return {
    storage,
    service
  };
}

function expectBusinessError(action: () => void, code: string): void {
  try {
    action();
    assert.fail(`Expected ${code}`);
  } catch (error) {
    if (!(error instanceof BusinessError)) {
      throw error;
    }
    assert.equal(error.code, code);
  }
}

function authorizeActiveUser(service: TripService, nickname: string): void {
  service.authorizeProfile({
    nickname,
    avatarUrl: `https://example.com/${nickname}.png`
  });
}

function joinTripAndSeat(
  service: TripService,
  userId: string,
  nickname: string,
  password: string,
  seatCode: string
): void {
  service.switchActiveUser(userId);
  authorizeActiveUser(service, nickname);
  service.joinTripByPassword(password);
  service.claimSeat(seatCode, {
    profileMode: "custom",
    nickname,
    avatarUrl: ""
  });
}

function setupTripWithMembers() {
  const { service, storage } = createService();
  authorizeActiveUser(service, "小雨");
  const createdTrip = service.createTrip({
    tripName: "周末上山线",
    departureTime: "4/20 07:30",
    password: "123456",
    templateId: "template-49"
  });
  const tripId = createdTrip.currentTrip?.tripMeta.tripId ?? "";

  service.claimSeat("1A", {
    profileMode: "custom",
    nickname: "小雨",
    avatarUrl: ""
  });

  joinTripAndSeat(service, "user-2", "阿山", "123456", "1B");
  joinTripAndSeat(service, "user-3", "Miya", "123456", "1C");
  joinTripAndSeat(service, "user-4", "老周", "123456", "1D");
  service.switchActiveUser("user-1");

  return {
    service,
    storage,
    tripId
  };
}

function setupTripWithMemberCount(memberCount: number) {
  const { service, storage } = createServiceWithUserCount(memberCount);
  const seatCodes = generateSeatCodes("template-49");
  if (memberCount > seatCodes.length) {
    throw new Error(`Too many members for template-49: ${memberCount}`);
  }

  authorizeActiveUser(service, "小雨");
  const createdTrip = service.createTrip({
    tripName: "49人联调线",
    departureTime: "4/20 07:30",
    password: "123456",
    templateId: "template-49"
  });
  const tripId = createdTrip.currentTrip?.tripMeta.tripId ?? "";

  service.claimSeat(seatCodes[0], {
    profileMode: "custom",
    nickname: "小雨",
    avatarUrl: ""
  });

  for (let index = 2; index <= memberCount; index += 1) {
    joinTripAndSeat(service, `user-${index}`, `成员${index}`, "123456", seatCodes[index - 1]);
  }
  service.switchActiveUser("user-1");

  return {
    service,
    storage,
    tripId
  };
}

function getToolCard(service: TripService, toolType: (typeof TOOL_TYPES)[number]) {
  const card = service.getToolsPageData().toolCards.find((entry) => entry.type === toolType);
  assert.ok(card, `Expected tool card ${toolType}`);
  return card;
}

function getVoteDetail(service: TripService) {
  const detail = service.getToolDetailPageData("vote");
  assert.ok(detail.voteDetail, "Expected vote detail");
  return detail;
}

function submitVoteChoice(
  service: TripService,
  choice: VoteChoice,
  optionIds: string[] = []
) {
  const input: VoteSubmitInput = {
    choice,
    optionIds
  };
  return service.submitVote(input);
}

function withMockedRandom<T>(value: number, action: () => T): T {
  const math = Math as typeof Math & { random: () => number };
  const originalRandom = math.random;
  math.random = () => value;
  try {
    return action();
  } finally {
    math.random = originalRandom;
  }
}

function buildSequentialLabels(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}${String(index + 1).padStart(2, "0")}`);
}

function flattenSeatCodes(createdTrip: ReturnType<TripService["createTrip"]>["currentTrip"]): string[] {
  if (!createdTrip) {
    return [];
  }

  return createdTrip.seatRows.reduce<string[]>((accumulator, row) => {
    row.slots.forEach((slot) => {
      if (slot) {
        accumulator.push(slot.code);
      }
    });
    return accumulator;
  }, []);
}

function setupTripWith49Members() {
  const { service, storage } = createServiceWithUsers(49);
  authorizeActiveUser(service, "小雨");
  const createdTrip = service.createTrip({
    tripName: "49 人压力测试线",
    departureTime: "4/20 07:30",
    password: "123456",
    templateId: "template-49"
  });
  const tripId = createdTrip.currentTrip?.tripMeta.tripId ?? "";
  const seatCodes = flattenSeatCodes(createdTrip.currentTrip);

  assert.equal(seatCodes.length, 49);

  service.claimSeat(seatCodes[0], {
    profileMode: "custom",
    nickname: "小雨",
    avatarUrl: ""
  });

  for (let index = 2; index <= 49; index += 1) {
    joinTripAndSeat(
      service,
      `user-${index}`,
      `成员${String(index).padStart(2, "0")}`,
      "123456",
      seatCodes[index - 1]
    );
  }

  service.switchActiveUser("user-1");

  return {
    service,
    storage,
    tripId,
    seatCodes
  };
}

{
  const { service } = createService();

  let toolsPage = service.getToolsPageData();
  assert.equal(toolsPage.isAuthorized, false);
  assert.equal(toolsPage.hasCurrentTrip, false);
  assert.equal(toolsPage.toolCards.length, 4);
  assert.deepEqual(
    toolsPage.toolCards.map((card) => card.type),
    TOOL_TYPES
  );
  assert.equal(toolsPage.toolCards.every((card) => card.stateLabel === "未开启"), true);
  assert.equal(toolsPage.toolCards.every((card) => !card.isStarted), true);
  assert.equal(toolsPage.toolCards.every((card) => !card.canEnter), true);

  expectBusinessError(() => service.getToolDetailPageData("seat-draw"), "TRIP_REQUIRED");

  authorizeActiveUser(service, "小雨");
  toolsPage = service.getToolsPageData();
  assert.equal(toolsPage.isAuthorized, true);
  assert.equal(toolsPage.hasCurrentTrip, false);
  assert.equal(toolsPage.toolCards.every((card) => !card.canEnter), true);

  const createdTrip = service.createTrip({
    tripName: "周末上山线",
    departureTime: "4/20 07:30",
    password: "123456",
    templateId: "template-49"
  });
  assert.equal(createdTrip.currentTrip?.tripMeta.viewerRole, "admin");

  service.claimSeat("1A", {
    profileMode: "custom",
    nickname: "小雨",
    avatarUrl: ""
  });

  joinTripAndSeat(service, "user-2", "阿山", "123456", "1B");
  joinTripAndSeat(service, "user-3", "Miya", "123456", "1C");
  joinTripAndSeat(service, "user-4", "老周", "123456", "1D");
  service.switchActiveUser("user-1");

  toolsPage = service.getToolsPageData();
  assert.equal(toolsPage.hasCurrentTrip, true);
  assert.equal(toolsPage.isAdmin, true);
  assert.equal(toolsPage.toolCards.every((card) => card.canEnter), true);
  assert.equal(toolsPage.toolCards.every((card) => !card.isStarted), true);

  const adminSeatDraw = service.getToolDetailPageData("seat-draw");
  assert.equal(adminSeatDraw.isStarted, false);
  assert.equal(adminSeatDraw.seatDrawDetail, null);
  assert.equal(adminSeatDraw.statusMessage.includes("创建玩法"), true);

  service.switchActiveUser("user-2");
  const memberSeatDraw = service.getToolDetailPageData("seat-draw");
  assert.equal(memberSeatDraw.isStarted, false);
  assert.equal(memberSeatDraw.seatDrawDetail, null);
  assert.equal(memberSeatDraw.statusMessage.includes("玩法未开启"), true);
}

{
  const { service } = setupTripWithMembers();

  service.publishSeatDrawTool({
    topic: "上台表演",
    drawCount: 2,
    excludePreviouslyDrawn: false,
    excludeAdmin: false
  });
  service.publishVoteTool({
    topic: "今晚是否提前十分钟集合",
    excludeAdmin: false,
    selectionMode: "single",
    options: ["投票", "否决", "弃权"]
  });
  service.publishWheelTool({
    items: ["唱歌", "真心话", "讲冷笑话"]
  });
  service.publishLotteryTool({
    winnerCount: 2,
    excludeAdmin: false
  });

  const toolsPage = service.getToolsPageData();
  assert.equal(toolsPage.toolCards.every((card) => card.isStarted), true);
  assert.equal(toolsPage.toolCards.every((card) => card.stateLabel === "已开启"), true);
  assert.equal(getToolCard(service, "seat-draw").canEnter, true);
  assert.equal(getToolCard(service, "vote").canEnter, true);
  assert.equal(getToolCard(service, "wheel").canEnter, true);
  assert.equal(getToolCard(service, "lottery").canEnter, true);

  service.closeVote();

  assert.equal(getToolCard(service, "vote").isStarted, false);
  assert.equal(getToolCard(service, "seat-draw").isStarted, true);
  assert.equal(getToolCard(service, "wheel").isStarted, true);
  assert.equal(getToolCard(service, "lottery").isStarted, true);
  assert.equal(service.getToolDetailPageData("vote").isStarted, false);
}

{
  const { service } = setupTripWithMembers();

  expectBusinessError(
    () =>
      service.publishSeatDrawTool({
        topic: "",
        drawCount: 1,
        excludePreviouslyDrawn: false,
        excludeAdmin: false
      }),
    "INVALID_SEAT_DRAW_TOPIC"
  );

  expectBusinessError(
    () =>
      service.publishSeatDrawTool({
        topic: "这是一个超过十个字的抽号主题",
        drawCount: 1,
        excludePreviouslyDrawn: false,
        excludeAdmin: false
      }),
    "SEAT_DRAW_TOPIC_TOO_LONG"
  );

  expectBusinessError(
    () =>
      service.publishSeatDrawTool({
        topic: "人数超限",
        drawCount: 6,
        excludePreviouslyDrawn: false,
        excludeAdmin: false
      }),
    "DRAW_COUNT_LIMIT_EXCEEDED"
  );

  service.publishSeatDrawTool({
    topic: "上台表演",
    drawCount: 2,
    excludePreviouslyDrawn: true,
    excludeAdmin: true
  });

  let detail = service.getToolDetailPageData("seat-draw");
  assert.equal(detail.isStarted, true);
  assert.equal(detail.seatDrawDetail?.phase, "ready");
  assert.equal(detail.seatDrawDetail?.topic, "上台表演");
  assert.equal(detail.seatDrawDetail?.excludeAdmin, true);
  assert.equal(detail.seatDrawDetail?.excludePreviouslyDrawn, true);
  assert.equal(detail.seatDrawDetail?.remainingCount, 3);

  detail = service.drawSeat();
  const firstRoundUserIds = new Set(
    detail.seatDrawDetail?.lastResult.map((member) => member.userId)
  );
  assert.equal(detail.seatDrawDetail?.lastResult.length, 2);
  assert.equal(detail.seatDrawDetail?.resultRounds.length, 1);
  assert.equal(detail.seatDrawDetail?.remainingCount, 1);
  assert.equal(detail.seatDrawDetail?.lastResult.some((member) => member.userId === "user-1"), false);

  detail = service.drawSeat();
  assert.equal(detail.seatDrawDetail?.lastResult.length, 1);
  assert.equal(detail.seatDrawDetail?.resultRounds.length, 2);
  assert.equal(detail.seatDrawDetail?.remainingCount, 0);
  assert.equal(detail.seatDrawDetail?.canDrawAgain, false);
  assert.equal(firstRoundUserIds.has(detail.seatDrawDetail?.lastResult[0]?.userId ?? ""), false);

  detail = service.resetSeatDraw();
  assert.equal(detail.isStarted, true);
  assert.equal(detail.seatDrawDetail?.phase, "ready");
  assert.equal(detail.seatDrawDetail?.lastResult.length, 0);
  assert.equal(detail.seatDrawDetail?.resultRounds.length, 0);
  assert.equal(detail.seatDrawDetail?.remainingCount, 3);

  detail = service.closeSeatDraw();
  assert.equal(detail.isStarted, false);
  assert.equal(detail.seatDrawDetail, null);
  assert.equal(getToolCard(service, "seat-draw").isStarted, false);
}

{
  const { service } = setupTripWithMembers();

  service.publishVoteTool({
    topic: "今晚是否提前十分钟集合",
    excludeAdmin: true,
    selectionMode: "multiple",
    options: ["方案A", "方案B", "方案C"]
  });

  let detail = getVoteDetail(service);
  assert.equal(detail.isStarted, true);
  assert.equal(detail.voteDetail?.phase, "active");
  assert.equal(detail.voteDetail?.participantCount, 3);
  assert.equal(detail.voteDetail?.excludeAdmin, true);
  assert.equal(detail.voteDetail?.selectionMode, "multiple");
  assert.equal(detail.voteDetail?.options.length, 3);
  assert.deepEqual(
    detail.voteDetail?.options.map((option) => option.label),
    ["方案A", "方案B", "方案C"]
  );
  assert.equal(detail.voteDetail?.viewerHasSubmitted, false);
  assert.equal(detail.voteDetail?.viewerEligible, false);
  assert.equal(detail.statusMessage.includes("创建玩法"), false);

  expectBusinessError(() => submitVoteChoice(service, "approve"), "VOTE_NOT_ALLOWED");

  service.switchActiveUser("user-2");
  detail = getVoteDetail(service);
  assert.equal(detail.voteDetail?.viewerEligible, true);
  const multiOptionIds = detail.voteDetail?.options.map((option) => option.id) ?? [];
  detail = submitVoteChoice(service, "approve", [multiOptionIds[0] ?? ""]);
  assert.equal(detail.voteDetail?.viewerChoice, "approve");
  assert.equal(detail.voteDetail?.viewerHasSubmitted, true);
  assert.deepEqual(detail.voteDetail?.viewerSelectedOptionIds, [multiOptionIds[0]]);
  assert.equal(detail.voteDetail?.submittedCount, 1);

  detail = submitVoteChoice(service, "approve", [multiOptionIds[1] ?? ""]);
  assert.deepEqual(detail.voteDetail?.viewerSelectedOptionIds, [
    multiOptionIds[0],
    multiOptionIds[1]
  ]);
  assert.equal(detail.voteDetail?.submittedCount, 1);

  detail = submitVoteChoice(service, "approve", [multiOptionIds[2] ?? ""]);
  assert.deepEqual(detail.voteDetail?.viewerSelectedOptionIds, multiOptionIds);
  assert.equal(
    detail.voteDetail?.options.every((option) => option.selectedByViewer),
    true
  );
  assert.equal(detail.voteDetail?.submittedCount, 1);
  expectBusinessError(() => submitVoteChoice(service, "reject"), "VOTE_ALREADY_SUBMITTED");

  service.switchActiveUser("user-3");
  detail = submitVoteChoice(service, "reject");
  assert.equal(detail.voteDetail?.submittedCount, 2);

  service.switchActiveUser("user-4");
  detail = submitVoteChoice(service, "abstain");
  assert.equal(detail.voteDetail?.approveCount, 1);
  assert.equal(detail.voteDetail?.rejectCount, 1);
  assert.equal(detail.voteDetail?.abstainCount, 1);
  assert.equal(detail.voteDetail?.submittedCount, 3);

  service.switchActiveUser("user-1");
  detail = service.resetVote();
  assert.equal(detail.isStarted, true);
  assert.equal(detail.voteDetail?.phase, "active");
  assert.equal(detail.voteDetail?.topic, "今晚是否提前十分钟集合");
  assert.equal(detail.voteDetail?.selectionMode, "multiple");
  assert.equal(detail.voteDetail?.participantCount, 3);
  assert.equal(detail.voteDetail?.submittedCount, 0);
  assert.equal(detail.voteDetail?.viewerHasSubmitted, false);
  assert.equal(detail.statusMessage.includes("创建玩法"), false);

  service.switchActiveUser("user-1");
  expectBusinessError(
    () =>
      service.publishVoteTool({
        topic: "重新确认上车时间",
        excludeAdmin: false,
        selectionMode: "single",
        options: ["投票", "否决", "弃权"]
      }),
    "TOOL_ALREADY_STARTED"
  );

  detail = service.closeVote();
  assert.equal(detail.isStarted, false);
  assert.equal(detail.voteDetail, null);
  assert.equal(getToolCard(service, "vote").isStarted, false);
}

{
  const { service, storage, tripId } = setupTripWithMembers();

  service.publishSeatDrawTool({
    topic: "随机上台",
    drawCount: 3,
    excludePreviouslyDrawn: false,
    excludeAdmin: false
  });

  let detail = service.startSeatDrawRound();
  assert.equal(detail.seatDrawDetail?.phase, "rolling");
  assert.equal(detail.seatDrawDetail?.displaySlots.length, 3);
  assert.equal(new Set(detail.seatDrawDetail?.displaySlots.map((slot) => slot.label)).size, 3);

  detail = service.advanceSeatDrawRollingFrame();
  assert.equal(detail.seatDrawDetail?.phase, "rolling");
  assert.equal(new Set(detail.seatDrawDetail?.displaySlots.map((slot) => slot.label)).size, 3);

  const state = storage.getState();
  if (!state) {
    throw new Error("Expected memory state");
  }
  const toolState = state.trips[tripId].tools["seat-draw"];
  if (!toolState || toolState.type !== "seat-draw") {
    throw new Error("Expected seat draw tool state");
  }
  toolState.rollingEndsAt = Date.now() - 1;
  storage.setState(state);

  detail = service.finalizeSeatDrawRoundIfDue();
  assert.equal(detail.seatDrawDetail?.phase, "result");
  assert.equal(detail.seatDrawDetail?.lastResult.length, 3);
  assert.equal(detail.seatDrawDetail?.resultRounds.length, 1);
}

{
  const { service } = setupTripWithMembers();

  service.publishSeatDrawTool({
    topic: "自由抽号",
    drawCount: 2,
    excludePreviouslyDrawn: false,
    excludeAdmin: false
  });
  service.drawSeat();

  let detail = service.recreateSeatDrawTool({
    topic: "重新抽号",
    drawCount: 1,
    excludePreviouslyDrawn: true,
    excludeAdmin: true
  });

  assert.equal(detail.seatDrawDetail?.topic, "重新抽号");
  assert.equal(detail.seatDrawDetail?.drawCount, 1);
  assert.equal(detail.seatDrawDetail?.excludePreviouslyDrawn, true);
  assert.equal(detail.seatDrawDetail?.excludeAdmin, true);
  assert.equal(detail.seatDrawDetail?.resultRounds.length, 0);
}

{
  const { service } = setupTripWithMembers();

  service.publishVoteTool({
    topic: "重新创建投票",
    excludeAdmin: false,
    selectionMode: "multiple",
    options: ["方案A", "方案B"]
  });

  service.switchActiveUser("user-2");
  let detail = getVoteDetail(service);
  const firstOptionId = detail.voteDetail?.options[0]?.id ?? "";
  detail = submitVoteChoice(service, "approve", [firstOptionId]);

  service.switchActiveUser("user-1");
  detail = service.recreateVoteTool({
    topic: "重新创建投票 v2",
    excludeAdmin: false,
    selectionMode: "single",
    options: ["方案A", "方案C"]
  });

  assert.equal(detail.voteDetail?.topic, "重新创建投票 v2");
  assert.equal(detail.voteDetail?.selectionMode, "single");
  assert.equal(detail.voteDetail?.options.length, 2);
  assert.equal(detail.voteDetail?.approveCount, 1);

  service.switchActiveUser("user-2");
  detail = getVoteDetail(service);
  assert.equal(detail.voteDetail?.viewerHasSubmitted, true);
  assert.equal(detail.voteDetail?.viewerSelectedOptionIds.length, 1);
  assert.equal(detail.voteDetail?.options[0]?.selectedByViewer, true);
}

{
  const { service } = setupTripWithMembers();

  service.publishVoteTool({
    topic: "单选投票测试",
    excludeAdmin: false,
    selectionMode: "single",
    options: ["投票", "否决", "弃权"]
  });

  let detail = getVoteDetail(service);
  assert.equal(detail.voteDetail?.selectionMode, "single");
  assert.equal(detail.voteDetail?.options.length, 3);

  service.switchActiveUser("user-2");
  detail = getVoteDetail(service);
  const singleOptionIds = detail.voteDetail?.options.map((option) => option.id) ?? [];
  expectBusinessError(
    () => submitVoteChoice(service, "approve", singleOptionIds),
    "VOTE_SINGLE_OPTION_ONLY"
  );
  detail = submitVoteChoice(service, "approve", [singleOptionIds[0] ?? ""]);
  assert.equal(detail.voteDetail?.viewerSelectedOptionIds.length, 1);
  assert.equal(detail.voteDetail?.viewerHasSubmitted, true);

  service.switchActiveUser("user-1");
  detail = service.closeVote();
  assert.equal(detail.isStarted, false);
  assert.equal(detail.voteDetail, null);
  assert.equal(getToolCard(service, "vote").isStarted, false);
}

{
  const { service } = setupTripWithMembers();

  service.publishVoteTool({
    topic: "否决选项保留测试",
    excludeAdmin: false,
    selectionMode: "multiple",
    options: ["方案A", "方案B"]
  });

  service.switchActiveUser("user-2");
  let detail = getVoteDetail(service);
  const optionIds = detail.voteDetail?.options.map((option) => option.id) ?? [];
  detail = submitVoteChoice(service, "reject", [optionIds[0] ?? ""]);
  assert.equal(detail.voteDetail?.viewerChoice, "reject");
  assert.deepEqual(detail.voteDetail?.viewerSelectedOptionIds, [optionIds[0]]);
  assert.equal(detail.voteDetail?.options[0]?.selectedByViewer, true);
  assert.equal(detail.voteDetail?.options[0]?.supportCount, 0);
}

{
  const { service, storage, tripId } = setupTripWithMembers();
  const corruptedState = storage.getState();
  if (!corruptedState) {
    throw new Error("Expected memory state");
  }

  corruptedState.version = 4;
  corruptedState.trips[tripId].tools.vote = {
    type: "vote",
    publishedAt: 1,
    publishedByUserId: "user-1",
    phase: "active",
    topic: "旧缓存投票",
    excludeAdmin: false,
    options: ["方案A", "方案B"],
    participantUserIds: ["user-1", "user-2"],
    submissions: {
      "user-2": {
        choice: "approve",
        optionIds: ["legacy-vote-option-1"],
        submittedAt: 1
      }
    }
  } as never;
  storage.setState(corruptedState);

  const migratedService = new TripService(storage);
  migratedService.switchActiveUser("user-2");
  const detail = migratedService.getToolDetailPageData("vote");
  assert.equal(detail.isStarted, true);
  assert.equal(detail.voteDetail?.selectionMode, "single");
  assert.deepEqual(
    detail.voteDetail?.options.map((option) => option.label),
    ["方案A", "方案B"]
  );
  assert.equal(detail.voteDetail?.viewerHasSubmitted, true);
  assert.deepEqual(detail.voteDetail?.viewerSelectedOptionIds, ["legacy-vote-option-1"]);
  assert.equal(detail.voteDetail?.options[0]?.selectedByViewer, true);
  assert.equal(detail.voteDetail?.options[0]?.supportCount, 1);
}

{
  const { service } = setupTripWithMembers();

  service.publishWheelTool({
    items: ["唱歌", "真心话", "讲冷笑话"]
  });

  let detail = service.getToolDetailPageData("wheel");
  assert.equal(detail.isStarted, true);
  assert.equal(detail.wheelDetail?.phase, "draft");
  assert.equal(detail.wheelDetail?.items.length, 3);
  assert.equal(detail.wheelDetail?.resultIndex, null);
  assert.equal(detail.wheelDetail?.resultLabel, null);
  assert.deepEqual(detail.wheelDetail?.resultHistoryLabels, []);

  detail = withMockedRandom(0, () => service.spinWheel());
  assert.equal(detail.wheelDetail?.phase, "result");
  assert.equal(detail.wheelDetail?.resultIndex, 0);
  assert.equal(detail.wheelDetail?.resultLabel, "唱歌");
  assert.deepEqual(detail.wheelDetail?.resultHistoryLabels, ["唱歌"]);

  detail = service.resetWheel();
  assert.equal(detail.isStarted, true);
  assert.equal(detail.wheelDetail?.phase, "draft");
  assert.equal(detail.wheelDetail?.resultIndex, null);
  assert.equal(detail.wheelDetail?.resultLabel, null);
  assert.deepEqual(detail.wheelDetail?.resultHistoryLabels, []);

  detail = service.closeWheel();
  assert.equal(detail.isStarted, false);
  assert.equal(detail.wheelDetail, null);
  assert.equal(getToolCard(service, "wheel").isStarted, false);
}

{
  const { service } = setupTripWithMembers();

  service.publishLotteryTool({
    winnerCount: 2,
    excludeAdmin: true
  });

  let detail = service.getToolDetailPageData("lottery");
  assert.equal(detail.isStarted, true);
  assert.equal(detail.lotteryDetail?.phase, "active");
  assert.equal(detail.lotteryDetail?.excludeAdmin, true);
  assert.equal(detail.lotteryDetail?.participantCount, 3);
  assert.equal(detail.lotteryDetail?.viewerEligible, false);

  expectBusinessError(() => service.claimLottery(), "LOTTERY_NOT_ALLOWED");

  service.switchActiveUser("user-2");
  detail = service.claimLottery();
  assert.equal(detail.lotteryDetail?.viewerHasClaimed, true);
  assert.equal(detail.lotteryDetail?.claimedCount, 1);
  assert.equal(typeof detail.lotteryDetail?.viewerIsWinner, "boolean");
  expectBusinessError(() => service.claimLottery(), "LOTTERY_ALREADY_CLAIMED");

  service.switchActiveUser("user-3");
  detail = service.claimLottery();
  assert.equal(detail.lotteryDetail?.claimedCount, 2);
  assert.equal(detail.lotteryDetail?.participants.filter((participant) => participant.claimed).length, 2);

  service.switchActiveUser("user-4");
  detail = service.claimLottery();
  assert.equal(detail.lotteryDetail?.claimedCount, 3);
  assert.equal(detail.lotteryDetail?.participants.every((participant) => participant.claimed), true);

  service.switchActiveUser("user-1");
  detail = service.resetLottery();
  assert.equal(detail.isStarted, true);
  assert.equal(detail.lotteryDetail?.phase, "active");
  assert.equal(detail.lotteryDetail?.participantCount, 3);
  assert.equal(detail.lotteryDetail?.claimedCount, 0);
  assert.equal(detail.lotteryDetail?.participants.length, 3);

  detail = service.closeLottery();
  assert.equal(detail.isStarted, false);
  assert.equal(detail.lotteryDetail, null);
  assert.equal(getToolCard(service, "lottery").isStarted, false);
}

{
  const { service, storage, tripId } = setupTripWithMembers();

  service.publishSeatDrawTool({
    topic: "修复状态",
    drawCount: 1,
    excludePreviouslyDrawn: false,
    excludeAdmin: false
  });
  service.publishVoteTool({
    topic: "状态修复测试",
    excludeAdmin: false,
    selectionMode: "single",
    options: ["投票", "否决", "弃权"]
  });
  service.publishWheelTool({
    items: ["唱歌", "真心话"]
  });
  service.publishLotteryTool({
    winnerCount: 1,
    excludeAdmin: false
  });

  const corruptedState = storage.getState();
  if (!corruptedState) {
    throw new Error("Expected memory state");
  }

  corruptedState.users["user-1"].currentTripId = null;
  storage.setState(corruptedState);

  service.switchActiveUser("user-2");
  const repairedToolsPage = service.getToolsPageData();
  assert.equal(repairedToolsPage.hasCurrentTrip, true);
  assert.equal(repairedToolsPage.toolCards.every((card) => !card.isStarted), true);

  const repairedState = storage.getState();
  assert.equal(repairedState?.trips[tripId].tools["seat-draw"], null);
  assert.equal(repairedState?.trips[tripId].tools.vote, null);
  assert.equal(repairedState?.trips[tripId].tools.wheel, null);
  assert.equal(repairedState?.trips[tripId].tools.lottery, null);
}

{
  const { service, storage, tripId } = setupTripWithMembers();

  service.publishWheelTool({
    items: ["唱歌", "真心话"]
  });
  service.switchActiveUser("user-1");
  service.dissolveCurrentTrip();

  const dissolvedState = storage.getState();
  assert.equal(dissolvedState?.trips[tripId].status, "dissolved");
  assert.equal(
    Object.values(dissolvedState?.trips[tripId].tools ?? {}).every((tool) => tool === null),
    true
  );
  assert.equal(service.bootstrapApp().homeMode, "landing");
}

{
  const legacyState = createInitialAppState();
  legacyState.version = 4;
  legacyState.users = {
    "user-1": legacyState.users["user-1"],
    "user-2": legacyState.users["user-2"],
    "user-3": legacyState.users["user-3"],
    "user-4": legacyState.users["user-4"]
  };

  const storage = new MemoryStorageAdapter(legacyState);
  const service = new TripService(storage);
  const bootstrap = service.bootstrapApp();
  assert.equal(bootstrap.demoUsers.length, 4);

  const normalizedState = storage.getState();
  assert.equal(Object.keys(normalizedState?.users ?? {}).length, 4);
}

{
  const { service } = setupTripWith49Members();

  service.publishSeatDrawTool({
    topic: "49人测试",
    drawCount: 5,
    excludePreviouslyDrawn: true,
    excludeAdmin: false
  });

  expectBusinessError(
    () =>
      service.publishSeatDrawTool({
        topic: "49人测试",
        drawCount: 5,
        excludePreviouslyDrawn: true,
        excludeAdmin: false
      }),
    "TOOL_ALREADY_STARTED"
  );

  let detail = service.getToolDetailPageData("seat-draw");
  assert.equal(detail.isStarted, true);
  assert.equal(detail.seatDrawDetail?.eligibleMembers.length, 49);
  assert.equal(detail.seatDrawDetail?.remainingCount, 49);

  detail = withMockedRandom(0, () => service.drawSeat());
  assert.equal(detail.seatDrawDetail?.lastResult.length, 5);
  assert.equal(detail.seatDrawDetail?.resultRounds.length, 1);
  assert.equal(detail.seatDrawDetail?.remainingCount, 44);
  assert.equal(new Set(detail.seatDrawDetail?.lastResult.map((member) => member.userId)).size, 5);

  detail = service.resetSeatDraw();
  assert.equal(detail.seatDrawDetail?.phase, "ready");
  assert.equal(detail.seatDrawDetail?.lastResult.length, 0);
  assert.equal(detail.seatDrawDetail?.resultRounds.length, 0);
  assert.equal(detail.seatDrawDetail?.remainingCount, 49);
}

{
  const { service } = setupTripWith49Members();
  const optionLabels = buildSequentialLabels("选项", 49);

  service.publishVoteTool({
    topic: "49 人投票压力测试",
    excludeAdmin: false,
    selectionMode: "multiple",
    options: optionLabels
  });

  expectBusinessError(
    () =>
      service.publishVoteTool({
        topic: "49 人投票压力测试",
        excludeAdmin: false,
        selectionMode: "multiple",
        options: optionLabels
      }),
    "TOOL_ALREADY_STARTED"
  );

  let detail = getVoteDetail(service);
  assert.equal(detail.voteDetail?.participantCount, 49);
  assert.equal(detail.voteDetail?.options.length, 49);
  assert.equal(detail.voteDetail?.viewerEligible, true);

  const optionIds = detail.voteDetail?.options.map((option) => option.id) ?? [];
  for (let index = 1; index <= 49; index += 1) {
    service.switchActiveUser(`user-${index}`);
    detail = submitVoteChoice(service, "approve", optionIds);
    assert.equal(detail.voteDetail?.submittedCount, index);
  }

  service.switchActiveUser("user-1");
  detail = getVoteDetail(service);
  assert.equal(detail.voteDetail?.submittedCount, 49);
  assert.equal(detail.voteDetail?.approveCount, 49);
  assert.equal(detail.voteDetail?.rejectCount, 0);
  assert.equal(detail.voteDetail?.abstainCount, 0);
  assert.equal(detail.voteDetail?.options.every((option) => option.supportCount === 49), true);
  assert.equal(detail.voteDetail?.viewerHasSubmitted, true);
  assert.equal(detail.voteDetail?.viewerSelectedOptionIds.length, 49);

  detail = service.resetVote();
  assert.equal(detail.isStarted, true);
  assert.equal(detail.voteDetail?.phase, "active");
  assert.equal(detail.voteDetail?.participantCount, 49);
  assert.equal(detail.voteDetail?.submittedCount, 0);
  assert.equal(detail.voteDetail?.viewerHasSubmitted, false);
}

{
  const { service } = setupTripWith49Members();
  const wheelItems = buildSequentialLabels("玩法", 49);

  service.publishWheelTool({
    items: wheelItems
  });

  expectBusinessError(
    () =>
      service.publishWheelTool({
        items: wheelItems
      }),
    "TOOL_ALREADY_STARTED"
  );

  let detail = service.getToolDetailPageData("wheel");
  assert.equal(detail.isStarted, true);
  assert.equal(detail.wheelDetail?.items.length, 49);
  assert.equal(detail.wheelDetail?.resultIndex, null);
  assert.equal(detail.wheelDetail?.resultLabel, null);
  assert.deepEqual(detail.wheelDetail?.resultHistoryLabels, []);

  detail = withMockedRandom(0.99, () => service.spinWheel());
  assert.equal(detail.wheelDetail?.phase, "result");
  assert.equal(detail.wheelDetail?.resultIndex, 48);
  assert.equal(detail.wheelDetail?.resultLabel, detail.wheelDetail?.items[48]);
  assert.deepEqual(detail.wheelDetail?.resultHistoryLabels, [detail.wheelDetail?.items[48] ?? ""]);

  detail = service.resetWheel();
  assert.equal(detail.isStarted, true);
  assert.equal(detail.wheelDetail?.phase, "draft");
  assert.equal(detail.wheelDetail?.resultIndex, null);
  assert.equal(detail.wheelDetail?.resultLabel, null);
  assert.deepEqual(detail.wheelDetail?.resultHistoryLabels, []);
}

{
  const { service } = setupTripWith49Members();

  service.publishLotteryTool({
    winnerCount: 49,
    excludeAdmin: false
  });

  expectBusinessError(
    () =>
      service.publishLotteryTool({
        winnerCount: 49,
        excludeAdmin: false
      }),
    "TOOL_ALREADY_STARTED"
  );

  let detail = service.getToolDetailPageData("lottery");
  assert.equal(detail.isStarted, true);
  assert.equal(detail.lotteryDetail?.participantCount, 49);
  assert.equal(detail.lotteryDetail?.winnerCount, 49);
  assert.equal(detail.lotteryDetail?.viewerEligible, true);
  assert.equal(detail.lotteryDetail?.claimedCount, 0);

  for (let index = 1; index <= 49; index += 1) {
    service.switchActiveUser(`user-${index}`);
    detail = service.claimLottery();
    assert.equal(detail.lotteryDetail?.claimedCount, index);
    assert.equal(detail.lotteryDetail?.viewerHasClaimed, true);
    assert.equal(detail.lotteryDetail?.viewerIsWinner, true);
  }

  service.switchActiveUser("user-1");
  detail = service.getToolDetailPageData("lottery");
  assert.equal(detail.lotteryDetail?.claimedCount, 49);
  assert.equal(detail.lotteryDetail?.participants.every((participant) => participant.claimed), true);
  assert.equal(detail.lotteryDetail?.participants.every((participant) => participant.statusText === "已抽中"), true);

  detail = service.resetLottery();
  assert.equal(detail.isStarted, true);
  assert.equal(detail.lotteryDetail?.phase, "active");
  assert.equal(detail.lotteryDetail?.participantCount, 49);
  assert.equal(detail.lotteryDetail?.claimedCount, 0);
  assert.equal(detail.lotteryDetail?.viewerHasClaimed, false);
}

console.log("trip-service tests passed");
